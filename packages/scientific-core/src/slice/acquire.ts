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
  SiftsAdapter,
  UniprotAdapter,
} from "@helix/data-adapters";
import { formatVersioned } from "@helix/shared-types";
import { normaliseTranscript } from "../normalise.ts";
import { assemblyOf, entityForAccession } from "../structure-mapping.ts";
import { selectTranscript } from "../transcript-selection.ts";
import { resolveAllele } from "../variant.ts";
import type { RawRecord, SliceConfig, SliceInputs } from "./types.ts";

export function toRaw(r: FetchedResponse): RawRecord {
  return { source: r.source, url: r.url, method: r.method, body: r.body, sha256: r.sha256, retrievedAt: r.retrievedAt, headers: r.headers };
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
    const allele = resolveAllele(recoder.data, v.forwardAllele, {
      transcript,
      cds: cds.data.sequence,
      refSeqTranscript: transcript.refSeqMatch,
      refSeqProtein: uniprot.data.maneSelect?.refSeqProtein ?? null,
    });
    const f = config.genomicWindowFlank;
    const window = await step("E8 genomic window", ens.region(transcript.interval.seqRegion, allele.genomicPosition - f, allele.genomicPosition + f, 1));
    const codon = allele.coding.codonNumber;
    const codonMap = await step("E9 map/cds", ens.mapCds(tId, codon * 3 - 2, codon * 3));
    const variation = await step("E10 variation", ens.variation(v.rsId));
    const ensC = allele.hgvsc.find((h) => h.startsWith(`${formatVersioned(transcript.id)}:`))!;
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
  return inputs;
}
