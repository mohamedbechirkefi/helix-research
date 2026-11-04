// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Build a curated gene slice from retrieved records (P2.5.1): parse -> normalise ->
 * validate -> curated records with provenance and evidence.
 *
 * Pure and deterministic: the same inputs give byte-identical record files; only the
 * retrieval times inside provenance and the validation times (`ctx.now`) change. Every
 * number written is read from an input body. Any failed error-level check throws a
 * ValidationFailedError and nothing is produced (no partial dataset).
 *
 * Phase 9: the builder is generic over the gene specification. The variant section (the
 * variant, ClinVar and genomic-window records and their checks) runs only when the
 * specification selects a reference variant; the structure section (the structure, residue
 * mappings and contacts) only when it selects an experimental entry. The checks that need
 * both (the variant residue in the structure, its contacts) run only when both are
 * selected. The order of checks and records is the same as before for a specification
 * that selects both, so the HBB set is unchanged.
 */
import {
  type HgncRecord,
  type MmcifStructure,
  SOURCE_TERMS,
  ValidationFailedError,
  alphafoldDisclaimer,
  assertNoProprietaryIdentifiers,
  parseAlphafoldPrediction,
  parseClinvarEsearch,
  parseClinvarEsummary,
  parseEnsembl,
  parseFasta,
  parseHgnc,
  parseJsonBody,
  parseOpenTargetsAssociations,
  parseRcsb,
  parseReactomeAncestors,
  parseReactomeParticipants,
  parseReactomePathways,
  parseReactomeVersion,
  parseSifts,
  parseUniprotEntry,
  readMmcifStructure,
  sha256Hex,
  compareStableIds,
  topLevelPathwaysOf,
  uniprotProteinsOf,
  EXCLUDED_DATASOURCES,
  EXCLUDED_DATASOURCES_REASON,
  OPEN_TARGETS_PAGE,
  REACTOME_HUMAN_SPECIES,
} from "@helix/data-adapters";
import {
  ASSOCIATION_NEVER_CAUSAL,
  CapabilityReport,
  ClinvarRecordEntry,
  type DiseaseAssociation,
  DiseaseAssociationsRecord,
  type DriftReport,
  type Evidence,
  Gene,
  type KnownIssue,
  type PathwayMembership,
  PathwayMembershipsRecord,
  type PathwayParticipant,
  type PathwayParticipantProtein,
  type OpeningPathway,
  type PathwayParticipantSet,
  PredictedModel,
  Protein,
  type Provenance,
  QuestionsRecord,
  ResidueContacts,
  ResidueMapping,
  ResidueMappingTable,
  type ResidueRef,
  Sequence,
  Structure,
  type StructureCoverage,
  TranscriptRecord,
  type ValidationResult,
  Variant,
  formatVersioned,
  parseVersioned,
} from "@helix/shared-types";
import type { z } from "zod";
import { capabilities } from "../capabilities.ts";
import { type CheckOutcome, translationChecks } from "../checks.ts";
import { hasHydrogens, interChainContacts } from "../contacts.ts";
import { cdsLengthFromExons, codonGenomicSpan, fivePrimeUtrLength, hgvsGDeletion, hgvsGToSpdi, shiftDeletionThreePrime, spdiNetDeletion, spdiToHgvsG } from "../coordinates.ts";
import { detectDrift } from "../drift.ts";
import { classifyClinvarReview, evidence } from "../evidence.ts";
import { clinvarConflicts, clinvarReviewStars } from "../clinvar.ts";
import { resolveGeneQuery } from "../gene-resolution.ts";
import { classifyPdbxMutation, matureDeletionLabel, matureIndex, matureLabel, translatedDeletionLabel, translatedLabel } from "../numbering.ts";
import { interval, normaliseTranscript } from "../normalise.ts";
import { OPENING_PATHWAY_RULE, chooseOpeningPathway, isOpeningCandidate } from "../pathways.ts";
import { AA_PDB_NAME, AA_THREE_LETTER, complement, reverseComplement } from "../sequence.ts";
import { alignmentCrossCheck, assemblyOf, entityForAccession, labelAuthDivergences, mapUniprotChain, mapUniprotPosition, structRefSeqIssues } from "../structure-mapping.ts";
import { selectTranscript } from "../transcript-selection.ts";
import { type ResolvedAllele, type ResolvedDeletion, allelesAtSite, hgvsChangePart, resolveAllele, resolveDeletion, unplacedRecoderAlleles } from "../variant.ts";
import { type RawRecord, type SliceConfig, type SliceInputName, type SliceInputs, type SliceVariant, ancestorsInput, participantsInput } from "./types.ts";

export interface SliceFile {
  path: string;
  recordKind: string;
  content: string;
}

export interface SliceBuild {
  files: SliceFile[];
  sources: Provenance[];
  validation: ValidationResult[];
  knownIssues: KnownIssue[];
  drift: DriftReport[];
  attribution: { source: string; licence: string; text: string }[];
  summary: Record<string, unknown>;
}

const BACKBONE = new Set(["N", "CA", "C", "O", "CB", "OXT"]);

function json(r: RawRecord): unknown {
  return parseJsonBody(r.body, r.url);
}

function stable(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const sameResidue = (a: ResidueRef, b: ResidueRef) => a.labelAsymId === b.labelAsymId && a.labelSeqId === b.labelSeqId && a.authAsymId === b.authAsymId && a.authSeqId === b.authSeqId && a.compId === b.compId;

/** 1863 -> "1,863": a thousands separator that does not depend on the runtime's locale data. */
const withThousands = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * The words of a structure's coverage (P9.2.2, plan section 13 rule 3), composed from the numbers
 * alone so that T48 can recompose them: "2HBS covers residues 2 to 147 of 147 (146 observed
 * positions, 99.3 %; X-RAY DIFFRACTION, 2.05 A)"; for an NMR entry the method part names the
 * ensemble size and the model shown instead of a resolution.
 */
export function coverageText(c: { entryId: string; firstObservedPosition: number; lastObservedPosition: number; observedPositions: number; proteinLength: number; method: string; resolution: number | null; modelCount: number }): string {
  const pct = `${(Math.round((c.observedPositions / c.proteinLength) * 1000) / 10).toFixed(1)} %`;
  const how = c.resolution === null ? `${c.method}, ${c.modelCount} model${c.modelCount === 1 ? "" : "s"}, model 1 shown` : `${c.method}, ${c.resolution} A`;
  return `${c.entryId} covers residues ${c.firstObservedPosition} to ${c.lastObservedPosition} of ${withThousands(c.proteinLength)} (${c.observedPositions} observed position${c.observedPositions === 1 ? "" : "s"}, ${pct}; ${how})`;
}

/** The fraction of the protein the entry covers, four decimals, as the record stores it. */
export const coverageFraction = (observed: number, length: number): number => Math.round((observed / length) * 10000) / 10000;

/** The methods a selected entry may have (T47); solution NMR is the one without a resolution. */
export const ACCEPTED_METHODS = ["X-RAY DIFFRACTION", "ELECTRON MICROSCOPY", "SOLUTION NMR"] as const;

