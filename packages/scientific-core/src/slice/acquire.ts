// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Live acquisition of a slice's records (research/hbb-acquisition-plan.md §3). Each URL
 * that depends on an earlier answer (transcript, translation, codon, window, entity,
 * assembly, model file) is derived from that answer, never typed in.
 *
 * Platform-agnostic: it only needs an HttpClient, so the same code can serve dynamic mode
 * in the browser or the desktop shell.
 *
 * Phase 9: the requests that need a reference variant (E8 to E12, C0, C1) are made only
 * when the specification selects one, and the requests that need an experimental entry
 * (P1 to P4, S1) only when it selects one. Everything else is the same for every gene.
 */
import {
  AlphafoldAdapter,
  ClinvarAdapter,
  EnsemblAdapter,
  type FetchedResponse,
  HgncAdapter,
  type HttpClient,
  RcsbAdapter,
  ReactomeAdapter,
  SiftsAdapter,
  UniprotAdapter,
  compareStableIds,
} from "@helix/data-adapters";
import { formatVersioned } from "@helix/shared-types";
import { normaliseTranscript } from "../normalise.ts";
import { isOpeningCandidate } from "../pathways.ts";
import { assemblyOf, entityForAccession } from "../structure-mapping.ts";
import { selectTranscript } from "../transcript-selection.ts";
import { resolveAllele, resolveDeletion } from "../variant.ts";
import { type RawRecord, type SliceConfig, type SliceInputs, ancestorsInput, participantsInput } from "./types.ts";

export function toRaw(r: FetchedResponse): RawRecord {
  return { source: r.source, url: r.url, method: r.method, body: r.body, sha256: r.sha256, retrievedAt: r.retrievedAt, headers: r.headers };
}

/** The pathway group of inputs (R0 to R3), as a partial record of SliceInputs. */
export type PathwayInputs = Pick<SliceInputs, "reactomeVersion" | "reactomePathways" | `reactomeAncestors:${string}` | `reactomeParticipants:${string}`>;

/**
 * The Reactome requests (Phase 9, P9.1.2, plan section 12 rule 1), separable from the rest so
 * that an offline rebuild can add them to a snapshot that predates them: the release, the
 * memberships of the accession (species 9606), the ancestors of every membership (its
 * top-level pathway) and the participants of every candidate of the opening-pathway rule
 * (non-disease, with a diagram): the rule needs each candidate's participant count, which
 * the membership list does not carry, so one participants request per candidate is made; the
 * record keeps them all and the opening pathway is chosen from the counts at build time.
 */
export async function acquirePathways(http: HttpClient, config: SliceConfig, log: (m: string) => void = () => undefined): Promise<PathwayInputs> {
  const reactome = new ReactomeAdapter(http);
  const step = async <T extends { response: FetchedResponse }>(name: string, p: Promise<T>): Promise<T> => {
    const r = await p;
    log(`${name.padEnd(20)} ${r.response.status} ${String(r.response.bytes).padStart(8)} B  ${r.response.url}`);
    return r;
  };
  const out: PathwayInputs = {};
  const version = await step("R0 reactome version", reactome.databaseVersion());
  const memberships = await step("R1 reactome pathways", reactome.pathwaysForUniprot(config.uniprotAccession));
  out.reactomeVersion = toRaw(version.response);
  out.reactomePathways = toRaw(memberships.response);
  const sorted = [...memberships.data].sort((a, b) => compareStableIds(a.stableId, b.stableId));
  for (const m of sorted) {
    const anc = await step("R2 reactome ancestors", reactome.eventAncestors(m.stableId));
    out[ancestorsInput(m.stableId)] = toRaw(anc.response);
  }
  for (const m of sorted.filter(isOpeningCandidate)) {
    const part = await step("R3 reactome participants", reactome.participants(m.stableId));
    out[participantsInput(m.stableId)] = toRaw(part.response);
  }
  return out;
}

