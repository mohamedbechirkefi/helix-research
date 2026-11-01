// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Live acquisition of a slice's records (research/hbb-acquisition-plan.md §3). Each URL
 * that depends on an earlier answer (transcript, translation, codon, window, entity,
 * assembly, model file) is derived from that answer, never typed in.
 *
 * Platform-agnostic: it only needs an HttpClient, so the same code can serve dynamic mode
 * in the browser or the desktop shell.
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
  const recoder = await step("E11 variant_recoder", ens.variantRecoder(config.variant.rsId));
  const allele = resolveAllele(recoder.data, config.variant.forwardAllele, {
    transcript,
    cds: cds.data.sequence,
    refSeqTranscript: transcript.refSeqMatch,
    refSeqProtein: uniprot.data.maneSelect?.refSeqProtein ?? null,
  });
  const f = config.genomicWindowFlank;
  const window = await step("E8 genomic window", ens.region(transcript.interval.seqRegion, allele.genomicPosition - f, allele.genomicPosition + f, 1));
  const codon = allele.coding.codonNumber;
  const codonMap = await step("E9 map/cds", ens.mapCds(tId, codon * 3 - 2, codon * 3));
  const variation = await step("E10 variation", ens.variation(config.variant.rsId));
  const ensC = allele.hgvsc.find((h) => h.startsWith(`${formatVersioned(transcript.id)}:`))!;
  const vep = await step("E12 vep", ens.vep(ensC));
  const hg = await step("H1 hgnc", hgnc.symbol(config.hgncSymbol));
  const mmcif = await step("P1 mmcif", rcsb.mmcif(config.pdbId));
  const entry = await step("P2 entry", rcsb.entry(config.pdbId));
  const s1 = await step("S1 sifts", sifts.uniprotMappings(config.pdbId));
  const { entityId, segments } = entityForAccession(s1.data, config.uniprotAccession);
  const entity = await step("P3 polymer entity", rcsb.polymerEntity(config.pdbId, entityId));
  const firstChain = [...segments].sort((a, b) => a.labelAsymId.localeCompare(b.labelAsymId))[0]!.labelAsymId;
  const asmId = assemblyOf(mmcif.data, firstChain) ?? "1";
  const asm = await step("P4 assembly", rcsb.assembly(config.pdbId, asmId));
  const cv = await step("C1 clinvar", clinvar.esummary([config.variant.clinvarUid]));
  const cvInfo = await step("C1 clinvar einfo", clinvar.build());

  const inputs: SliceInputs = {
    ensemblInfoData: toRaw(infoData.response),
    ensemblAssembly: toRaw(assembly.response),
    geneLookup: toRaw(gene.response),
    transcriptLookup: toRaw(tLookup.response),
    cds: toRaw(cds.response),
    cdna: toRaw(cdna.response),
    ensemblProtein: toRaw(protein.response),
    genomicWindow: toRaw(window.response),
    codonMap: toRaw(codonMap.response),
    variation: toRaw(variation.response),
    variantRecoder: toRaw(recoder.response),
    vep: toRaw(vep.response),
    uniprot: toRaw(uniprot.response),
    mmcif: toRaw(mmcif.response),
    rcsbEntry: toRaw(entry.response),
    rcsbPolymerEntity: toRaw(entity.response),
    rcsbAssembly: toRaw(asm.response),
    sifts: toRaw(s1.response),
    clinvar: toRaw(cv.response),
    clinvarEinfo: toRaw(cvInfo.response),
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