export async function buildSlice(inputs: SliceInputs, config: SliceConfig, ctx: { now: string }): Promise<SliceBuild> {
  // Every body must hash to the sha256 recorded at retrieval (T29).
  for (const [name, r] of Object.entries(inputs) as [string, RawRecord | undefined][]) {
    if (!r) continue;
    const h = await sha256Hex(r.body);
    if (h !== r.sha256) throw new ValidationFailedError("T29-raw-sha256", `${name}: body hashes to ${h}, recorded ${r.sha256}`);
  }
  /** An input the specification's selections require. */
  const need = (name: SliceInputName): RawRecord => {
    const r = inputs[name];
    if (!r) throw new ValidationFailedError("missing-input", `${name} is required by the gene specification but was not acquired`);
    return r;
  };
  // ------------------------------------------------------------ checks collector
  const outcomes: (CheckOutcome & { records: string[] })[] = [];
  const check = (id: string, pass: boolean, detail: string, records: string[], level: "error" | "warn" = "error"): boolean => {
    outcomes.push({ check: id, pass, detail, level, records });
    return pass;
  };
  const validationFor = (record: string): ValidationResult[] =>
    outcomes
      .filter((o) => o.records.includes(record))
      .map((o) => ({ check: o.check, result: o.pass ? "pass" : o.level === "warn" ? "warn" : "fail", detail: o.detail, at: ctx.now }));

  // ------------------------------------------------------------ Ensembl: release, assembly, gene, transcript
  const infoData = parseEnsembl.infoData(json(inputs.ensemblInfoData), inputs.ensemblInfoData.url);
  const asm = parseEnsembl.assembly(json(inputs.ensemblAssembly), inputs.ensemblAssembly.url);
  const ensemblRelease = `Ensembl ${infoData.releases[0]}`;
  const gene = parseEnsembl.gene(json(inputs.geneLookup), inputs.geneLookup.url);
  check("T01-gene-identity", gene.id === config.ensemblGeneId && gene.display_name === config.hgncSymbol, `${gene.id}.${gene.version} ${gene.display_name}`, ["gene"]);
  check("assembly-grch38", gene.assembly_name === "GRCh38" && asm.default_coord_system_version === "GRCh38", `gene ${gene.assembly_name}; Ensembl default ${asm.default_coord_system_version} (${asm.assembly_name})`, ["gene", "transcript"]);
  const sel = selectTranscript(gene);
  check("T02-transcript-selection", sel.selection.rule === "mane_select", `${sel.selection.rule}: ${formatVersioned(sel.selection.selected)} (${sel.selection.reason}); ${sel.selection.candidatesConsidered} candidates`, ["gene", "transcript"]);
  const tRaw = parseEnsembl.transcript(json(inputs.transcriptLookup), inputs.transcriptLookup.url);
  check("transcript-lookup-matches-selection", tRaw.id === sel.transcript.id && tRaw.version === sel.transcript.version, `${tRaw.id}.${tRaw.version}`, ["transcript"]);
  const transcript = normaliseTranscript(tRaw, { assemblyPatch: asm.assembly_name });
  if (!transcript.translation) throw new ValidationFailedError("translation", `${formatVersioned(transcript.id)} has no translation`);
  const exonSum = transcript.exons.reduce((n, e) => n + e.interval.end - e.interval.start + 1, 0);
  check("T05-exon-lengths-sum", exonSum === transcript.length, `sum of exon lengths ${exonSum} vs transcript length ${transcript.length} (1-based closed)`, ["transcript"]);

  // ------------------------------------------------------------ sequences
  const cds = parseFasta(inputs.cds.body, inputs.cds.url);
  const cdna = parseFasta(inputs.cdna.body, inputs.cdna.url);
  const ensp = parseFasta(inputs.ensemblProtein.body, inputs.ensemblProtein.url);
  check("fasta-ids-versioned", cds.id === formatVersioned(transcript.id) && cdna.id === formatVersioned(transcript.id) && ensp.id === formatVersioned(transcript.translation.id), `${cds.id}, ${cdna.id}, ${ensp.id}`, ["sequences"]);
  check("T06-cds-length", cds.sequence.length === cdsLengthFromExons(transcript) && cds.sequence.length === (transcript.translation.length + 1) * 3, `CDS ${cds.sequence.length} nt; exon walk ${cdsLengthFromExons(transcript)}; (protein ${transcript.translation.length} + stop) x 3`, ["sequences", "transcript"]);
  check("cdna-length", cdna.sequence.length === transcript.length, `cDNA ${cdna.sequence.length} vs transcript ${transcript.length}`, ["sequences"]);

  // ------------------------------------------------------------ UniProt
  const uni = parseUniprotEntry(json(inputs.uniprot), inputs.uniprot.url);
  const uniRelease = inputs.uniprot.headers["x-uniprot-release"] ?? null;
  check("uniprot-accession", uni.accession === config.uniprotAccession && uni.reviewed, `${uni.accession} ${uni.entryName}, reviewed ${uni.reviewed}`, ["protein"]);
  for (const o of translationChecks({ cds: cds.sequence, ensemblProtein: ensp.sequence, uniprotSequence: uni.sequence, uniprotMd5: uni.md5 })) {
    check(o.check === "cds-shape" ? "T06-cds-shape" : `T07-${o.check}`, o.pass, o.detail, ["sequences", "protein"]);
  }
  check("uniprot-mane-xref", uni.maneSelect?.transcript === formatVersioned(transcript.id) && uni.maneSelect?.protein === formatVersioned(transcript.translation.id) && uni.maneSelect?.refSeqNucleotide === (transcript.refSeqMatch ? formatVersioned(transcript.refSeqMatch) : null), `UniProt MANE-Select ${uni.maneSelect?.transcript} / ${uni.maneSelect?.protein} / ${uni.maneSelect?.refSeqNucleotide}`, ["protein", "transcript"]);
  const initMet = uni.features.find((f) => f.type === "Initiator methionine");
  const chainF = uni.features.find((f) => f.type === "Chain");
  // Phase 9: an entry with no Initiator methionine feature (the Met is kept) is as consistent as one that
  // annotates its removal; then the processed chain starts at 1 and translated numbering is the processed numbering.
  const initMetRemoved = initMet !== undefined && initMet.start === 1 && /removed/i.test(initMet.description);
  check(
    "T15-initiator-met-and-chain",
    chainF !== undefined && (initMet === undefined ? chainF.start >= 1 : initMetRemoved),
    initMet ? `Initiator methionine ${initMet.start} "${initMet.description}"; Chain ${chainF?.start}-${chainF?.end}` : `no Initiator methionine feature (translated numbering is the processed numbering); Chain ${chainF?.start}-${chainF?.end}`,
    ["protein", "variant"],
  );
  const chainRange = chainF ? { start: chainF.start, end: chainF.end } : null;

  // ------------------------------------------------------------ HGNC
  const hgncDocs: HgncRecord[] = parseHgnc(json(inputs.hgnc), inputs.hgnc.url);
  const hgnc = hgncDocs[0];
  if (!hgnc) throw new ValidationFailedError("hgnc", `no HGNC record for ${config.hgncSymbol}`);
  const res = resolveGeneQuery(config.hgncSymbol, hgncDocs);
  check("T04-hgnc-resolution", res.status === "resolved" && res.ensemblGeneId === gene.id, `${config.hgncSymbol} -> ${res.status === "resolved" ? `${res.hgncId} ${res.ensemblGeneId}` : res.status}`, ["gene"]);
  for (const alias of hgnc.aliases) {
    const r = resolveGeneQuery(alias, hgncDocs);
    check(`T04-alias-${alias}`, r.status === "resolved" && r.ensemblGeneId === gene.id, `alias ${alias} -> ${r.status === "resolved" ? r.ensemblGeneId : r.status}`, ["gene"]);
  }

  // ------------------------------------------------------------ variant (only when the specification selects one)
  const V = config.variant
    ? ((vsel: SliceVariant) => {
        const recoder = parseEnsembl.variantRecoder(json(need("variantRecoder")), need("variantRecoder").url);
        const variation = parseEnsembl.variation(json(need("variation")), need("variation").url);
        const vep = parseEnsembl.vep(json(need("vep")), need("vep").url);
        const vctx = { transcript, cds: cds.sequence, refSeqTranscript: transcript.refSeqMatch, refSeqProtein: uni.maneSelect?.refSeqProtein ?? null };
        const tId = formatVersioned(transcript.id);
        const map38 = variation.mappings.find((m) => m.assembly_name === "GRCh38");
        if (!map38) throw new ValidationFailedError("variation", `${vsel.rsId} has no GRCh38 mapping`);
        const rsAlleles = map38.allele_string.split("/");
        const codonMap = parseEnsembl.mapping(json(need("codonMap")), need("codonMap").url).mappings[0]!;
        const window = parseEnsembl.regionSequence(json(need("genomicWindow")), need("genomicWindow").url);
        const winM = /^chromosome:(GRCh\d+):(\w+):(\d+):(\d+):(-?1)$/.exec(window.id);
        if (!winM) throw new ValidationFailedError("genomic-window", `unexpected region id ${window.id}`);
        const winStart = Number(winM[3]);
        const winEnd = Number(winM[4]);
        const tc = vep[0]!.transcript_consequences.find((c) => c.transcript_id === transcript.id.id);
        if (!tc) throw new ValidationFailedError("vep", `VEP has no consequence for ${transcript.id.id}`);
        const utr = fivePrimeUtrLength(transcript);

        // Kind-specific resolution (plan section 11): a substitution by its forward allele, a deletion by the
        // HGVS c. the recoder confirms. Both give the same model of the allele: where it is, what it changes.
        let sub: ResolvedAllele | null = null;
        let del: ResolvedDeletion | null = null;
        let hgvsg: string;
        let spdi: string;
        let hgvsc: string[];
        let hgvsp: string[];
        let gStart: number;
        let gEnd: number;
        let refForward: string;
        let altForward: string;
        let cdsStart: number;
        let cdsEnd: number;
        let uniPos: number;
        let refAa: string;
        let altAa: string | null;
        let proteinChange: string;
        let span: { start: number; end: number; contiguous: boolean };
        if (vsel.kind === "deletion") {
          del = resolveDeletion(recoder, vsel.hgvsC, vctx);
          hgvsg = del.hgvsg;
          spdi = del.spdi;
          hgvsc = del.hgvsc;
          hgvsp = del.hgvsp;
          gStart = del.genomicStart;
          gEnd = del.genomicEnd;
          refForward = del.deletedForward;
          altForward = "";
          cdsStart = del.coding.cdsStart;
          cdsEnd = del.coding.cdsEnd;
          uniPos = del.coding.residue;
          refAa = del.coding.deletedResidues[0]!.aminoAcid;
          altAa = null;
          proteinChange = del.coding.proteinChange;
          const w = del.genomicSpanFromExonWalk;
          span = { start: w.start, end: w.end, contiguous: w.end - w.start + 1 === del.coding.length };
        } else {
          sub = resolveAllele(recoder, vsel.forwardAllele, vctx);
          hgvsg = sub.hgvsg;
          spdi = sub.spdi;
          hgvsc = sub.hgvsc;
          hgvsp = sub.hgvsp;
          gStart = sub.genomicPosition;
          gEnd = sub.genomicPosition;
          refForward = sub.genomicRef;
          altForward = sub.genomicAlt;
          cdsStart = sub.coding.codonNumber * 3 - 2;
          cdsEnd = sub.coding.codonNumber * 3;
          uniPos = sub.coding.codonNumber; // translated numbering: p. position == UniProt position for the canonical isoform
          refAa = sub.coding.refAa;
          altAa = sub.coding.altAa;
          proteinChange = sub.coding.proteinChange;
          span = codonGenomicSpan(transcript, sub.coding.codonNumber);
        }

        if (sub) {
          const allele = sub;
          const others = allelesAtSite(recoder, vctx);
          // Phase 9 (P9.2.3): a bi-allelic site passes with the words "(bi-allelic)"; a recoder key placed only on an
          // alternate scaffold is named with its placements and is not another allele of the site. HBB, CFTR and
          // BRCA1 (multi-allelic, every key placed on the chromosome) keep their detail byte for byte.
          const unplaced = unplacedRecoderAlleles(recoder);
          const unplacedText = unplaced.length > 0 ? `; recoder key(s) without a chromosome-level placement, not counted: ${unplaced.map((u) => `${u.allele} (${u.placements.join(", ")})`).join("; ")}` : "";
          check("T13-rsid-multiallelic", rsAlleles.length >= 2 && others.length === rsAlleles.length - 1 && others.filter((o) => o.coding.altAa === allele.coding.altAa).length === 1, `${vsel.rsId} alleles ${map38.allele_string}${rsAlleles.length === 2 ? " (bi-allelic)" : ""}; ${others.map((o) => `${o.forwardAllele}:${o.coding.proteinChange}`).join(", ")}${unplacedText}`, ["variant"]);
          check("T08-exon-walk-genomic", allele.genomicPositionFromExonWalk === allele.genomicPosition && map38.start === allele.genomicPosition, `exon walk c.${allele.coding.cdsPosition} -> ${allele.genomicPositionFromExonWalk}; hgvsg ${allele.genomicPosition}; variation ${map38.start}`, ["variant"]);
          check("T08-codon-span", span.contiguous && codonMap.start === span.start && codonMap.end === span.end && codonMap.strand === transcript.interval.strand, `own walk codon ${allele.coding.codonNumber} -> ${span.start}-${span.end}; Ensembl map/cds ${codonMap.start}-${codonMap.end} strand ${codonMap.strand}`, ["variant"]);
          const baseAt = window.seq[allele.genomicPosition - winStart]?.toUpperCase();
          check("T09-forward-and-coding-base", winM[5] === "1" && baseAt === allele.genomicRef && complement(baseAt) === cds.sequence[allele.coding.cdsPosition - 1], `forward-strand base at ${allele.genomicPosition} = ${baseAt}; coding-strand c.${allele.coding.cdsPosition} = ${cds.sequence[allele.coding.cdsPosition - 1]}`, ["variant", "sequences"]);
          check("T10-spdi-roundtrip", spdiToHgvsG(allele.spdi) === allele.hgvsg && hgvsGToSpdi(allele.hgvsg) === allele.spdi, `${allele.spdi} <-> ${allele.hgvsg}`, ["variant"]);
          check("T11-codon-change", allele.coding.refCodon !== allele.coding.altCodon && allele.coding.refAa !== allele.coding.altAa, `codon ${allele.coding.codonNumber} ${allele.coding.refCodon} -> ${allele.coding.altCodon}; ${allele.coding.refAa} -> ${allele.coding.altAa}`, ["variant"]);
          const pStrings = allele.hgvsp.map(hgvsChangePart);
          check("T12-hgvsp-agrees", pStrings.length >= 2 && pStrings.every((p) => p === allele.coding.proteinChange), `computed ${allele.coding.proteinChange}; variant_recoder ${allele.hgvsp.join(", ")}`, ["variant"]);
          check("T12-vep-agrees", tc.protein_start === allele.coding.codonNumber && tc.cds_start === allele.coding.cdsPosition && hgvsChangePart(tc.hgvsp ?? "") === allele.coding.proteinChange && tc.amino_acids === `${allele.coding.refAa}/${allele.coding.altAa}`, `VEP ${tc.hgvsp} protein_start ${tc.protein_start} cds_start ${tc.cds_start} codons ${tc.codons}`, ["variant"]);
          const cdnaPos = allele.coding.cdsPosition + utr;
          check("cdna-position", tc.cdna_start === cdnaPos, `c.${allele.coding.cdsPosition} + 5' UTR ${utr} = ${cdnaPos}; VEP cdna_start ${tc.cdna_start}`, ["variant"]);
          check("T18-hgvsp-equals-uniprot-position", uni.sequence[uniPos - 1] === allele.coding.refAa && uni.sequence === ensp.sequence, `p.${uniPos}: UniProt residue ${uni.sequence[uniPos - 1]}, HGVS ref ${allele.coding.refAa}`, ["variant", "protein"]);
        } else {
          // The deletion branch of the variant checks (plan section 11 rule 3).
          const d = del!;
          const cd = d.coding;
          const first = cd.affectedCodons[0]!;
          const last = cd.affectedCodons[cd.affectedCodons.length - 1]!;
          const wanted = `${tId}:${d.hgvsC}`;
          const confirming = recoder.reduce((n, r) => n + Object.values(r).filter((e) => e.hgvsc.includes(wanted)).length, 0);
          // Ensembl writes an indel's alleles with the base before (TCTT/T) or as "-"; either way the deletion allele is the
          // reference allele shortened by the deleted length, and exactly one recoder entry carries the specification's HGVS.
          const refAllele = rsAlleles[0] ?? "";
          const alleleIsDeletion = d.recoderAllele === "-" || refAllele.length - d.recoderAllele.length === cd.length;
          check("T13-rsid-deletion-allele", rsAlleles.length >= 2 && confirming === 1 && alleleIsDeletion, `${vsel.rsId} alleles ${map38.allele_string} (${variation.var_class}); variant_recoder lists ${wanted} under allele "${d.recoderAllele}" (${confirming} entry), ${cd.length} bases shorter than the reference allele ${refAllele}`, ["variant"]);
          const walk = d.genomicSpanFromExonWalk;
          // The variation mapping of an anchored indel starts one base before the deleted span.
          const anchored = refAllele.length === cd.length + 1 && map38.start === d.genomicStart - 1;
          check("T08-exon-walk-genomic", walk.start === d.genomicStart && walk.end === d.genomicEnd && (anchored || map38.start === d.genomicStart) && map38.end === d.genomicEnd, `exon walk c.${cd.cdsStart}_${cd.cdsEnd} -> ${walk.start}-${walk.end}; hgvsg ${d.genomicStart}-${d.genomicEnd}; variation ${map38.start}-${map38.end}${anchored ? ` (anchored on the base before: ${refAllele}/${d.recoderAllele})` : ""}`, ["variant"]);
          check("T08-deleted-span", span.contiguous && codonMap.start === walk.start && codonMap.end === walk.end && codonMap.strand === transcript.interval.strand, `own walk c.${cd.cdsStart}_${cd.cdsEnd} -> ${walk.start}-${walk.end}; Ensembl map/cds ${codonMap.start}-${codonMap.end} strand ${codonMap.strand}; codons ${first.number}-${last.number}`, ["variant"]);
          const winBases = window.seq.slice(d.genomicStart - winStart, d.genomicEnd - winStart + 1).toUpperCase();
          const codingFromForward = transcript.interval.strand === -1 ? reverseComplement(winBases) : winBases;
          check("T09-forward-and-coding-bases", winM[5] === "1" && winBases === d.deletedForward && codingFromForward === cd.deletedBases, `forward-strand bases at ${d.genomicStart}-${d.genomicEnd} = ${winBases}; SPDI deletes ${d.deletedForward}; coding-strand c.${cd.cdsStart}_${cd.cdsEnd} = ${cd.deletedBases}`, ["variant", "sequences"]);
          const net = spdiNetDeletion(d.spdi);
          let shifted: { start: number; end: number } | null = null;
          let shiftNote = "";
          try {
            shifted = shiftDeletionThreePrime(window.seq, winStart, net.start, net.end, 1);
          } catch (e) {
            shiftNote = e instanceof Error ? e.message : String(e);
          }
          check("T10-spdi-roundtrip", shifted !== null && hgvsGDeletion(net.accession, shifted.start, shifted.end) === d.hgvsg && net.deleted === d.deletedForward, `${d.spdi} -> net deletion ${net.start}-${net.end} ${net.deleted}, shifted 3' on the forward strand to ${shifted ? `${shifted.start}-${shifted.end}` : `(${shiftNote})`} <-> ${d.hgvsg}`, ["variant"]);
          check("T11-deletion-in-frame", cd.length % 3 === 0 && cd.affectedCodons.some((c) => c.afterDeletion === null) && cd.deletedResidues.length === cd.length / 3 && /del$/.test(cd.proteinChange), `c.${cd.cdsStart}_${cd.cdsEnd}del deletes ${cd.length} bases (${cd.deletedBases}); ${cd.affectedCodons.map((c) => `codon ${c.number} ${c.reference} -> ${c.afterDeletion ?? "deleted"} (${c.referenceAminoAcid} -> ${c.aminoAcidAfterDeletion ?? "deleted"})`).join("; ")}; ${cd.proteinChange} by translation`, ["variant"]);
          const pStrings = d.hgvsp.map(hgvsChangePart);
          check("T12-hgvsp-agrees", pStrings.length >= 2 && pStrings.every((p) => p === cd.proteinChange), `computed ${cd.proteinChange}; variant_recoder ${d.hgvsp.join(", ")}`, ["variant"]);
          const refAas = cd.affectedCodons.map((c) => c.referenceAminoAcid).join("");
          const afterAas = cd.affectedCodons.map((c) => c.aminoAcidAfterDeletion ?? "").join("") || "-";
          const refCodons = cd.affectedCodons.map((c) => c.reference).join("");
          const afterCodons = cd.affectedCodons.map((c) => c.afterDeletion ?? "").join("") || "-";
          const [vepRefCodons = "", vepAltCodons = ""] = (tc.codons ?? "").split("/");
          check(
            "T12-vep-agrees",
            tc.protein_start === first.number && tc.protein_end === last.number && tc.cds_start === cd.cdsStart && tc.cds_end === cd.cdsEnd && hgvsChangePart(tc.hgvsp ?? "") === cd.proteinChange && tc.amino_acids === `${refAas}/${afterAas}` && vepRefCodons.toUpperCase() === refCodons && vepAltCodons.toUpperCase() === afterCodons,
            `VEP ${tc.hgvsp} protein ${tc.protein_start}-${tc.protein_end} cds ${tc.cds_start}-${tc.cds_end} amino_acids ${tc.amino_acids} codons ${tc.codons}; computed ${refAas}/${afterAas}, ${refCodons}/${afterCodons}`,
            ["variant"],
          );
          const cdnaPos = cd.cdsStart + utr;
          check("cdna-position", tc.cdna_start === cdnaPos, `c.${cd.cdsStart} + 5' UTR ${utr} = ${cdnaPos}; VEP cdna_start ${tc.cdna_start}`, ["variant"]);
          check(
            "T18-hgvsp-equals-uniprot-position",
            cd.affectedCodons.every((c) => uni.sequence[c.number - 1] === c.referenceAminoAcid) && cd.deletedResidues.every((r) => uni.sequence[r.position - 1] === r.aminoAcid) && uni.sequence === ensp.sequence,
            `codons ${first.number}-${last.number}: UniProt ${uni.sequence.slice(first.number - 1, last.number)}, reference codons translate to ${refAas}; deleted residue(s) ${cd.deletedResidues.map((r) => `${r.aminoAcid}${r.position}`).join(", ")} as in UniProt`,
            ["variant", "protein"],
          );
        }

        const mature = matureIndex(uniPos, chainRange);
        const mLabel = sub ? matureLabel(refAa, uniPos, altAa!, chainRange) : matureDeletionLabel(del!.coding.deletedResidues, chainRange);
        const noMature = chainRange === null || chainRange.start <= 1;
        check(
          "T17-mature-index",
          mature !== null ? mature === uniPos - chainRange!.start + 1 : noMature,
          mature !== null ? `mature index of ${uniPos} = ${mature} (${mLabel})` : `no mature numbering: the processed chain ${chainRange ? `starts at ${chainRange.start}` : "is not annotated"}, so translated numbering is the numbering of record (mature index null)`,
          ["variant"],
        );
        const deletedAas = del ? del.coding.deletedResidues.map((r) => r.aminoAcid).join("") : "";
        const natVar = sub
          ? uni.features.find((f) => f.type === "Natural variant" && f.start === uniPos && f.end === uniPos && f.originalSequence === sub.coding.refAa && f.alternativeSequences.includes(sub.coding.altAa) && f.xrefs.includes(`dbSNP:${vsel.rsId}`))
          : uni.features.find((f) => f.type === "Natural variant" && f.start === del!.coding.deletedResidues[0]!.position && f.end === del!.coding.deletedResidues[del!.coding.deletedResidues.length - 1]!.position && f.alternativeSequences.length === 0 && (f.originalSequence === null || f.originalSequence === deletedAas) && f.xrefs.includes(`dbSNP:${vsel.rsId}`));
        // Phase 9 (P9.2.3): an entry may annotate no natural variant at the position (Q01959 at 85, R85W being a
        // single-submitter ClinVar record): there is then nothing to cross-check and the check passes with those
        // words, and the variant record's UniProt evidence says so. A feature at the position that cites the rsID
        // with another change is a disagreement and fails. HBB, CFTR and BRCA1 keep their detail unchanged.
        const natPositions = sub ? [uniPos] : del!.coding.deletedResidues.map((r) => r.position);
        const natAtPosition = uni.features.filter((f) => f.type === "Natural variant" && natPositions.some((p) => f.start <= p && p <= f.end));
        const natCitingRs = natAtPosition.filter((f) => f.xrefs.includes(`dbSNP:${vsel.rsId}`));
        const natCount = uni.features.filter((f) => f.type === "Natural variant").length;
        const natAbsent = natVar === undefined && natCitingRs.length === 0;
        const natAbsentText = `UniProt ${uni.accession} annotates no natural variant at position ${natPositions.join("-")} citing ${vsel.rsId} (${natCount} natural variant feature(s) in the entry${natAtPosition.length ? `, ${natAtPosition.length} at this position citing another dbSNP id or none` : ", none at this position"}); nothing to cross-check`;
        check(
          "T16-uniprot-natural-variant",
          natVar !== undefined || natAbsent,
          natVar
            ? sub
              ? `${natVar.featureId} at ${natVar.start}: ${natVar.originalSequence}->${natVar.alternativeSequences.join("/")}; ${natVar.description}`
              : `${natVar.featureId} at ${natVar.start}${natVar.end !== natVar.start ? `-${natVar.end}` : ""}: ${natVar.originalSequence ?? deletedAas} missing (no alternative sequence); ${natVar.description}`
            : natAbsent
              ? natAbsentText
              : `UniProt annotates ${natCitingRs.map((f) => `${f.featureId} at ${f.start}: ${f.originalSequence ?? "?"}->${f.alternativeSequences.join("/") || "missing"}`).join(", ")} citing ${vsel.rsId}, which does not match the allele`,
          ["variant", "protein"],
        );

        const clinvarRecords = parseClinvarEsummary(json(need("clinvar")), need("clinvar").url);
        const cv = clinvarRecords.find((r) => r.uid === vsel.clinvarUid);
        if (!cv) throw new ValidationFailedError("clinvar", `ClinVar uid ${vsel.clinvarUid} not in response`);
        const cv38 = cv.locations.find((l) => l.assembly === "GRCh38");
        const cv37 = cv.locations.find((l) => l.assembly === "GRCh37");
        /** The same allele: string equality for a substitution; the same net deletion for a deletion (SPDI contextual forms may differ). */
        const sameAllele = (s: string): boolean => {
          if (sub) return s === spdi;
          try {
            const a = spdiNetDeletion(s);
            const b = spdiNetDeletion(spdi);
            return a.accession === b.accession && a.start === b.start && a.end === b.end && a.deleted === b.deleted;
          } catch {
            return false;
          }
        };
        // A deletion inside a repeat has several equivalent placements: ClinVar's location is the left-aligned one, HGVS g. the
        // 3' one. Both are read from the window; the ClinVar location must be one of them.
        const placements = del
          ? (() => {
              const net = spdiNetDeletion(spdi);
              const at = (strand: 1 | -1): { start: number; end: number } | null => {
                try {
                  return shiftDeletionThreePrime(window.seq, winStart, net.start, net.end, strand);
                } catch {
                  return null;
                }
              };
              return { left: at(-1), right: at(1) };
            })()
          : null;
        const cvSpanOk = sub ? cv38?.start === gStart : [placements!.left, placements!.right].some((p) => p !== null && cv38?.start === p.start && cv38?.stop === p.end);
        const placementName = placements && cv38 ? (placements.left && cv38.start === placements.left.start ? "left-aligned" : placements.right && cv38.start === placements.right.start ? "the 3' form" : "neither placement") : "";
        check(
          "T14-clinvar-record",
          !cv.isHaplotypeOrCompound && cv.canonicalSpdi.some(sameAllele) && cvSpanOk,
          sub
            ? `${cv.accessionVersion} ${cv.objectType}; spdi ${cv.canonicalSpdi.join(",")}; GRCh38 ${cv38?.start}; GRCh37 ${cv37?.start}; ${cv.classification} (${cv.reviewStatus})`
            : `${cv.accessionVersion} ${cv.objectType}; spdi ${cv.canonicalSpdi.join(",")} (recoder ${spdi}, the same net deletion); GRCh38 ${cv38?.start}-${cv38?.stop} (${placementName}; equivalent placements ${placements?.left ? `${placements.left.start}-${placements.left.end}` : "?"} and ${placements?.right ? `${placements.right.start}-${placements.right.end}` : "?"}, HGVS g. ${gStart}-${gEnd}); GRCh37 ${cv37?.start}-${cv37?.stop}; ${cv.classification} (${cv.reviewStatus})`,
          ["variant"],
        );
        // Phase 6 (P6.1.1): review stars, conflicts, and the other records at the same rsID.
        if (inputs.clinvarSearch) {
          const search = parseClinvarEsearch(json(inputs.clinvarSearch), inputs.clinvarSearch.url);
          const got = clinvarRecords.map((r) => r.uid).sort();
          check("T33-clinvar-search-covered", search.count === search.uids.length && [...search.uids].sort().join(",") === got.join(","), `esearch ${vsel.rsId}: ${search.count} uids; esummary returned ${got.length} (${got.join(",")})`, ["clinvar-record"]);
        }
        const cvStars = clinvarReviewStars(cv.reviewStatus);
        const cvConflicts = clinvarConflicts(cv.reviewStatus, cv.classification);
        const cvBasis = classifyClinvarReview(cv.reviewStatus);
        check("T34-clinvar-review-status", cvStars !== null && (cvConflicts.conflicting ? cvBasis === "missing-or-conflicting" : cvBasis === "reviewed-clinical-submission"), `${cv.accessionVersion}: "${cv.reviewStatus}" -> ${cvStars} star(s); conflicting ${cvConflicts.conflicting}; evidence basis ${cvBasis}`, ["clinvar-record"]);
        const related = clinvarRecords
          .filter((r) => r.uid !== cv.uid)
          .map((r) => ({
            uid: r.uid,
            accessionVersion: r.accessionVersion,
            objectType: r.objectType,
            title: r.title,
            classification: r.classification,
            reviewStatus: r.reviewStatus,
            reviewStars: clinvarReviewStars(r.reviewStatus),
            relation: (r.isHaplotypeOrCompound ? "haplotype-or-compound" : "other-allele-or-variant") as "haplotype-or-compound" | "other-allele-or-variant",
            includesThisAllele: r.canonicalSpdi.some(sameAllele),
          }))
          .sort((a, b) => Number(a.uid) - Number(b.uid));
        check(
          "T35-clinvar-related-records-separate",
          related.every((r) => r.accessionVersion !== cv.accessionVersion) && related.filter((r) => r.relation === "other-allele-or-variant").every((r) => !r.includesThisAllele),
          `${related.length} other record(s) for ${vsel.rsId}: ${related.filter((r) => r.relation === "haplotype-or-compound").length} haplotype/compound (${related.filter((r) => r.relation === "haplotype-or-compound" && r.includesThisAllele).length} include ${spdi}), ${related.filter((r) => r.relation === "other-allele-or-variant").length} other allele/variant (${related.filter((r) => r.relation === "other-allele-or-variant").map((r) => `${r.accessionVersion} ${r.classification}`).join("; ") || "none"}); none merged`,
          ["clinvar-record"],
        );
        const cvBuild = inputs.clinvarEinfo ? (json(inputs.clinvarEinfo) as { einforesult?: { dbinfo?: { dbbuild?: string }[] } }).einforesult?.dbinfo?.[0]?.dbbuild ?? null : null;
        return { sel: vsel, kind: vsel.kind, recoder, variation, vep, sub, del, hgvsg, spdi, hgvsc, hgvsp, gStart, gEnd, refForward, altForward, cdsStart, cdsEnd, rsAlleles, codonMap, span, window, winStart, winEnd, tc, uniPos, refAa, altAa, proteinChange, mature, mLabel, natVar, natAbsentText, cv, cv37, related, cvStars, cvConflicts, cvBasis, cvBuild };
      })(config.variant)
    : null;

  // ------------------------------------------------------------ structure (only when the specification selects an entry)
  const S = config.pdbId
    ? ((pdbId: string) => {
        const struct: MmcifStructure = readMmcifStructure(need("mmcif").body, need("mmcif").url);
        const sifts = parseSifts(json(need("sifts")), pdbId, need("sifts").url);
        const rEntry = parseRcsb.entry(json(need("rcsbEntry")), need("rcsbEntry").url);
        const rEntity = parseRcsb.polymerEntity(json(need("rcsbPolymerEntity")), need("rcsbPolymerEntity").url);
        const rAsm = parseRcsb.assembly(json(need("rcsbAssembly")), need("rcsbAssembly").url);
        const pdbRelease = `PDB rev ${struct.latestRevision.version} ${struct.latestRevision.date}`;
        check("structure-entry", struct.entryId === pdbId && rEntry.rcsb_id === pdbId, `${struct.entryId} ${struct.method} ${struct.resolution} A, rev ${struct.latestRevision.version}`, ["structure"]);
        const rLast = [...rEntry.pdbx_audit_revision_history].sort((a, b) => a.major_revision - b.major_revision || a.minor_revision - b.minor_revision).at(-1)!;
        check("structure-revision-agrees", `${rLast.major_revision}.${rLast.minor_revision}` === struct.latestRevision.version, `Data API rev ${rLast.major_revision}.${rLast.minor_revision}; mmCIF rev ${struct.latestRevision.version}`, ["structure"]);
        const { entityId, segments } = entityForAccession(sifts, config.uniprotAccession);
        const ent = struct.entities.find((e) => e.id === entityId);
        if (!ent || !ent.sequenceCanonical) throw new ValidationFailedError("structure-entity", `entity ${entityId} not in mmCIF`);
        const polymerCount = struct.entities.filter((e) => e.type === "polymer").length;
        const siftsChains = [...new Set(segments.map((s) => s.labelAsymId))].sort();
        check("T20-entity-by-sifts", polymerCount >= 1 && ent.type === "polymer" && siftsChains.join(",") === [...ent.strandIds].sort().join(","), `${polymerCount} polymer entities; SIFTS ${config.uniprotAccession} -> entity ${entityId}, chains ${siftsChains.join(",")}; mmCIF strands ${ent.strandIds.join(",")}`, ["structure", "residue-mapping"]);
        check("T20-rcsb-entity-agrees", rEntity.rcsb_polymer_entity_container_identifiers.entity_id === entityId && (rEntity.rcsb_polymer_entity_container_identifiers.uniprot_ids ?? []).includes(config.uniprotAccession), `RCSB polymer_entity ${rEntity.rcsb_id} uniprot ${rEntity.rcsb_polymer_entity_container_identifiers.uniprot_ids?.join(",")}`, ["structure"]);
        const xc = alignmentCrossCheck(ent.sequenceCanonical, uni.sequence, segments);
        check("T21-alignment-cross-check", xc.agrees && xc.alignment.identity >= 0.95, `entity ${ent.sequenceCanonical.length} aa vs UniProt ${uni.sequence.length} aa: offset ${xc.alignment.constantOffset}, identity ${xc.alignment.identity.toFixed(4)}, mismatches ${xc.alignment.mismatches.map((m) => `entity ${m.queryPos} ${m.query} / UniProt ${m.referencePos} ${m.reference}`).join("; ")}; SIFTS offset ${xc.siftsOffset}`, ["residue-mapping"]);
        const rAlign = rEntity.rcsb_polymer_entity_align.find((a) => a.reference_database_accession === config.uniprotAccession && a.provenance_source === "SIFTS");
        const rRegion = rAlign?.aligned_regions[0];
        check("T22-rcsb-align-agrees", rRegion !== undefined && rRegion.ref_beg_seq_id - rRegion.entity_beg_seq_id === xc.siftsOffset, `RCSB rcsb_polymer_entity_align ref_beg ${rRegion?.ref_beg_seq_id} <-> entity_beg ${rRegion?.entity_beg_seq_id}`, ["residue-mapping"]);
        // The variant residue in this structure (both selected).
        let residues: ResidueRef[] | null = null;
        let carries: "alternate" | "reference" | "mixed" | null = null;
        let altName: string | undefined;
        if (V) {
          // T40 (plan section 11 rule 4, section 13 rule 2): the variant residue must be observed in atom_site (model 1),
          // on every mapped chain, through the verified SIFTS mapping; otherwise the entry cannot show where it sits and
          // the set is refused. It runs for a deletion (the mapping would not refuse an unobserved deleted residue by
          // itself) and whenever the specification records the preference "variant-residue-observed", so that the
          // recorded reason for the selection is checked; the HBB specification records no preference and keeps its rows.
          if (V.kind === "deletion" || config.structurePreference === "variant-residue-observed") {
            const perChain = siftsChains.map((c) => {
              const seg = segments.find((s) => s.labelAsymId === c && V.uniPos >= s.unpStart && V.uniPos <= s.unpEnd);
              if (!seg) return { chain: c, state: "not covered by SIFTS" };
              const labelSeqId = seg.labelSeqStart + (V.uniPos - seg.unpStart);
              const row = struct.polySeqScheme.find((r) => r.labelAsymId === c && r.labelSeqId === labelSeqId);
              if (!row) return { chain: c, state: `no pdbx_poly_seq_scheme row for label ${labelSeqId}` };
              const hasAtoms = row.authSeqNum !== null && struct.atoms.some((a) => a.model === 1 && a.labelAsymId === c && a.labelSeqId === labelSeqId);
              return { chain: c, state: hasAtoms ? `observed (label ${labelSeqId}, auth ${row.authSeqNum}, ${row.monId})` : `label ${labelSeqId} ${row.monId} unobserved (no coordinates)` };
            });
            const observedAll = perChain.length > 0 && perChain.every((p) => p.state.startsWith("observed"));
            const detail = `${struct.entryId} residue ${V.refAa}${V.uniPos} (${V.kind === "deletion" ? `deleted in ${V.sel.commonName}` : `the ${V.sel.commonName} position`}): ${perChain.map((p) => `${p.chain} ${p.state}`).join("; ")}; structurePreference ${config.structurePreference ?? "not stated"}`;
            check("T40-variant-residue-observed", observedAll, detail, ["residue-mapping", "structure"]);
            if (!observedAll) throw new ValidationFailedError("T40-variant-residue-observed", detail);
          }
          residues = mapUniprotPosition(struct, sifts, config.uniprotAccession, V.uniPos, (a) => assemblyOf(struct, a));
          altName = V.altAa === null ? undefined : AA_PDB_NAME[V.altAa];
          const refName = AA_PDB_NAME[V.refAa];
          carries = altName !== undefined && residues.every((r) => r.compId === altName && r.authCompId === altName) ? "alternate" : residues.every((r) => r.compId === refName) ? "reference" : "mixed";
          check("T23-residue-from-atom-site", residues.length === siftsChains.length && carries !== "mixed", `${residues.map((r) => `${r.labelAsymId}/${r.authAsymId} label ${r.labelSeqId} auth ${r.authSeqId} ${r.compId}`).join("; ")}; structure carries the ${carries} residue`, ["residue-mapping", "structure"]);
        }
        // Phase 6: full-chain mapping of record (every SIFTS-mapped position on every mapped chain).
        const chainMap = mapUniprotChain(struct, sifts, config.uniprotAccession, (a) => assemblyOf(struct, a));
        const pdbName = (aa: string) => AA_PDB_NAME[aa];
        const tableRows = chainMap.rows.map((r) => ({
          uniprotPosition: r.uniprotPosition,
          uniprotResidue: uni.sequence[r.uniprotPosition - 1]!,
          maturePosition: matureIndex(r.uniprotPosition, chainRange),
          residues: r.residues,
          unobservedChains: r.unobservedChains,
          matchesReference: r.residues.every((x) => x.compId === pdbName(uni.sequence[r.uniprotPosition - 1]!)),
        }));
        const segSpan = segments.map((sg) => sg.unpEnd - sg.unpStart + 1);
        const expectedPerChain = new Map(siftsChains.map((c) => [c, segments.filter((sg) => sg.labelAsymId === c).reduce((n, sg) => n + sg.unpEnd - sg.unpStart + 1, 0)]));
        const perChain = new Map(siftsChains.map((c) => [c, tableRows.filter((r) => r.residues.some((x) => x.labelAsymId === c) || r.unobservedChains.includes(c)).length]));
        const unobservedTotal = tableRows.reduce((n, r) => n + r.unobservedChains.length, 0);
        check("T36-full-chain-covers-sifts", siftsChains.every((c) => perChain.get(c) === expectedPerChain.get(c)) && tableRows.length === Math.max(...segSpan), `${tableRows.length} positions (${tableRows[0]?.uniprotPosition}-${tableRows.at(-1)?.uniprotPosition}); per chain ${siftsChains.map((c) => `${c} ${perChain.get(c)}/${expectedPerChain.get(c)}`).join(", ")}; ${unobservedTotal} unobserved residue(s)`, ["residue-mapping-table"]);
        const row7 = V ? tableRows.find((r) => r.uniprotPosition === V.uniPos) : undefined;
        if (V && residues) {
          const vres = residues;
          check("T37-full-chain-agrees-with-variant-mapping", row7 !== undefined && row7.residues.length === vres.length && row7.residues.every((x, i) => sameResidue(x, vres[i]!)), `position ${V.uniPos}: table ${row7?.residues.map((x) => `${x.authAsymId}${x.authSeqId} ${x.compId}`).join(", ")}; variant mapping record ${vres.map((x) => `${x.authAsymId}${x.authSeqId} ${x.compId}`).join(", ")}`, ["residue-mapping-table", "residue-mapping"]);
        }
        const nameMismatch = tableRows.filter((r) => !r.matchesReference);
        check(
          "T38-full-chain-residue-names",
          nameMismatch.length === (carries === "alternate" ? 1 : 0) && nameMismatch.every((r) => V !== null && r.uniprotPosition === V.uniPos && r.residues.every((x) => x.compId === altName)),
          `atom_site residue = UniProt residue at ${tableRows.length - nameMismatch.length} of ${tableRows.length} positions; differs at ${nameMismatch.map((r) => `${r.uniprotPosition} (UniProt ${r.uniprotResidue}, structure ${[...new Set(r.residues.map((x) => x.compId))].join("/")})`).join(", ") || "none"}`,
          ["residue-mapping-table"],
        );
        const entSeq = ent.sequenceCanonical;
        const seqMismatch = tableRows.filter((r) => r.residues.some((x) => x.labelSeqId === null || entSeq[x.labelSeqId - 1] !== r.uniprotResidue)).map((r) => r.uniprotPosition);
        // The table holds the SIFTS-mapped positions only, so the alignment is compared with it there; a difference
        // outside the mapped segments (P9.2.2: 1JM7's cloning artifact at 111 and 112) is reported with the entry's own
        // _struct_ref_seq_dif explanation and is not a disagreement about the mapping.
        const inMapped = (pos: number): boolean => segments.some((sg) => pos >= sg.unpStart && pos <= sg.unpEnd);
        const alnMismatch = xc.alignment.mismatches.filter((m) => inMapped(m.referencePos)).map((m) => m.referencePos);
        const entStrands = new Set(ent.strandIds);
        const difOf = (labelSeqId: number): string | null => struct.structRefSeqDif.find((d) => entStrands.has(d.strandId) && d.seqNum === labelSeqId)?.details ?? null;
        const outsideMapped = xc.alignment.mismatches.filter((m) => !inMapped(m.referencePos));
        const outsideText = outsideMapped.length > 0 ? `; outside the mapped positions the entity differs at ${outsideMapped.map((m) => `${m.referencePos} (UniProt ${m.reference}, entity ${m.query}, ${difOf(m.queryPos) ?? "not explained by _struct_ref_seq_dif"})`).join(", ")}` : "";
        check("T39-full-chain-alignment-agrees", xc.agrees && seqMismatch.join(",") === alnMismatch.join(","), `entity sequence at the mapped label_seq_id differs from UniProt at ${seqMismatch.join(", ") || "none"}; the independent alignment reports ${alnMismatch.join(", ") || "none"}${outsideText}`, ["residue-mapping-table"]);
        if (V && residues) {
          const vres = residues;
          const naive = struct.polySeqScheme.find((r) => r.labelAsymId === vres[0]!.labelAsymId && r.labelSeqId === V.uniPos);
          // A wrong numbering is detectable only where a different numbering exists: label numbering that differs
          // from UniProt's, or a mature numbering. Where both coincide (Phase 9, a full-length single-chain entry
          // whose chain starts at 1) there is no other numbering to land on, and the check says so.
          const labelDistinct = vres[0]!.labelSeqId !== V.uniPos;
          const matureDistinct = V.mature !== null && V.mature !== V.uniPos;
          const labelPart = labelDistinct ? `label ${V.uniPos} in ${vres[0]!.labelAsymId} is ${naive?.monId} (not ${vres[0]!.compId})` : `label numbering of ${vres[0]!.labelAsymId} equals UniProt numbering at ${V.uniPos} (${vres[0]!.compId})`;
          const maturePart = matureDistinct ? `UniProt position ${V.mature} is ${uni.sequence[V.mature! - 1]} (not ${V.refAa})` : "no distinct mature numbering, so no other numbering exists to land elsewhere";
          check(
            "T24-wrong-numbering-detectable",
            (!labelDistinct || (naive !== undefined && naive.monId !== vres[0]!.compId)) && (!matureDistinct || uni.sequence[V.mature! - 1] !== V.refAa),
            `${labelPart}; ${maturePart}`,
            ["residue-mapping"],
          );
        }
        const mutNumbering = ent.mutation ? classifyPdbxMutation(ent.mutation, uni.sequence, chainRange) : "unknown";
        check("T19-pdbx-mutation-numbering", ent.mutation === null || mutNumbering === "mature/legacy", ent.mutation === null ? "_entity.pdbx_mutation absent: the entity declares no engineered mutation" : `_entity.pdbx_mutation "${ent.mutation}" -> numbering ${mutNumbering}`, ["structure"]);
        const knownIssues: KnownIssue[] = structRefSeqIssues(struct, sifts, config.uniprotAccession);
        if (V && residues) {
          const vres = residues;
          // What the file's own _struct_ref_seq would have selected, had it been trusted.
          const srs = struct.structRefSeq.find((r) => r.dbAccession === config.uniprotAccession && r.strandId === vres[0]!.authAsymId);
          const srsLabel = srs ? srs.seqAlignBeg + (V.uniPos - srs.dbAlignBeg) : null;
          const srsMon = srsLabel === null ? null : struct.polySeqScheme.find((r) => r.labelAsymId === vres[0]!.labelAsymId && r.labelSeqId === srsLabel)?.monId ?? null;
          check(
            "T25-struct-ref-seq-not-trusted",
            vres[0]!.labelSeqId === segments.find((s) => s.labelAsymId === vres[0]!.labelAsymId)!.labelSeqStart + (V.uniPos - segments.find((s) => s.labelAsymId === vres[0]!.labelAsymId)!.unpStart) &&
              (srsLabel === null || srsLabel === vres[0]!.labelSeqId || knownIssues.length > 0),
            `SIFTS selects label ${vres[0]!.labelSeqId} (${vres[0]!.compId}); _struct_ref_seq would select label ${srsLabel} (${srsMon}); ${knownIssues.length} disagreement(s) recorded as known issues`,
            ["residue-mapping"],
          );
        }
        const divergences = labelAuthDivergences(struct);
        if (divergences.length > 0) {
          knownIssues.push({
            id: `label-auth-chain-ids-differ-${struct.entryId}`,
            severity: "info",
            summary: `${struct.entryId}: ${divergences.length} non-polymer label chains have a different auth chain id`,
            detail: divergences.map((d) => `label ${d.labelAsymId} = auth ${d.authAsymId} ${d.monId} ${d.authSeqNum}`).join("; "),
            resolution: "ResidueRef keeps both label_* and auth_* ids; viewer commands must say which they use.",
          });
        }
        const authKnown = new Set([...struct.polySeqScheme.map((r) => r.labelAsymId), ...struct.nonpolyScheme.map((r) => r.labelAsymId)]);
        const noAuth = struct.structAsym.filter((a) => !authKnown.has(a.id)).map((a) => a.id);
        check("T26-label-auth-kept", noAuth.length === 0, `${struct.structAsym.length} label chains, all with an auth chain id from the scheme tables${noAuth.length ? ` (missing: ${noAuth.join(",")})` : ""}; ${divergences.length} non-polymer chains have label != auth (e.g. ${divergences[0] ? `label ${divergences[0].labelAsymId} = auth ${divergences[0].authAsymId} ${divergences[0].monId} ${divergences[0].authSeqNum}` : "none"})`, ["structure"]);
        const rAsmGen = rAsm.pdbx_struct_assembly_gen[0];
        const mmAsm1 = struct.assemblies.find((a) => a.id === rAsmGen?.assembly_id);
        check("T27-assemblies", mmAsm1 !== undefined && rAsmGen !== undefined && [...mmAsm1.asymIds].sort().join(",") === [...rAsmGen.asym_id_list].sort().join(","), struct.assemblies.map((a) => `assembly ${a.id}: ${a.asymIds.join(",")}`).join("; "), ["structure"]);
        const polymerAsyms = new Set(struct.structAsym.filter((a) => struct.entities.find((e) => e.id === a.entityId)?.type === "polymer").map((a) => a.id));
        // The default assembly: the first that contains a mapped variant chain, or, without a variant, a SIFTS-mapped chain.
        const anchorChains = residues ? residues.map((r) => r.labelAsymId) : siftsChains;
        const defaultAssembly = [...struct.assemblies].sort((a, b) => a.id.localeCompare(b.id)).find((a) => anchorChains.some((c) => a.asymIds.includes(c)));
        if (!defaultAssembly) throw new ValidationFailedError("assembly", "no assembly contains a mapped chain");

        // Coverage (P9.2.2, plan section 13 rule 3): the mapped UniProt positions observed in model 1 on at least one
        // mapped chain, against the protein's length; the words are composed from the numbers and T48 recomposes them.
        const observedRows = tableRows.filter((r) => r.residues.length > 0);
        if (observedRows.length === 0) throw new ValidationFailedError("coverage", `${struct.entryId}: no mapped position of ${config.uniprotAccession} is observed in model 1`);
        const coverageNumbers = { entryId: struct.entryId, firstObservedPosition: observedRows[0]!.uniprotPosition, lastObservedPosition: observedRows.at(-1)!.uniprotPosition, observedPositions: observedRows.length, proteinLength: uni.length, method: struct.method, resolution: struct.resolution, modelCount: struct.modelCount };
        const coverage: StructureCoverage = {
          uniprotAccession: config.uniprotAccession,
          chains: siftsChains,
          firstObservedPosition: coverageNumbers.firstObservedPosition,
          lastObservedPosition: coverageNumbers.lastObservedPosition,
          observedPositions: coverageNumbers.observedPositions,
          mappedPositions: tableRows.length,
          proteinLength: uni.length,
          fraction: coverageFraction(observedRows.length, uni.length),
          text: coverageText(coverageNumbers),
        };
        const hydrogens = hasHydrogens(struct);

        // contacts of the variant residue (side-chain atoms beyond CB)
        let contactChains: { residue: ResidueRef; probeAtoms: string[]; contacts: ReturnType<typeof interChainContacts>["contacts"] }[] | null = null;
        if (residues) {
          contactChains = residues.map((r) => {
            const probeAtoms = [...new Set(struct.atoms.filter((a) => a.model === 1 && a.labelAsymId === r.labelAsymId && a.labelSeqId === r.labelSeqId && !BACKBONE.has(a.atomName) && a.element !== "H").map((a) => a.atomName))].sort();
            // One mapped chain (Phase 9, a single-chain entry): the inter-chain record would be empty by construction,
            // so residues of the probe's own chain beyond its covalent neighbours are included and the scope says so.
            const c = interChainContacts(struct, r.authAsymId, r.authSeqId, probeAtoms, config.contactCutoffAngstrom, siftsChains.length === 1 ? { intraChainMinSeparation: 1 } : {});
            return { residue: r, probeAtoms, contacts: c.contacts };
          });
          const cc = contactChains;
          check("T28-contacts-computed", cc.every((c) => c.probeAtoms.length > 0), cc.map((c) => `${c.residue.authAsymId}${c.residue.authSeqId}: ${c.contacts.filter((x) => x.compId !== "HOH").map((x) => `${x.authAsymId}${x.authSeqId}`).join(",") || "none"}`).join("; "), ["residue-contacts"]);
        }
        return { pdbId, struct, sifts, rEntry, rEntity, rAsm, pdbRelease, entityId, segments, ent, siftsChains, xc, rRegion, residues, chainMap, tableRows, row7, nameMismatch, seqMismatch, alnMismatch, knownIssues, polymerAsyms, defaultAssembly, contactChains, coverage, coverageNumbers, hydrogens };
      })(config.pdbId)
    : null;
  const knownIssues: KnownIssue[] = S ? S.knownIssues : [];

  // ------------------------------------------------------------ AlphaFold (optional)
  let af: ReturnType<typeof parseAlphafoldPrediction> | null = null;
  let afDisclaimer: string | null = null;
  if (config.includeAlphafold && inputs.alphafoldPrediction && inputs.alphafoldModel) {
    af = parseAlphafoldPrediction(json(inputs.alphafoldPrediction), inputs.alphafoldPrediction.url);
    afDisclaimer = alphafoldDisclaimer(inputs.alphafoldModel.body, inputs.alphafoldModel.url);
    const md5Match = af.sequenceChecksumMd5 === uni.md5.toUpperCase();
    if (V) {
      check("T32-alphafold-labelled", af.uniprotAccession === config.uniprotAccession && md5Match && af.sequence[V.uniPos - 1] === V.refAa, `${af.entryId} v${af.modelVersion}; md5 match ${md5Match}; residue ${V.uniPos} in model = ${af.sequence[V.uniPos - 1]} (reference), so never used to ${V.altAa !== null ? `place ${V.altAa}` : `show the deletion of ${V.refAa}${V.uniPos}`}`, ["predicted-model"]);
    } else {
      check("T32-alphafold-labelled", af.uniprotAccession === config.uniprotAccession && md5Match, `${af.entryId} v${af.modelVersion}; md5 match ${md5Match}; no reference variant selected, so the model is never used to place one`, ["predicted-model"]);
    }
  }

  // ------------------------------------------------------------ pathways (Phase 9, P9.1.2; only when the specification asks)
  // Membership, never mechanism: the record says which curated pathways list the protein, keeps the participants
  // of every candidate membership as Reactome returns them, and names the one the world opens on (rule 3,
  // amended 2026-11-03: the rule's choice, never an importance).
  const PW = config.pathways
    ? (() => {
        const vRaw = need("reactomeVersion");
        const release = parseReactomeVersion(vRaw.body, vRaw.url);
        const mRaw = need("reactomePathways");
        const raw = parseReactomePathways(json(mRaw), mRaw.url);
        const requested = /\/UniProt\/([^/?]+)\/pathways/.exec(mRaw.url)?.[1] ?? null;
        check("T41-pathway-accession", requested === uni.accession && uni.accession === config.uniprotAccession, `memberships requested for ${requested}; protein record ${uni.accession}; specification ${config.uniprotAccession}`, ["pathways"]);
        const sorted = [...raw].sort((a, b) => compareStableIds(a.stableId, b.stableId));
        const duplicates = sorted.filter((m, i) => i > 0 && m.stableId === sorted[i - 1]!.stableId).map((m) => m.stableId);
        const nonHuman = sorted.filter((m) => m.species !== REACTOME_HUMAN_SPECIES);
        // The mapping lists Pathway and TopLevelPathway events and, measured on 2026-11-03, CellLineagePath
        // (a developmental lineage path, a pathway subclass in Reactome's model); anything else is refused.
        const nonPathway = sorted.filter((m) => !["Pathway", "TopLevelPathway", "CellLineagePath"].includes(m.schemaClass));
        check(
          "T42-pathway-memberships-human",
          duplicates.length === 0 && nonHuman.length === 0 && nonPathway.length === 0,
          `${sorted.length} membership(s) requested for species 9606: ${nonHuman.length === 0 ? `every species name is ${REACTOME_HUMAN_SPECIES}` : `not human: ${nonHuman.map((m) => `${m.stableId} (${m.species})`).join(", ")}`}; ${nonPathway.length === 0 ? "every schema class is a pathway" : `not a pathway: ${nonPathway.map((m) => `${m.stableId} (${m.schemaClass})`).join(", ")}`}; ${duplicates.length === 0 ? "stable ids distinct" : `duplicated: ${duplicates.join(", ")}`}`,
          ["pathways"],
        );
        // Each membership's top-level pathway, from its ancestor paths (every path must end in a TopLevelPathway).
        const topLevel = new Map<string, { stableId: string; name: string }[]>();
        const topLevelProblems: string[] = [];
        for (const m of sorted) {
          const r = need(ancestorsInput(m.stableId));
          try {
            topLevel.set(m.stableId, topLevelPathwaysOf(m.stableId, parseReactomeAncestors(json(r), r.url), r.url));
          } catch (e) {
            topLevel.set(m.stableId, []);
            topLevelProblems.push(`${m.stableId}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        check(
          "T43-pathway-top-level",
          topLevelProblems.length === 0,
          topLevelProblems.length === 0 ? (sorted.length === 0 ? "no membership, no ancestor path requested" : sorted.map((m) => `${m.stableId} -> ${topLevel.get(m.stableId)!.map((t) => t.stableId).join("+")}`).join("; ")) : topLevelProblems.join(" | "),
          ["pathways"],
        );
        // The participants of every candidate of the rule (non-disease, with a diagram): the rule ranks by their
        // count, and the record keeps them all so that a visitor can open any membership (rule 3, amended).
        const participantSets: PathwayParticipantSet[] = [];
        for (const m of sorted.filter(isOpeningCandidate)) {
          const r = need(participantsInput(m.stableId));
          const parts = parseReactomeParticipants(json(r), r.url);
          const partRecs: PathwayParticipant[] = parts.map((p) => ({ dbId: p.dbId, displayName: p.displayName, schemaClass: p.schemaClass, proteins: uniprotProteinsOf(p).map((x) => ({ ...x, isSetProtein: x.accession === uni.accession })) }));
          const byId = new Map<string, PathwayParticipantProtein>();
          for (const p of partRecs) for (const x of p.proteins) if (!byId.has(x.identifier)) byId.set(x.identifier, x);
          const proteins = [...byId.values()].sort((a, b) => a.accession.localeCompare(b.accession) || a.identifier.localeCompare(b.identifier));
          participantSets.push({ stableId: m.stableId, name: m.name, topLevelPathways: topLevel.get(m.stableId) ?? [], participantCount: parts.length, participants: partRecs, proteins, listsSetProtein: proteins.some((p) => p.isSetProtein) });
        }
        const setOf = (stableId: string) => participantSets.find((s) => s.stableId === stableId);
        const choice = chooseOpeningPathway(sorted.map((m) => ({ stableId: m.stableId, name: m.name, isDisease: m.isDisease, hasDiagram: m.hasDiagram, participantCount: setOf(m.stableId)?.participantCount ?? null })));
        check("T44-opening-pathway-rule", true, `${choice.reason}; candidates by count: ${choice.candidates.map((c) => `${c.stableId} ${c.participantCount}`).join(", ") || "none"}; excluded: ${choice.excluded.map((e) => `${e.stableId} (${e.reason})`).join(", ") || "none"}`, ["pathways"]);
        let opening: OpeningPathway | null = null;
        if (choice.opening !== null) {
          const s = setOf(choice.opening)!;
          const own = s.proteins.filter((p) => p.isSetProtein);
          const carriers = s.participants.filter((p) => p.proteins.some((x) => x.isSetProtein)).map((p) => `${p.displayName} (${p.schemaClass})`);
          check(
            "T45-opening-pathway-participants",
            s.participantCount > 0 && own.length > 0,
            `${s.stableId} (${s.name}): ${s.participantCount} participating physical entities, ${s.proteins.length} distinct UniProt proteins; the set's protein ${uni.accession} ${own.length > 0 ? `is among them as ${own.map((p) => p.identifier).join(", ")} in ${carriers.join("; ")}` : "is not among them"}`,
            ["pathways"],
          );
          opening = { stableId: s.stableId, name: s.name, rule: OPENING_PATHWAY_RULE, candidates: choice.candidates, reason: choice.reason };
        }
        // Every candidate the visitor may open: at least one participant and the set's protein among them. A candidate
        // that fails is recorded (listsSetProtein false), not refused: the opening pathway is the one that must hold.
        const weak = participantSets.filter((s) => s.participantCount === 0 || !s.listsSetProtein);
        check(
          "T46-candidate-participants",
          weak.length === 0,
          participantSets.length === 0 ? "no candidate membership, no participants requested" : `${participantSets.length} candidate(s): ${participantSets.map((s) => `${s.stableId} ${s.participantCount} entities, ${s.proteins.length} proteins, set's protein ${s.listsSetProtein ? "listed" : "NOT listed"}`).join("; ")}`,
          ["pathways"],
          "warn",
        );
        const memberships: PathwayMembership[] = sorted.map((m) => ({
          stableId: m.stableId,
          stableIdVersion: m.stableIdVersion,
          name: m.name,
          schemaClass: m.schemaClass as PathwayMembership["schemaClass"],
          species: m.species,
          isDisease: m.isDisease,
          hasDiagram: m.hasDiagram,
          topLevelPathways: topLevel.get(m.stableId) ?? [],
          participantCount: setOf(m.stableId)?.participantCount ?? null,
          isOpening: m.stableId === choice.opening,
        }));
        return { release, memberships, participantSets, opening, choice };
      })()
    : null;

  // ------------------------------------------------------------ disease associations (Phase 9, P9.1.3; only when the specification asks)
  // Association, never causal: the record repeats the platform's first page of associations by score, with the
  // datasource scores of the registry's share-alike or restricted sources dropped at parse time (plan section 14).
  const AS = config.associations
    ? (() => {
        const raw = need("opentargetsAssociations");
        const ot = parseOpenTargetsAssociations(json(raw), raw.url);
        check("T49-association-target", ot.ensemblGeneId === config.ensemblGeneId && ot.ensemblGeneId === gene.id && ot.approvedSymbol === gene.display_name, `response target ${ot.ensemblGeneId} ${ot.approvedSymbol}; specification ${config.ensemblGeneId}; gene record ${gene.id} ${gene.display_name}`, ["associations"]);
        const idForm = /^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9]+$/;
        const inUnit = (x: number) => Number.isFinite(x) && x >= 0 && x <= 1;
        const badRows = ot.rows.filter((r) => !idForm.test(r.diseaseId) || r.diseaseName.trim().length === 0 || !inUnit(r.score) || !r.datatypeScores.every((x) => inUnit(x.score)) || !r.datasourceScores.every((x) => inUnit(x.score)));
        check(
          "T49-association-rows",
          badRows.length === 0,
          `${ot.rows.length} row(s) kept of ${ot.count} on the platform (page ${OPEN_TARGETS_PAGE.index}, size ${OPEN_TARGETS_PAGE.size}); ${badRows.length === 0 ? "every row has a disease id (ontology_number form), a name and an overall score between 0 and 1, and every datatype and datasource score is between 0 and 1" : `bad rows: ${badRows.map((r) => `${r.diseaseId} ${r.score}`).join(", ")}`}${ot.rows[0] ? `; top ${ot.rows[0].diseaseName} (${ot.rows[0].diseaseId}) ${ot.rows[0].score}` : ""}`,
          ["associations"],
        );
        const outOfOrder = ot.rows.filter((r, i) => i > 0 && r.score > ot.rows[i - 1]!.score).map((r) => r.diseaseId);
        const remaining = ot.rows.flatMap((r) => r.datasourceScores.filter((x) => EXCLUDED_DATASOURCES.includes(x.id.toLowerCase())).map((x) => `${r.diseaseId}:${x.id}`));
        check(
          "T50-association-order-and-exclusion",
          outOfOrder.length === 0 && remaining.length === 0,
          `${outOfOrder.length === 0 ? "rows in descending score order" : `out of order at ${outOfOrder.join(", ")}`}; excluded datasources ${EXCLUDED_DATASOURCES.join(", ")}; observed in the response: ${ot.datasourceIdsObserved.join(", ") || "none"}; dropped: ${ot.droppedDatasourceIds.join(", ") || "none"}; ${remaining.length === 0 ? "no excluded id remains in the kept scores" : `remaining: ${remaining.join(", ")}`}`,
          ["associations"],
        );
        // T51: the versions the record writes equal the meta of the same response, re-read from the raw body.
        const metaRaw = (json(raw) as { data?: { meta?: { apiVersion?: { x?: string; y?: string; z?: string }; dataVersion?: { year?: string; month?: string } } } }).data?.meta;
        const apiFromBody = metaRaw?.apiVersion ? `${metaRaw.apiVersion.x}.${metaRaw.apiVersion.y}.${metaRaw.apiVersion.z}` : null;
        const dataFromBody = metaRaw?.dataVersion ? `${metaRaw.dataVersion.year}.${metaRaw.dataVersion.month}` : null;
        check("T51-association-versions", apiFromBody === ot.apiVersion && dataFromBody === ot.dataVersion && apiFromBody !== null, `record api ${ot.apiVersion}, data ${ot.dataVersion}; the response's meta: api ${apiFromBody}, data ${dataFromBody}`, ["associations"]);
        const rows: DiseaseAssociation[] = ot.rows.map((r) => ({ diseaseId: r.diseaseId, diseaseName: r.diseaseName, therapeuticAreas: r.therapeuticAreas, score: r.score, datatypeScores: r.datatypeScores, datasourceScores: r.datasourceScores, droppedDatasourceIds: r.droppedDatasourceIds }));
        return { ot, rows, release: `Open Targets ${ot.apiVersion} (data ${ot.dataVersion})` };
      })()
    : null;

  // ------------------------------------------------------------ method and coverage of the selected entry (P9.2.2, plan section 13 rule 7)
  if (S) {
    const { struct, coverage, coverageNumbers, tableRows } = S;
    const isNmr = struct.method === "SOLUTION NMR";
    const methodOk = (ACCEPTED_METHODS as readonly string[]).includes(struct.method);
    const ensembleAgrees = struct.nmrEnsemble?.conformersSubmitted === null || struct.nmrEnsemble?.conformersSubmitted === undefined || struct.nmrEnsemble.conformersSubmitted === struct.modelCount;
    check(
      "T47-structure-method",
      methodOk && (isNmr ? struct.resolution === null && struct.modelCount >= 1 && ensembleAgrees : struct.resolution !== null && struct.modelCount === 1),
      `${struct.entryId} method ${struct.method}${methodOk ? "" : " (not one of X-ray diffraction, electron microscopy, solution NMR)"}; resolution ${struct.resolution === null ? "none" : `${struct.resolution} A`}; ${struct.modelCount} model(s) in atom_site${struct.nmrEnsemble ? `; _pdbx_nmr_ensemble: ${struct.nmrEnsemble.conformersSubmitted ?? "?"} submitted of ${struct.nmrEnsemble.conformersCalculated ?? "?"} calculated${struct.nmrEnsemble.representativeConformer === null ? "" : `, representative conformer ${struct.nmrEnsemble.representativeConformer}${struct.nmrEnsemble.representativeSelectionCriteria ? ` (${struct.nmrEnsemble.representativeSelectionCriteria})` : ""}`}` : ""}; model 1 is the one mapped, measured and shown`,
      ["structure"],
    );
    const recomposed = coverageText(coverageNumbers);
    const fractionOk = coverage.fraction === coverageFraction(coverage.observedPositions, coverage.proteinLength);
    check(
      "T48-structure-coverage",
      fractionOk && coverage.firstObservedPosition <= coverage.lastObservedPosition && coverage.observedPositions <= coverage.mappedPositions && coverage.mappedPositions === tableRows.length && coverage.proteinLength === uni.length && coverage.text === recomposed,
      `${coverage.observedPositions} of ${coverage.mappedPositions} mapped positions observed in model 1 on chain(s) ${coverage.chains.join(",")}, ${coverage.firstObservedPosition}-${coverage.lastObservedPosition}; protein length ${coverage.proteinLength}; fraction ${coverage.fraction} = ${coverage.observedPositions}/${coverage.proteinLength}; words ${coverage.text === recomposed ? "match the numbers" : `do not match: "${coverage.text}" against "${recomposed}"`}`,
      ["structure"],
    );
  }

  // ------------------------------------------------------------ drift
  const drift = detectDrift({
    ensemblGene: { id: gene.id, version: gene.version },
    uniprot: { accession: uni.accession, entryVersion: uni.entryVersion, ensemblXrefs: uni.ensembl },
    selectedTranscript: formatVersioned(transcript.id),
    vepSwissprot: V?.tc.swissprot ?? [],
    maneRefSeq: transcript.refSeqMatch ? formatVersioned(transcript.refSeqMatch) : null,
    hgncManeSelect: hgnc.maneSelect,
    uniprotManeSelect: uni.maneSelect,
    clinvarTitle: V?.cv.title ?? null,
  });
  check("T31-drift-recorded", true, drift.length === 0 ? "no version drift" : drift.map((d) => `${d.id}: ${d.observedValue} vs ${d.referenceValue}`).join("; "), ["gene", "protein"], "warn");

  // ------------------------------------------------------------ stop on any failed error-level check
  const failed = outcomes.filter((o) => !o.pass && o.level === "error");
  if (failed.length > 0) {
    throw new ValidationFailedError(failed.map((f) => f.check).join(","), failed.map((f) => `${f.check}: ${f.detail}`).join(" | "));
  }

  // ------------------------------------------------------------ provenance
  const prov = (name: SliceInputName, recordId: string, recordVersion: string | null, sourceRelease: string | null, assembly: string | null): Provenance => {
    const r = inputs[name];
    if (!r) throw new Error(`missing input ${name}`);
    const t = SOURCE_TERMS[r.source];
    return { source: r.source, url: r.url, method: r.method, retrievedAt: r.retrievedAt, sourceRelease, recordId, recordVersion, assembly, sha256: r.sha256, licence: t.licence, attribution: t.attribution };
  };
  const A = asm.assembly_name;
  const P = {
    E1: prov("ensemblInfoData", "info/data", null, ensemblRelease, null),
    E2: prov("ensemblAssembly", "homo_sapiens", A, ensemblRelease, A),
    E3: prov("geneLookup", gene.id, String(gene.version), ensemblRelease, A),
    E4: prov("transcriptLookup", tRaw.id, String(tRaw.version), ensemblRelease, A),
    E5: prov("cds", cds.id, String(transcript.id.version), ensemblRelease, A),
    E6: prov("cdna", cdna.id, String(transcript.id.version), ensemblRelease, A),
    E7: prov("ensemblProtein", ensp.id, String(transcript.translation.id.version), ensemblRelease, A),
    U1: prov("uniprot", uni.accession, `entry ${uni.entryVersion}, sequence ${uni.sequenceVersion}`, uniRelease ? `UniProt ${uniRelease}` : null, null),
    H1: prov("hgnc", hgnc.hgncId, null, null, null),
  };
  const PV = V
    ? {
        E8: prov("genomicWindow", V.window.id, null, ensemblRelease, A),
        E9: prov("codonMap", V.sub ? `${tRaw.id} codon ${V.sub.coding.codonNumber}` : `${tRaw.id} c.${V.cdsStart}_${V.cdsEnd}`, String(tRaw.version), ensemblRelease, A),
        E10: prov("variation", V.variation.name, null, ensemblRelease, A),
        E11: prov("variantRecoder", V.variation.name, null, ensemblRelease, A),
        E12: prov("vep", V.vep[0]!.input, null, ensemblRelease, A),
        C1: prov("clinvar", V.cv.accession, V.cv.accessionVersion.split(".")[1] ?? null, V.cvBuild ? `ClinVar ${V.cvBuild}` : null, "GRCh38"),
        C0: inputs.clinvarSearch ? prov("clinvarSearch", `esearch ${V.sel.rsId}`, null, V.cvBuild ? `ClinVar ${V.cvBuild}` : null, null) : null,
      }
    : null;
  const PS = S
    ? {
        P1: prov("mmcif", S.struct.entryId, S.struct.latestRevision.version, S.pdbRelease, null),
        P2: prov("rcsbEntry", S.rEntry.rcsb_id, S.struct.latestRevision.version, S.pdbRelease, null),
        P3: prov("rcsbPolymerEntity", S.rEntity.rcsb_id, S.struct.latestRevision.version, S.pdbRelease, null),
        P4: prov("rcsbAssembly", S.rAsm.rcsb_id, S.struct.latestRevision.version, S.pdbRelease, null),
        S1: prov("sifts", S.pdbId.toLowerCase(), null, null, null),
      }
    : null;
  const sourcesUsed: Provenance[] = [
    P.E1,
    P.E2,
    P.E3,
    P.E4,
    P.E5,
    P.E6,
    P.E7,
    ...(PV ? [PV.E8, PV.E9, PV.E10, PV.E11, PV.E12] : []),
    P.U1,
    ...(PS ? [PS.P1, PS.P2, PS.P3, PS.P4, PS.S1] : []),
    ...(PV ? [PV.C1] : []),
    P.H1,
    ...(PV?.C0 ? [PV.C0] : []),
  ];
  if (af && inputs.alphafoldPrediction && inputs.alphafoldModel) {
    sourcesUsed.push(prov("alphafoldPrediction", af.entryId, String(af.modelVersion), `AlphaFold DB model v${af.modelVersion}`, null));
    sourcesUsed.push(prov("alphafoldModel", af.entryId, String(af.modelVersion), `AlphaFold DB model v${af.modelVersion}`, null));
  }
  // R0 to R3: one row per Reactome request (plan section 12 rule 2), appended after every other source.
  const PR: Provenance[] = PW
    ? [
        prov("reactomeVersion", "data/database/version", null, `Reactome ${PW.release}`, null),
        prov("reactomePathways", `UniProt ${uni.accession} pathways, species 9606`, null, `Reactome ${PW.release}`, null),
        ...PW.memberships.map((m) => prov(ancestorsInput(m.stableId), `${m.stableId} ancestors`, m.stableIdVersion?.split(".")[1] ?? null, `Reactome ${PW.release}`, null)),
        ...PW.memberships.filter((m) => m.participantCount !== null).map((m) => prov(participantsInput(m.stableId), `${m.stableId} participants`, m.stableIdVersion?.split(".")[1] ?? null, `Reactome ${PW.release}`, null)),
      ]
    : [];
  sourcesUsed.push(...PR);
  // O1: the one Open Targets request (plan section 14 rule 2), after the Reactome rows.
  const PO: Provenance | null = AS ? prov("opentargetsAssociations", `target ${AS.ot.ensemblGeneId} associatedDiseases page ${OPEN_TARGETS_PAGE.index} size ${OPEN_TARGETS_PAGE.size}`, null, AS.release, null) : null;
  if (PO) sourcesUsed.push(PO);
  const rp = (record: string, sources: Provenance[], transformations: string[], ev: Evidence[]) => ({
    sources,
    transformations,
    validation: validationFor(record),
    evidenceCategory: ev[0]!.category,
  });

  const iv = (s: number, e: number, strand: number) => interval(gene.assembly_name, gene.seq_region_name, s, e, strand, { assemblyPatch: A });
  const chrAcc = V ? (parseVersioned(V.hgvsg.split(":")[0]!).id.startsWith("NC_") ? V.hgvsg.split(":")[0]! : null) : null;

  // ------------------------------------------------------------ records
  const geneEv = [evidence("curated-database-annotation", `${gene.display_name} (${gene.id}.${gene.version}) is annotated on ${gene.assembly_name} chromosome ${gene.seq_region_name}:${gene.start}-${gene.end}, strand ${gene.strand}.`)];
  const geneRec = Gene.parse({
    kind: "gene",
    id: { id: gene.id, version: gene.version },
    symbol: gene.display_name,
    description: gene.description ?? "",
    biotype: gene.biotype,
    interval: iv(gene.start, gene.end, gene.strand),
    hgncId: hgnc.hgncId,
    aliases: [...hgnc.aliases].sort(),
    ncbiGeneId: hgnc.ncbiGeneId,
    transcriptCount: gene.Transcript.length,
    selection: sel.selection,
    evidence: geneEv,
    provenance: rp("gene", [P.E3, P.E2, P.H1], ["field-select", "normalise-interval", "select-transcript", "hgnc-resolve"], geneEv),
  });

  const trEv = [evidence("curated-database-annotation", `${formatVersioned(transcript.id)} is the MANE Select transcript (RefSeq match ${transcript.refSeqMatch ? formatVersioned(transcript.refSeqMatch) : "none"}).`)];
  const trRec = TranscriptRecord.parse({ kind: "transcript", ...transcript, evidence: trEv, provenance: rp("transcript", [P.E4, P.E3], ["field-select", "normalise-interval", "rank-exons"], trEv) });

  const seqEv = (what: string) => [evidence("curated-database-annotation", `${what} as served by Ensembl.`)];
  const seqRec = (kind: "cds" | "cdna" | "protein" | "genomic", id: string, s: string, sha: string, src: Provenance[], what: string, ivl: ReturnType<typeof iv> | null) =>
    Sequence.parse({ kind: "sequence", sequenceKind: kind, sourceId: id, alphabet: kind === "protein" ? "protein" : "dna", sequence: s, length: s.length, sha256: sha, interval: ivl, evidence: seqEv(what), provenance: rp("sequences", src, ["parse-fasta", "uppercase"], seqEv(what)) });

  const seqSha = {
    cds: await sha256Hex(cds.sequence),
    cdna: await sha256Hex(cdna.sequence),
    protein: await sha256Hex(ensp.sequence),
    genomic: V ? await sha256Hex(V.window.seq.toUpperCase()) : null,
  };
  const assemble = (): SliceBuild => {
    const files: SliceFile[] = [];
    const add = (path: string, recordKind: string, record: unknown): void => {
      files.push({ path, recordKind, content: typeof record === "string" ? record : stable(record) });
    };
    add("gene.json", "gene", geneRec);
    add("transcript.json", "transcript", trRec);
    add(
      "sequences.json",
      "sequence-set",
      {
        kind: "sequence-set",
        records: [
          seqRec("cds", cds.id, cds.sequence, seqSha.cds, [P.E5], `CDS of ${cds.id}`, null),
          seqRec("cdna", cdna.id, cdna.sequence, seqSha.cdna, [P.E6], `cDNA of ${cdna.id}`, null),
          seqRec("protein", ensp.id, ensp.sequence, seqSha.protein, [P.E7], `Translation ${ensp.id}`, null),
          ...(V && PV ? [seqRec("genomic", V.window.id, V.window.seq.toUpperCase(), seqSha.genomic!, [PV.E8], `Forward-strand genomic window ${V.window.id} around the variant`, { ...iv(V.winStart, V.winEnd, 1), refSeqAccession: chrAcc })] : []),
        ],
      },
    );

    const protEv = [
      evidence("curated-database-annotation", `${uni.accession} (${uni.entryName}) canonical sequence, ${uni.length} aa; initiator Met ${initMet ? initMet.description.toLowerCase() : "not annotated as removed"}; chain ${chainF ? `${chainF.start}-${chainF.end}` : "not annotated"}.`, { qualifier: initMet?.evidences.join("; ") ?? null }),
    ];
    const protRec = Protein.parse({
      kind: "protein",
      accession: uni.accession,
      entryName: uni.entryName,
      reviewed: uni.reviewed,
      isoform: { isoformId: "canonical", isCanonical: true },
      entryVersion: uni.entryVersion,
      sequenceVersion: uni.sequenceVersion,
      sequence: uni.sequence,
      length: uni.length,
      md5: uni.md5.toUpperCase(),
      crc64: uni.crc64.toUpperCase(),
      numbering: "translated",
      processedChain: chainF ? { start: chainF.start, end: chainF.end, featureId: chainF.featureId } : null,
      initiatorMethionineRemoved: initMet !== undefined && /removed/i.test(initMet.description),
      // Natural variants are kept only at the selected variant's position; with no variant selected, none is kept.
      features: uni.features.filter((f) => f.type !== "Natural variant" || (V !== null && f.start <= V.uniPos && f.end >= V.uniPos)),
      xrefs: { maneSelect: uni.maneSelect, ensembl: uni.ensembl, pdb: uni.pdb.filter((p) => p.id === config.pdbId) },
      comments: uni.comments,
      evidence: protEv,
      provenance: rp("protein", [P.U1], ["field-select", "drop-proprietary-xrefs", V ? "natural-variants-at-position-only" : "natural-variants-dropped-no-variant-selected", "pdb-xrefs-of-selected-entry-only"], protEv),
    });
    add(`protein-${uni.accession}.json`, "protein", protRec);

    if (V && PV) {
      const { tc, cv, cv37, natVar, uniPos, mature, mLabel, related, cvStars, cvConflicts, cvBasis, cvBuild } = V;
      /** The variant record's UniProt line: the matching natural variant, or the absence stated (P9.2.3). */
      const uniprotVariantEvidence = (text: string): ReturnType<typeof evidence> => (natVar ? evidence("curated-database-annotation", text, { qualifier: natVar.evidences.join("; ") }) : evidence("curated-database-annotation", `${V.natAbsentText.replace(/; nothing to cross-check$/, "")}; the variant is known to this set from ClinVar and the reference sequences only.`));
      const clinvarSummary = {
        accession: cv.accession,
        accessionVersion: cv.accessionVersion,
        title: cv.title,
        classification: cv.classification,
        reviewStatus: cv.reviewStatus,
        lastEvaluated: cv.lastEvaluated,
        proteinChange: cv.proteinChange,
        supportingSubmissionCount: cv.supportingSubmissionCount,
        traitCount: cv.traitCount,
        traitNote: "Trait names are not stored: ClinVar aggregates them across submissions, so they are not a list of effects of this variant, and some carry proprietary identifiers.",
      };
      const commonVar = {
        kind: "variant" as const,
        key: V.hgvsg,
        commonName: V.sel.commonName,
        rsId: V.variation.name,
        rsAlleles: V.rsAlleles,
        allele: { reference: V.refForward, alternate: V.altForward, strand: 1 as const },
        location: { ...iv(V.gStart, V.gEnd, 1), refSeqAccession: chrAcc },
        locationGRCh37: cv37 ? interval("GRCh37", cv37.chromosome, cv37.start, cv37.stop, 1) : null,
        hgvs: { genomic: V.hgvsg, coding: [...V.hgvsc].sort(), protein: [...V.hgvsp].sort() },
        spdi: V.spdi,
        transcript: transcript.id,
        cdnaPosition: tc.cdna_start ?? null,
        consequence: { terms: tc.consequence_terms, codons: tc.codons ?? "", source: `Ensembl VEP (${ensemblRelease})` },
        clinvar: clinvarSummary,
      };
      const varSources = [PV.E11, PV.E10, PV.E12, PV.E9, PV.E8, P.E5, P.U1, PV.C1];
      let varRec: z.infer<typeof Variant>;
      if (V.sub) {
        const allele = V.sub;
        const varEv = [
          evidence(classifyClinvarReview(cv.reviewStatus), `ClinVar ${cv.accessionVersion}: ${cv.classification}.`, { qualifier: cv.reviewStatus }),
          uniprotVariantEvidence(natVar ? `UniProt ${natVar.featureId}: ${natVar.originalSequence} to ${natVar.alternativeSequences.join("/")} at position ${natVar.start} (${natVar.description}).` : ""),
          evidence("reference-sequence-derivation", `${allele.hgvsc[0]} changes codon ${allele.coding.codonNumber} ${allele.coding.refCodon} to ${allele.coding.altCodon}, giving ${allele.coding.proteinChange} by translation.`),
          evidence("computational-prediction", `VEP consequence on ${transcript.id.id}: ${tc.consequence_terms.join(", ")}.`),
        ];
        // The field order of the pre-Phase 9 record is kept so the HBB file stays byte-identical.
        varRec = Variant.parse({
          kind: "variant",
          key: commonVar.key,
          commonName: commonVar.commonName,
          rsId: commonVar.rsId,
          rsAlleles: commonVar.rsAlleles,
          allele: commonVar.allele,
          location: commonVar.location,
          locationGRCh37: commonVar.locationGRCh37,
          hgvs: commonVar.hgvs,
          spdi: commonVar.spdi,
          transcript: commonVar.transcript,
          cdsPosition: allele.coding.cdsPosition,
          cdnaPosition: commonVar.cdnaPosition,
          codon: { number: allele.coding.codonNumber, reference: allele.coding.refCodon, alternate: allele.coding.altCodon, genomic: iv(V.span.start, V.span.end, transcript.interval.strand) },
          aminoAcids: { reference: allele.coding.refAa, alternate: allele.coding.altAa },
          proteinChangeComputed: allele.coding.proteinChange,
          numbering: {
            translatedPosition: uniPos,
            maturePosition: mature,
            matureLabel: mLabel,
            translatedLabel: translatedLabel(allele.coding.refAa, uniPos, allele.coding.altAa),
          },
          consequence: commonVar.consequence,
          clinvar: commonVar.clinvar,
          evidence: varEv,
          provenance: rp("variant", varSources, ["select-allele", "filter-hgvs-to-selected-transcript", "apply-substitution-to-cds", "translate-codon", "exon-walk", "mature-index", "drop-trait-names"], varEv),
        });
      } else {
        // The deletion record (plan section 11 rule 2).
        const d = V.del!;
        const cd = d.coding;
        const first = cd.affectedCodons[0]!;
        const last = cd.affectedCodons[cd.affectedCodons.length - 1]!;
        const deletedAas = cd.deletedResidues.map((r) => r.aminoAcid).join("");
        const three = (aa: string): string => AA_THREE_LETTER[aa] ?? aa;
        const codonText = cd.affectedCodons.map((c) => (c.afterDeletion === null ? `codon ${c.number} ${c.reference} (${three(c.referenceAminoAcid)}) is deleted` : `codon ${c.number} ${c.reference} becomes ${c.afterDeletion} (${three(c.referenceAminoAcid)}${c.aminoAcidAfterDeletion === c.referenceAminoAcid ? ", unchanged" : ` to ${three(c.aminoAcidAfterDeletion!)}`})`)).join(", ");
        const varEv = [
          evidence(classifyClinvarReview(cv.reviewStatus), `ClinVar ${cv.accessionVersion}: ${cv.classification}.`, { qualifier: cv.reviewStatus }),
          uniprotVariantEvidence(natVar ? `UniProt ${natVar.featureId}: ${natVar.originalSequence ?? deletedAas} missing at position ${natVar.start}${natVar.end !== natVar.start ? `-${natVar.end}` : ""} (${natVar.description}).` : ""),
          evidence("reference-sequence-derivation", `${formatVersioned(transcript.id)}:${d.hgvsC} deletes ${cd.length} bases (${cd.deletedBases}) across codons ${first.number} to ${last.number}: ${codonText}; translating the CDS before and after gives ${cd.proteinChange}, the reading frame is kept.`),
          evidence("computational-prediction", `VEP consequence on ${transcript.id.id}: ${tc.consequence_terms.join(", ")}.`),
        ];
        varRec = Variant.parse({
          ...commonVar,
          variantKind: "deletion",
          cdsPosition: cd.cdsStart,
          deletedSpan: { cdsStart: cd.cdsStart, cdsEnd: cd.cdsEnd, length: cd.length, genomic: iv(V.span.start, V.span.end, transcript.interval.strand) },
          affectedCodons: cd.affectedCodons.map((c) => {
            const s = codonGenomicSpan(transcript, c.number);
            return { ...c, genomic: iv(s.start, s.end, transcript.interval.strand) };
          }),
          residue: cd.residue,
          deletedResidues: cd.deletedResidues,
          proteinChangeComputed: cd.proteinChange,
          numbering: {
            translatedPosition: uniPos,
            maturePosition: mature,
            matureLabel: mLabel,
            translatedLabel: translatedDeletionLabel(cd.proteinChange),
          },
          evidence: varEv,
          provenance: rp("variant", varSources, ["select-allele-by-hgvsc", "filter-hgvs-to-selected-transcript", "apply-deletion-to-cds", "translate-affected-codons", "protein-level-three-prime-normalisation", "exon-walk", "mature-index", "drop-trait-names"], varEv),
        });
      }
      add(`variant-${V.sel.slug}.json`, "variant", varRec);

      const versionNo = Number(cv.accessionVersion.split(".")[1]);
      const haplos = related.filter((r) => r.relation === "haplotype-or-compound");
      const others = related.filter((r) => r.relation === "other-allele-or-variant");
      const cvEv = [
        evidence(cvBasis, `ClinVar ${cv.accessionVersion} review status: ${cv.reviewStatus}${cvStars === null ? "" : ` (${cvStars} of 4 review stars in ClinVar's scale)`}; ${cvConflicts.conflicting ? "ClinVar reports conflicting classifications" : "ClinVar reports no conflicting classifications for this record"}.`, {
          qualifier: `classification ${cv.classification}; ${cv.supportingSubmissionCount} supporting submissions; last evaluated ${cv.lastEvaluated ?? "not given"}`,
          limitations: ["The review status describes how the submissions were assessed, not the strength of any clinical claim; HELIX is nonclinical."],
        }),
        evidence("curated-database-annotation", `ClinVar returns ${related.length} other record(s) for ${V.sel.rsId}: ${haplos.length} haplotype or compound record(s), of which ${haplos.filter((r) => r.includesThisAllele).length} include this allele together with another variant, and ${others.length} record(s) of a different allele or variant. They are listed separately and never merged with ${cv.accession}.`, {
          limitations: ["A haplotype record classifies the combination of variants, not this allele alone."],
        }),
      ];
      const cvRec = ClinvarRecordEntry.parse({
        kind: "clinvar-record",
        variantKey: V.hgvsg,
        uid: cv.uid,
        accession: cv.accession,
        accessionVersion: cv.accessionVersion,
        recordVersion: versionNo,
        clinvarBuild: cvBuild,
        objectType: cv.objectType,
        title: cv.title,
        canonicalSpdi: cv.canonicalSpdi,
        classification: cv.classification,
        reviewStatus: cv.reviewStatus,
        reviewStars: cvStars,
        conflicts: cvConflicts,
        lastEvaluated: cv.lastEvaluated,
        supportingSubmissionCount: cv.supportingSubmissionCount,
        traitCount: cv.traitCount,
        traitNote: "Trait names are not stored: ClinVar aggregates them across submissions, so they are not a list of effects of this variant, and some carry proprietary identifiers.",
        otherClassifications: { clinicalImpact: cv.clinicalImpact, oncogenicity: cv.oncogenicity },
        relatedRecords: related,
        evidence: cvEv,
        provenance: rp("clinvar-record", [...(PV.C0 ? [PV.C0] : []), PV.C1], ["esearch-by-rsid", "esummary-all-uids", "drop-trait-names", "review-stars-from-clinvar-table", "conflicts-from-review-status", "related-records-kept-separate"], cvEv),
      });
      add(`clinvar-${V.sel.slug}.json`, "clinvar-record", cvRec);
    }

    if (S && PS) {
      const { struct, sifts, entityId, segments, ent, xc, rRegion, residues, chainMap, tableRows, row7, nameMismatch, seqMismatch, alnMismatch, polymerAsyms, defaultAssembly, contactChains, coverage, hydrogens } = S;
      // An NMR entry states no resolution: the statement names the ensemble and the model shown instead (P9.2.2 rule 2).
      const structEv = [
        evidence(
          "experimental-structure-observation",
          struct.resolution === null
            ? `${struct.entryId}: ${struct.method}, no resolution (an ensemble of ${struct.modelCount} models; model 1 is the one shown), deposited ${struct.depositionDate}.`
            : `${struct.entryId}: ${struct.method}, ${struct.resolution} A resolution, deposited ${struct.depositionDate}.`,
        ),
        evidence("curated-database-annotation", `${coverage.text}; SIFTS maps ${coverage.mappedPositions} position(s) of ${coverage.uniprotAccession} onto chain(s) ${coverage.chains.join(", ")}.`, {
          limitations: coverage.fraction < 1 ? [`The entry covers ${coverage.observedPositions} of the protein's ${coverage.proteinLength} residues; the rest has no experimental coordinates in this set, and a predicted model never stands in for it.`] : [],
        }),
      ];
      const uniprotFromEntry = (e: { id: string }): string[] => [...new Set(struct.structRef.filter((r) => r.entityId === e.id && r.dbName === "UNP" && r.dbAccession !== null).map((r) => r.dbAccession!))].sort();
      const entities = struct.entities.map((e) => {
        const strands = new Set(e.strandIds);
        return {
          entityId: e.id,
          type: e.type,
          description: e.description,
          moleculeCount: e.moleculeCount,
          mutation: e.mutation ? { text: e.mutation, numbering: classifyPdbxMutation(e.mutation, e.id === entityId ? uni.sequence : "", e.id === entityId ? chainRange : null) } : null,
          sequence: e.sequenceCanonical,
          strandIds: e.strandIds,
          siftsUniprot: [...new Set(sifts.filter((s) => s.entityId === e.id).map((s) => s.uniprotAccession))].sort(),
          uniprotFromEntry: uniprotFromEntry(e),
          sequenceDifferences: struct.structRefSeqDif
            .filter((d) => strands.has(d.strandId))
            .map((d) => ({ strandId: d.strandId, labelSeqId: d.seqNum, residue: d.monId, referenceResidue: d.dbMonId, referencePosition: d.dbSeqNum, details: d.details })),
        };
      });
      const partners = struct.entities
        .filter((e) => e.type === "polymer" && e.id !== entityId)
        .map((e) => ({ entityId: e.id, description: e.description, strandIds: e.strandIds, uniprotAccession: uniprotFromEntry(e)[0] ?? null, siftsUniprot: [...new Set(sifts.filter((s) => s.entityId === e.id).map((s) => s.uniprotAccession))].sort() }));
      const authOf = new Map<string, string>();
      for (const r of struct.polySeqScheme) authOf.set(r.labelAsymId, r.authAsymId);
      for (const r of struct.nonpolyScheme) if (!authOf.has(r.labelAsymId)) authOf.set(r.labelAsymId, r.authAsymId);
      const chains = struct.structAsym
        .map((a) => ({ labelAsymId: a.id, authAsymId: authOf.get(a.id) ?? "?", entityId: a.entityId, entityType: (struct.entities.find((e) => e.id === a.entityId)?.type ?? "polymer") as "polymer" }))
        .sort((x, y) => x.labelAsymId.localeCompare(y.labelAsymId));
      const cifPath = `${struct.entryId}.cif`;
      const mmcifBody = need("mmcif");
      const structRec = Structure.parse({
        kind: "structure",
        entryId: struct.entryId,
        title: struct.title,
        method: struct.method,
        origin: "experimental",
        resolutionAngstrom: struct.resolution,
        modelCount: struct.modelCount,
        modelShown: 1,
        nmrEnsemble: struct.nmrEnsemble,
        revision: struct.latestRevision,
        depositionDate: struct.depositionDate,
        citation: struct.primaryCitation,
        entities,
        mappedEntityId: entityId,
        coverage,
        partners,
        chains,
        assemblies: struct.assemblies.map((a) => ({ ...a, polymerAsymIds: a.asymIds.filter((x) => polymerAsyms.has(x)) })),
        defaultAssemblyId: defaultAssembly.id,
        modelFile: { path: cifPath, format: "mmcif", sha256: mmcifBody.sha256, bytes: new TextEncoder().encode(mmcifBody.body).byteLength },
        evidence: structEv,
        provenance: rp("structure", [PS.P1, PS.P2, PS.P3, PS.P4, PS.S1], ["parse-mmcif", "field-select", "sifts-entity-selection", "classify-pdbx-mutation-numbering", "coverage-from-sifts-and-atom-site", "partners-from-struct-ref"], structEv),
      });
      add(`structure-${struct.entryId}.json`, "structure", structRec);
      add(cifPath, "mmcif", mmcifBody.body);

      if (V && residues) {
        const uniPos = V.uniPos;
        const mapEv = [
          evidence("experimental-structure-observation", `Residue ${residues.map((r) => `${r.authAsymId} ${r.authSeqId}`).join(", ")} is ${residues[0]!.compId} in the deposited coordinates of ${struct.entryId} (atom_site).`),
          evidence("curated-database-annotation", `SIFTS maps ${config.uniprotAccession} ${segments[0]!.unpStart}-${segments[0]!.unpEnd} to ${struct.entryId} entity ${entityId} residues ${segments[0]!.labelSeqStart}-${segments[0]!.labelSeqEnd}.`, { qualifier: `identity ${segments[0]!.identity}, coverage ${segments[0]!.coverage}` }),
        ];
        const mapRec = ResidueMapping.parse({
          kind: "residue-mapping",
          uniprotAccession: config.uniprotAccession,
          uniprotPosition: uniPos,
          uniprotResidue: uni.sequence[uniPos - 1],
          maturePosition: V.mature,
          entryId: struct.entryId,
          entityId,
          method: "sifts",
          crossChecks: [
            { method: "global alignment of entity sequence to UniProt", agrees: xc.agrees, detail: `offset ${xc.alignment.constantOffset}, identity ${xc.alignment.identity.toFixed(4)}, ${xc.alignment.mismatches.length} mismatch(es): ${xc.alignment.mismatches.map((m) => `entity ${m.queryPos} ${m.query} vs UniProt ${m.referencePos} ${m.reference}`).join("; ")}` },
            { method: "RCSB rcsb_polymer_entity_align (SIFTS provenance)", agrees: rRegion !== undefined && rRegion.ref_beg_seq_id - rRegion.entity_beg_seq_id === xc.siftsOffset, detail: `ref_beg ${rRegion?.ref_beg_seq_id} <-> entity_beg ${rRegion?.entity_beg_seq_id}, length ${rRegion?.length}` },
            { method: "mmCIF _struct_ref_seq (not used)", agrees: knownIssues.every((k) => !k.id.startsWith("struct-ref-seq")), detail: knownIssues.filter((k) => k.id.startsWith("struct-ref-seq")).map((k) => k.detail)[0] ?? "agrees with SIFTS" },
          ],
          residues,
          evidence: mapEv,
          provenance: rp("residue-mapping", [PS.S1, PS.P1, PS.P3, P.U1], ["sifts-segment-lookup", "poly-seq-scheme-auth-ids", "atom-site-residue-name", "alignment-cross-check"], mapEv),
        });
        add(`residue-mapping-${V.sel.slug}-${struct.entryId}.json`, "residue-mapping", mapRec);
      }

      const tblEv = [
        evidence(
          "curated-database-annotation",
          `Full-chain mapping of record: SIFTS maps ${config.uniprotAccession} positions ${tableRows[0]!.uniprotPosition}-${tableRows.at(-1)!.uniprotPosition} onto ${struct.entryId} entity ${entityId}, chains ${chainMap.chains.join(", ")}; auth ids from pdbx_poly_seq_scheme, residue names from atom_site.`,
          { qualifier: segments.map((sg) => `${sg.labelAsymId}: identity ${sg.identity}, coverage ${sg.coverage}`).join("; ") },
        ),
        evidence(
          "experimental-structure-observation",
          `In the deposited coordinates of ${struct.entryId}, the residue at every mapped position equals the UniProt residue except at ${nameMismatch.map((r) => `position ${r.uniprotPosition} (${[...new Set(r.residues.map((x) => x.compId))].join("/")}${V ? `, the ${V.sel.commonName} residue` : ""})`).join(", ") || "no position"}.`,
        ),
      ];
      const tblRec = ResidueMappingTable.parse({
        kind: "residue-mapping-table",
        uniprotAccession: config.uniprotAccession,
        entryId: struct.entryId,
        entityId,
        method: "sifts",
        segments: segments.map((sg) => ({ labelAsymId: sg.labelAsymId, authAsymId: sg.authAsymId, unpStart: sg.unpStart, unpEnd: sg.unpEnd, labelSeqStart: sg.labelSeqStart, labelSeqEnd: sg.labelSeqEnd, identity: sg.identity })).sort((a, b) => a.labelAsymId.localeCompare(b.labelAsymId)),
        chains: chainMap.chains,
        coverage: { firstUniprotPosition: tableRows[0]!.uniprotPosition, lastUniprotPosition: tableRows.at(-1)!.uniprotPosition, positions: tableRows.length },
        crossChecks: [
          { method: "global alignment of entity sequence to UniProt", agrees: xc.agrees && seqMismatch.join(",") === alnMismatch.join(","), detail: `offset ${xc.alignment.constantOffset}; mismatching positions ${alnMismatch.join(", ") || "none"}, the same as the table's` },
          { method: "RCSB rcsb_polymer_entity_align (SIFTS provenance)", agrees: rRegion !== undefined && rRegion.ref_beg_seq_id - rRegion.entity_beg_seq_id === xc.siftsOffset, detail: `ref_beg ${rRegion?.ref_beg_seq_id} <-> entity_beg ${rRegion?.entity_beg_seq_id}, length ${rRegion?.length}` },
          ...(V && residues ? [{ method: "variant mapping record (same SIFTS record, one position)", agrees: row7 !== undefined && row7.residues.every((x, i) => sameResidue(x, residues[i]!)), detail: `position ${V.uniPos} identical in both records` }] : []),
          { method: "mmCIF _struct_ref_seq (not used)", agrees: knownIssues.every((k) => !k.id.startsWith("struct-ref-seq")), detail: knownIssues.filter((k) => k.id.startsWith("struct-ref-seq")).map((k) => k.detail)[0] ?? "agrees with SIFTS" },
        ],
        positions: tableRows,
        evidence: tblEv,
        provenance: rp("residue-mapping-table", [PS.S1, PS.P1, PS.P3, P.U1], ["sifts-segment-lookup-per-position", "poly-seq-scheme-auth-ids", "atom-site-residue-name", "alignment-cross-check", "unobserved-residues-recorded"], tblEv),
      });
      add(`residue-mapping-${config.uniprotAccession}-${struct.entryId}.json`, "residue-mapping-table", tblRec);

      if (V && residues && contactChains) {
        const withContacts = contactChains.filter((c) => c.contacts.some((x) => x.compId !== "HOH"));
        const without = contactChains.filter((c) => !c.contacts.some((x) => x.compId !== "HOH"));
        const singleChain = S.siftsChains.length === 1;
        const isDiffraction = /DIFFRACTION/i.test(struct.method);
        // Phase 9: a deleted residue is named as such; a single-chain entry lists the residues of its own chain.
        const sideChain = V.del ? `${residues[0]!.compId} side chain (${V.refAa}${V.uniPos}, the residue deleted in ${V.sel.commonName})` : `${residues[0]!.compId} side chain`;
        const scopeNote = `${singleChain ? " (the residue's own chain included beyond its covalent neighbours, since the entry has one mapped chain)" : ""}${hydrogens ? " (heavy atoms on both sides; the entry's hydrogen atoms are not counted)" : ""}`;
        const contactText = (c: (typeof contactChains)[number]): string => {
          const prot = c.contacts.filter((x) => x.compId !== "HOH");
          return singleChain ? `chain ${c.residue.authAsymId} contacts residue(s) ${prot.map((x) => `${x.authAsymId}${x.authSeqId} ${x.compId}`).join(", ")}` : `chain ${c.residue.authAsymId} contacts chain(s) ${[...new Set(prot.map((x) => x.authAsymId))].join(",")}`;
        };
        const conEv = [
          evidence("computed-from-experimental-data", `Within ${config.contactCutoffAngstrom} A of the ${sideChain}, in the asymmetric unit${scopeNote}: ${withContacts.map(contactText).join("; ") || (singleChain ? "no protein contacts" : "no inter-chain protein contacts")}.`),
          ...(without.length > 0 && isDiffraction
            ? [evidence("inference-not-verified", `Chains ${without.map((c) => c.residue.authAsymId).join(", ")} show no protein contact inside the asymmetric unit; they may contact symmetry-related molecules, which were not generated.`)]
            : []),
          ...(without.length > 0 && !isDiffraction
            ? [evidence("experimental-structure-observation", `Chains ${without.map((c) => c.residue.authAsymId).join(", ")} show no protein contact within the cutoff; the entry is not a crystal structure, so there are no symmetry-related molecules to consider.`)]
            : []),
        ];
        const conRec = ResidueContacts.parse({
          kind: "residue-contacts",
          entryId: struct.entryId,
          scope: `${singleChain ? "asymmetric unit, model 1, no symmetry mates; the residue's own chain included beyond its covalent neighbours (one mapped chain)" : "asymmetric unit, model 1, no symmetry mates"}${hydrogens ? "; heavy atoms only (the entry deposits hydrogen atoms, which are not counted)" : ""}`,
          cutoffAngstrom: config.contactCutoffAngstrom,
          numbering: "auth_asym_id / auth_seq_id",
          chains: contactChains,
          evidence: conEv,
          provenance: rp("residue-contacts", [PS.P1], ["parse-mmcif", "side-chain-atoms-beyond-cb", "distance-cutoff"], conEv),
        });
        add(`contacts-${V.sel.slug}-${struct.entryId}.json`, "residue-contacts", conRec);
      }
    }

    let pmRec: z.infer<typeof PredictedModel> | null = null;
    if (af && afDisclaimer) {
      const pmEv = [evidence("computational-prediction", `${af.entryId} is a predicted model (AlphaFold DB v${af.modelVersion}, ${af.toolUsed ?? "AlphaFold"}), global pLDDT ${af.globalPlddt}.`, { qualifier: af.globalPlddt === null ? null : `global pLDDT ${af.globalPlddt}` })];
      pmRec = PredictedModel.parse({
        kind: "predicted-model",
        modelId: af.entryId,
        modelVersion: af.modelVersion,
        uniprotAccession: af.uniprotAccession,
        uniprotRange: { start: af.uniprotStart, end: af.uniprotEnd },
        modelCreatedDate: af.modelCreatedDate,
        globalPlddt: af.globalPlddt,
        plddtFractions: af.plddtFractions,
        sequenceChecksumMatchesUniprot: af.sequenceChecksumMd5 === uni.md5.toUpperCase(),
        disclaimer: afDisclaimer,
        usableForVariantPlacement: false,
        evidence: pmEv,
        provenance: rp("predicted-model", sourcesUsed.filter((s) => s.source === "alphafold"), ["field-select", "keep-in-file-disclaimer"], pmEv),
      });
      add(`predicted-model-${af.entryId}.json`, "predicted-model", pmRec);
    }

    // The pathways that list the protein (plan section 12 rule 2): written when the specification asks, an empty
    // list when no pathway lists the protein; derived from the protein record; one provenance row per request.
    if (PW) {
      const pwEv = [
        evidence(
          "curated-database-annotation",
          `Reactome ${PW.release} lists ${uni.accession} in ${PW.memberships.length} human pathway(s); the participants of ${PW.participantSets.length} candidate membership(s) are kept${PW.opening ? `; the world opens on ${PW.opening.name} (${PW.opening.stableId}), the rule's choice` : PW.memberships.length > 0 ? `; no opening pathway: ${PW.choice.reason}` : ""}.`,
          {
            qualifier: `Reactome database version ${PW.release}`,
            limitations: [
              "Membership says that the protein takes part in a curated pathway, never how, and never that a variant changes the pathway.",
              "The opening pathway is the rule's choice (fewest participating physical entities among the non-disease memberships with a diagram), not a statement of importance; no membership ranks above the others.",
            ],
          },
        ),
      ];
      const pwRec = PathwayMembershipsRecord.parse({
        kind: "pathway-memberships",
        derivedFrom: [`protein-${uni.accession}.json`],
        accession: uni.accession,
        species: REACTOME_HUMAN_SPECIES,
        release: PW.release,
        membershipCount: PW.memberships.length,
        memberships: PW.memberships,
        participantsByPathway: PW.participantSets,
        openingPathway: PW.opening,
        participantsNote:
          "A participant is one participating physical entity Reactome returns for the pathway (a complex, a defined or candidate set, a protein with a sequence, a small molecule, ...) with the UniProt reference gene products Reactome lists among its members; complexes and sets are not expanded further than that list. Counts are of physical entities. The participants response does not state each entity's species; the pathway itself is a Homo sapiens pathway. Participants are kept for every candidate of the opening rule (non-disease, with a diagram); the memberships the rule excluded have none.",
        evidence: pwEv,
        provenance: rp("pathways", PR, ["field-select", "sort-by-stable-id", "top-level-from-ancestors", "participants-of-rule-candidates", "opening-by-rule", "uniprot-proteins-from-reference-entities", "flag-set-protein"], pwEv),
      });
      add("pathways.json", "pathway-memberships", pwRec);
    }

    // The disease associations of the gene (plan section 14 rule 2): written when the specification asks, an empty
    // list when the platform lists none; derived from the gene record; one provenance row, the one request.
    if (AS && PO) {
      const top = AS.rows[0] ?? null;
      const asEv = [
        evidence(
          "curated-database-annotation",
          `${AS.release} lists ${AS.ot.count} disease association${AS.ot.count === 1 ? "" : "s"} for ${gene.display_name} (${gene.id}); the ${AS.rows.length} highest-scoring are kept${top ? `, the top being ${top.diseaseName} (${top.diseaseId}, score ${top.score})` : ""}.`,
          {
            qualifier: `Open Targets api ${AS.ot.apiVersion}, data ${AS.ot.dataVersion}`,
            limitations: [
              `An Open Targets ${ASSOCIATION_NEVER_CAUSAL}.`,
              `The overall score and the datatype scores are the platform's aggregates over every datasource, including the ${AS.ot.droppedDatasourceIds.length > 0 ? `dropped ones (${AS.ot.droppedDatasourceIds.join(", ")})` : "sources whose scores would be dropped (none appeared in this response)"}; the kept datasource scores exclude ${EXCLUDED_DATASOURCES.join(", ")}.`,
            ],
          },
        ),
      ];
      const asRec = DiseaseAssociationsRecord.parse({
        kind: "disease-associations",
        derivedFrom: ["gene.json"],
        ensemblGeneId: AS.ot.ensemblGeneId,
        approvedSymbol: AS.ot.approvedSymbol,
        platform: { apiVersion: AS.ot.apiVersion, dataVersion: AS.ot.dataVersion },
        request: { pageIndex: OPEN_TARGETS_PAGE.index, pageSize: OPEN_TARGETS_PAGE.size, orderByScore: true },
        count: AS.ot.count,
        keptCount: AS.rows.length,
        associations: AS.rows,
        droppedDatasources: { excluded: [...EXCLUDED_DATASOURCES], observed: AS.ot.droppedDatasourceIds, reason: EXCLUDED_DATASOURCES_REASON },
        datasourceIdsObserved: AS.ot.datasourceIdsObserved,
        note: ASSOCIATION_NEVER_CAUSAL,
        evidence: asEv,
        provenance: rp("associations", [PO], ["field-select", "drop-excluded-datasource-scores", "keep-platform-order"], asEv),
      });
      add("associations.json", "disease-associations", asRec);
    }

    // Verified mappings: the variant position when a variant is selected, otherwise every position of the full-chain table.
    const verifiedMappings = S ? (V ? [{ entryId: S.struct.entryId, uniprotPosition: V.uniPos }] : S.tableRows.map((r) => ({ entryId: S.struct.entryId, uniprotPosition: r.uniprotPosition }))) : [];
    const capRec = CapabilityReport.parse({
      ...capabilities({
        geneId: gene.id,
        symbol: gene.display_name,
        biotype: gene.biotype,
        transcriptSelection: sel.selection,
        hasTranslation: transcript.translation !== null,
        protein: { accession: uni.accession, sequenceVerified: true },
        experimentalStructures: uni.pdb.map((p) => ({ entryId: p.id, method: p.method })).sort((a, b) => a.entryId.localeCompare(b.entryId)),
        selectedStructure: S ? { entryId: S.struct.entryId, coverage: S.coverage.text } : null,
        verifiedMappings,
        predictedModel: pmRec ? { modelId: pmRec.modelId, version: pmRec.modelVersion } : null,
        variantPositions: V ? [V.uniPos] : [],
        pathways: PW ? { membershipCount: PW.memberships.length, opening: PW.opening ? { stableId: PW.opening.stableId, name: PW.opening.name } : null, reason: PW.choice.reason } : null,
        associations: AS ? { count: AS.ot.count, kept: AS.rows.length, top: AS.rows[0] ? { diseaseName: AS.rows[0].diseaseName, score: AS.rows[0].score } : null } : null,
      }),
      derivedFrom: files.map((f) => f.path).filter((p) => p.endsWith(".json")),
    });
    add("capabilities.json", "capabilities", capRec);

    // The set's questions (plan section 11 rule 6): curator text from the specification, written after the
    // capability report it refers to; a set that offers no question and no bridge question has no record.
    if (config.questions.length > 0 || config.bridgeQuestion !== undefined) {
      const qRec = QuestionsRecord.parse({
        kind: "questions",
        derivedFrom: ["capabilities.json"],
        geneId: gene.id,
        symbol: gene.display_name,
        questions: config.questions,
        bridgeQuestion: config.bridgeQuestion ?? null,
      });
      add("questions.json", "questions", qRec);
    }

    for (const f of files) if (f.recordKind !== "mmcif") assertNoProprietaryIdentifiers(JSON.parse(f.content));
    if (S) assertNoProprietaryIdentifiers(need("mmcif").body.slice(0, 200_000));

    const used = new Set(sourcesUsed.map((s) => s.source));
    return {
      files,
      sources: sourcesUsed,
      validation: outcomes.map((o) => ({ check: o.check, result: o.pass ? "pass" : o.level === "warn" ? "warn" : "fail", detail: o.detail, at: ctx.now })),
      knownIssues,
      drift,
      attribution: [...used].sort().map((s) => ({ source: s, licence: SOURCE_TERMS[s].licence, text: SOURCE_TERMS[s].attribution })),
      summary: {
        gene: `${gene.id}.${gene.version}`,
        transcript: formatVersioned(transcript.id),
        refSeq: transcript.refSeqMatch ? formatVersioned(transcript.refSeqMatch) : null,
        translation: formatVersioned(transcript.translation!.id),
        uniprot: `${uni.accession} entry ${uni.entryVersion} seq ${uni.sequenceVersion} (${uniRelease})`,
        variant: V ? { kind: V.kind, hgvsg: V.hgvsg, hgvsc: V.hgvsc, hgvsp: V.hgvsp, proteinChange: V.proteinChange, residue: V.uniPos, mature: V.mLabel } : null,
        clinvar: V ? `${V.cv.accessionVersion} ${V.cv.classification} (${V.cv.reviewStatus})` : null,
        clinvarReview: V ? { stars: V.cvStars, conflicting: V.cvConflicts.conflicting, relatedRecords: V.related.length } : null,
        fullChainMapping: S ? { positions: S.tableRows.length, chains: S.chainMap.chains, residueNameDiffers: S.nameMismatch.map((r) => r.uniprotPosition) } : null,
        structure: S ? `${S.struct.entryId} rev ${S.struct.latestRevision.version}` : null,
        structureCoverage: S ? { ...S.coverage, modelCount: S.struct.modelCount, nmrEnsemble: S.struct.nmrEnsemble, partners: S.struct.entities.filter((e) => e.type === "polymer" && e.id !== S.entityId).map((e) => e.id) } : null,
        mapping: S && V && S.residues ? S.residues.map((r) => ({ uniprot: V.uniPos, mature: V.mature, labelAsym: r.labelAsymId, labelSeq: r.labelSeqId, authAsym: r.authAsymId, authSeq: r.authSeqId, residue: r.compId, assembly: r.assemblyId })) : null,
        drift: drift.map((d) => d.id),
        knownIssues: knownIssues.map((k) => k.id),
        pathways: PW
          ? {
              release: `Reactome ${PW.release}`,
              memberships: PW.memberships.length,
              participantsByPathway: PW.participantSets.map((s) => ({ stableId: s.stableId, participants: s.participantCount, proteins: s.proteins.length, listsSetProtein: s.listsSetProtein })),
              opening: PW.opening ? { stableId: PW.opening.stableId, name: PW.opening.name } : null,
            }
          : null,
        associations: AS
          ? {
              release: AS.release,
              count: AS.ot.count,
              kept: AS.rows.length,
              top: AS.rows.slice(0, 3).map((r) => ({ diseaseId: r.diseaseId, name: r.diseaseName, score: r.score })),
              datasourcesObserved: AS.ot.datasourceIdsObserved,
              dropped: AS.ot.droppedDatasourceIds,
            }
          : null,
      },
    };
  };
  return assemble();
}