export async function acquireSlice(http: HttpClient, config: SliceConfig, log: (m: string) => void = () => undefined): Promise<SliceInputs> {
  const ens = new EnsemblAdapter(http);
  const uni = new UniprotAdapter(http);
  const rcsb = new RcsbAdapter(http);
  const sifts = new SiftsAdapter(http);
  const clinvar = new ClinvarAdapter(http);
  const hgnc = new HgncAdapter(http);
  const af = new AlphafoldAdapter(http);

  const step = async <T extends { response: FetchedResponse }>(name: string, p: Promise<T>): Promise<T> => {
    const r = await p;
    log(`${name.padEnd(20)} ${r.response.status} ${String(r.response.bytes).padStart(8)} B  ${r.response.url}`);
    return r;
  };

  const infoData = await step("E1 info/data", ens.infoData());
  const assembly = await step("E2 info/assembly", ens.assembly());
  const gene = await step("E3 gene lookup", ens.lookupGene(config.ensemblGeneId));
  const { selection } = selectTranscript(gene.data);
  const tId = selection.selected.id;
  const tLookup = await step("E4 transcript", ens.lookupTranscript(tId));
  const transcript = normaliseTranscript(tLookup.data);
  if (!transcript.translation) throw new Error(`${tId} has no translation`);
  const cds = await step("E5 cds", ens.sequence(tId, "cds"));
  const cdna = await step("E6 cdna", ens.sequence(tId, "cdna"));
  const protein = await step("E7 protein", ens.sequence(transcript.translation.id.id, "protein"));
  const uniprot = await step("U1 uniprot", uni.entry(config.uniprotAccession));

  // ---------------------------------------------------------------- variant group (E8 to E12)
  const variantGroup: Pick<SliceInputs, "genomicWindow" | "codonMap" | "variation" | "variantRecoder" | "vep"> = {};
  if (config.variant) {
    const v = config.variant;
    const recoder = await step("E11 variant_recoder", ens.variantRecoder(v.rsId));
    const vctx = {
      transcript,
      cds: cds.data.sequence,
      refSeqTranscript: transcript.refSeqMatch,
      refSeqProtein: uniprot.data.maneSelect?.refSeqProtein ?? null,
    };
    // The forward-strand span the window is centred on, the CDS span map/cds covers and the HGVS VEP
    // is asked about: one base and one codon for a substitution; the deleted span for a deletion
    // (plan section 11 rule 3), after the recoder confirmed the specification's HGVS c.
    let gStart: number;
    let gEnd: number;
    let cdsStart: number;
    let cdsEnd: number;
    let ensC: string;
    if (v.kind === "deletion") {
      const d = resolveDeletion(recoder.data, v.hgvsC, vctx);
      gStart = d.genomicStart;
      gEnd = d.genomicEnd;
      cdsStart = d.coding.cdsStart;
      cdsEnd = d.coding.cdsEnd;
      ensC = `${formatVersioned(transcript.id)}:${v.hgvsC}`;
    } else {
      const allele = resolveAllele(recoder.data, v.forwardAllele, vctx);
      gStart = allele.genomicPosition;
      gEnd = allele.genomicPosition;
      const codon = allele.coding.codonNumber;
      cdsStart = codon * 3 - 2;
      cdsEnd = codon * 3;
      ensC = allele.hgvsc.find((h) => h.startsWith(`${formatVersioned(transcript.id)}:`))!;
    }
    const f = config.genomicWindowFlank;
    const window = await step("E8 genomic window", ens.region(transcript.interval.seqRegion, gStart - f, gEnd + f, 1));
    const codonMap = await step("E9 map/cds", ens.mapCds(tId, cdsStart, cdsEnd));
    const variation = await step("E10 variation", ens.variation(v.rsId));
    const vep = await step("E12 vep", ens.vep(ensC));
    variantGroup.genomicWindow = toRaw(window.response);
    variantGroup.codonMap = toRaw(codonMap.response);
    variantGroup.variation = toRaw(variation.response);
    variantGroup.variantRecoder = toRaw(recoder.response);
    variantGroup.vep = toRaw(vep.response);
  }

  const hg = await step("H1 hgnc", hgnc.symbol(config.hgncSymbol));

  // ---------------------------------------------------------------- structure group (P1 to P4, S1)
  const structureGroup: Pick<SliceInputs, "mmcif" | "rcsbEntry" | "rcsbPolymerEntity" | "rcsbAssembly" | "sifts"> = {};
  if (config.pdbId) {
    const pdbId = config.pdbId;
    const mmcif = await step("P1 mmcif", rcsb.mmcif(pdbId));
    const entry = await step("P2 entry", rcsb.entry(pdbId));
    const s1 = await step("S1 sifts", sifts.uniprotMappings(pdbId));
    const { entityId, segments } = entityForAccession(s1.data, config.uniprotAccession);
    const entity = await step("P3 polymer entity", rcsb.polymerEntity(pdbId, entityId));
    const firstChain = [...segments].sort((a, b) => a.labelAsymId.localeCompare(b.labelAsymId))[0]!.labelAsymId;
    const asmId = assemblyOf(mmcif.data, firstChain) ?? "1";
    const asm = await step("P4 assembly", rcsb.assembly(pdbId, asmId));
    structureGroup.mmcif = toRaw(mmcif.response);
    structureGroup.rcsbEntry = toRaw(entry.response);
    structureGroup.rcsbPolymerEntity = toRaw(entity.response);
    structureGroup.rcsbAssembly = toRaw(asm.response);
    structureGroup.sifts = toRaw(s1.response);
  }

  // ---------------------------------------------------------------- ClinVar (C0, C1), variant only
  const clinvarGroup: Pick<SliceInputs, "clinvarSearch" | "clinvar" | "clinvarEinfo"> = {};
  if (config.variant) {
    const v = config.variant;
    // C0: every ClinVar record that cites the rsID (other alleles, haplotypes), so the curated record
    // can list them separately; C1 then summarises them all. The configured uid must be among them.
    const cvSearch = await step("C0 clinvar esearch", clinvar.esearchRs(v.rsId));
    if (!cvSearch.data.uids.includes(v.clinvarUid)) throw new Error(`ClinVar esearch ${v.rsId} does not return uid ${v.clinvarUid}`);
    if (cvSearch.data.count > cvSearch.data.uids.length) throw new Error(`ClinVar esearch ${v.rsId} returned ${cvSearch.data.uids.length} of ${cvSearch.data.count} uids`);
    const cv = await step("C1 clinvar", clinvar.esummary(cvSearch.data.uids));
    const cvInfo = await step("C1 clinvar einfo", clinvar.build());
    clinvarGroup.clinvarSearch = toRaw(cvSearch.response);
    clinvarGroup.clinvar = toRaw(cv.response);
    clinvarGroup.clinvarEinfo = toRaw(cvInfo.response);
  }

  const inputs: SliceInputs = {
    ensemblInfoData: toRaw(infoData.response),
    ensemblAssembly: toRaw(assembly.response),
    geneLookup: toRaw(gene.response),
    transcriptLookup: toRaw(tLookup.response),
    cds: toRaw(cds.response),
    cdna: toRaw(cdna.response),
    ensemblProtein: toRaw(protein.response),
    ...variantGroup,
    uniprot: toRaw(uniprot.response),
    ...structureGroup,
    ...clinvarGroup,
    hgnc: toRaw(hg.response),
  };
  if (config.includeAlphafold) {
    const pred = await step("A1 alphafold", af.prediction(config.uniprotAccession));
    const model = await step("A1 alphafold model", af.modelFile(pred.data.cifUrl));
    inputs.alphafoldPrediction = toRaw(pred.response);
    inputs.alphafoldModel = toRaw(model.response);
  }
  if (config.pathways) Object.assign(inputs, await acquirePathways(http, config, log));
  return inputs;
}
