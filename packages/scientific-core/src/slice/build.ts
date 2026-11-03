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
  parseRcsb,
  parseSifts,
  parseUniprotEntry,
  readMmcifStructure,
  sha256Hex,
} from "@helix/data-adapters";
import {
  CapabilityReport,
  ClinvarRecordEntry,
  type DriftReport,
  type Evidence,
  Gene,
  type KnownIssue,
  PredictedModel,
  Protein,
  type Provenance,
  ResidueContacts,
  ResidueMapping,
  ResidueMappingTable,
  type ResidueRef,
  Sequence,
  Structure,
  TranscriptRecord,
  type ValidationResult,
  Variant,
  formatVersioned,
  parseVersioned,
} from "@helix/shared-types";
import type { z } from "zod";
import { capabilities } from "../capabilities.ts";
import { type CheckOutcome, translationChecks } from "../checks.ts";
import { interChainContacts } from "../contacts.ts";
import { cdsLengthFromExons, codonGenomicSpan, fivePrimeUtrLength, hgvsGToSpdi, spdiToHgvsG } from "../coordinates.ts";
import { detectDrift } from "../drift.ts";
import { classifyClinvarReview, evidence } from "../evidence.ts";
import { clinvarConflicts, clinvarReviewStars } from "../clinvar.ts";
import { resolveGeneQuery } from "../gene-resolution.ts";
import { classifyPdbxMutation, matureIndex, matureLabel, translatedLabel } from "../numbering.ts";
import { interval, normaliseTranscript } from "../normalise.ts";
import { AA_PDB_NAME, complement } from "../sequence.ts";
import { alignmentCrossCheck, assemblyOf, entityForAccession, labelAuthDivergences, mapUniprotChain, mapUniprotPosition, structRefSeqIssues } from "../structure-mapping.ts";
import { selectTranscript } from "../transcript-selection.ts";
import { allelesAtSite, hgvsChangePart, resolveAllele } from "../variant.ts";
import type { RawRecord, SliceConfig, SliceInputName, SliceInputs, SliceVariant } from "./types.ts";

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
  check("T15-initiator-met-and-chain", initMet?.start === 1 && /removed/i.test(initMet.description) && chainF !== undefined, `Initiator methionine ${initMet?.start} "${initMet?.description}"; Chain ${chainF?.start}-${chainF?.end}`, ["protein", "variant"]);
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
        const allele = resolveAllele(recoder, vsel.forwardAllele, vctx);
        const others = allelesAtSite(recoder, vctx);
        const map38 = variation.mappings.find((m) => m.assembly_name === "GRCh38");
        if (!map38) throw new ValidationFailedError("variation", `${vsel.rsId} has no GRCh38 mapping`);
        const rsAlleles = map38.allele_string.split("/");
        check("T13-rsid-multiallelic", rsAlleles.length > 2 && others.filter((o) => o.coding.altAa === allele.coding.altAa).length === 1, `${vsel.rsId} alleles ${map38.allele_string}; ${others.map((o) => `${o.forwardAllele}:${o.coding.proteinChange}`).join(", ")}`, ["variant"]);
        check("T08-exon-walk-genomic", allele.genomicPositionFromExonWalk === allele.genomicPosition && map38.start === allele.genomicPosition, `exon walk c.${allele.coding.cdsPosition} -> ${allele.genomicPositionFromExonWalk}; hgvsg ${allele.genomicPosition}; variation ${map38.start}`, ["variant"]);
        const codonMap = parseEnsembl.mapping(json(need("codonMap")), need("codonMap").url).mappings[0]!;
        const span = codonGenomicSpan(transcript, allele.coding.codonNumber);
        check("T08-codon-span", span.contiguous && codonMap.start === span.start && codonMap.end === span.end && codonMap.strand === transcript.interval.strand, `own walk codon ${allele.coding.codonNumber} -> ${span.start}-${span.end}; Ensembl map/cds ${codonMap.start}-${codonMap.end} strand ${codonMap.strand}`, ["variant"]);
        const window = parseEnsembl.regionSequence(json(need("genomicWindow")), need("genomicWindow").url);
        const winM = /^chromosome:(GRCh\d+):(\w+):(\d+):(\d+):(-?1)$/.exec(window.id);
        if (!winM) throw new ValidationFailedError("genomic-window", `unexpected region id ${window.id}`);
        const winStart = Number(winM[3]);
        const winEnd = Number(winM[4]);
        const baseAt = window.seq[allele.genomicPosition - winStart]?.toUpperCase();
        check("T09-forward-and-coding-base", winM[5] === "1" && baseAt === allele.genomicRef && complement(baseAt) === cds.sequence[allele.coding.cdsPosition - 1], `forward-strand base at ${allele.genomicPosition} = ${baseAt}; coding-strand c.${allele.coding.cdsPosition} = ${cds.sequence[allele.coding.cdsPosition - 1]}`, ["variant", "sequences"]);
        check("T10-spdi-roundtrip", spdiToHgvsG(allele.spdi) === allele.hgvsg && hgvsGToSpdi(allele.hgvsg) === allele.spdi, `${allele.spdi} <-> ${allele.hgvsg}`, ["variant"]);
        check("T11-codon-change", allele.coding.refCodon !== allele.coding.altCodon && allele.coding.refAa !== allele.coding.altAa, `codon ${allele.coding.codonNumber} ${allele.coding.refCodon} -> ${allele.coding.altCodon}; ${allele.coding.refAa} -> ${allele.coding.altAa}`, ["variant"]);
        const pStrings = allele.hgvsp.map(hgvsChangePart);
        check("T12-hgvsp-agrees", pStrings.length >= 2 && pStrings.every((p) => p === allele.coding.proteinChange), `computed ${allele.coding.proteinChange}; variant_recoder ${allele.hgvsp.join(", ")}`, ["variant"]);
        const tc = vep[0]!.transcript_consequences.find((c) => c.transcript_id === transcript.id.id);
        if (!tc) throw new ValidationFailedError("vep", `VEP has no consequence for ${transcript.id.id}`);
        check("T12-vep-agrees", tc.protein_start === allele.coding.codonNumber && tc.cds_start === allele.coding.cdsPosition && hgvsChangePart(tc.hgvsp ?? "") === allele.coding.proteinChange && tc.amino_acids === `${allele.coding.refAa}/${allele.coding.altAa}`, `VEP ${tc.hgvsp} protein_start ${tc.protein_start} cds_start ${tc.cds_start} codons ${tc.codons}`, ["variant"]);
        const cdnaPos = allele.coding.cdsPosition + fivePrimeUtrLength(transcript);
        check("cdna-position", tc.cdna_start === cdnaPos, `c.${allele.coding.cdsPosition} + 5' UTR ${fivePrimeUtrLength(transcript)} = ${cdnaPos}; VEP cdna_start ${tc.cdna_start}`, ["variant"]);

        const uniPos = allele.coding.codonNumber; // translated numbering: p. position == UniProt position for the canonical isoform
        check("T18-hgvsp-equals-uniprot-position", uni.sequence[uniPos - 1] === allele.coding.refAa && uni.sequence === ensp.sequence, `p.${uniPos}: UniProt residue ${uni.sequence[uniPos - 1]}, HGVS ref ${allele.coding.refAa}`, ["variant", "protein"]);
        const mature = matureIndex(uniPos, chainRange);
        const mLabel = matureLabel(allele.coding.refAa, uniPos, allele.coding.altAa, chainRange);
        check("T17-mature-index", mature !== null && mature === uniPos - chainRange!.start + 1, `mature index of ${uniPos} = ${mature} (${mLabel})`, ["variant"]);
        const natVar = uni.features.find((f) => f.type === "Natural variant" && f.start === uniPos && f.end === uniPos && f.originalSequence === allele.coding.refAa && f.alternativeSequences.includes(allele.coding.altAa) && f.xrefs.includes(`dbSNP:${vsel.rsId}`));
        check("T16-uniprot-natural-variant", natVar !== undefined, natVar ? `${natVar.featureId} at ${natVar.start}: ${natVar.originalSequence}->${natVar.alternativeSequences.join("/")}; ${natVar.description}` : "no matching natural variant", ["variant", "protein"]);

        const clinvarRecords = parseClinvarEsummary(json(need("clinvar")), need("clinvar").url);
        const cv = clinvarRecords.find((r) => r.uid === vsel.clinvarUid);
        if (!cv) throw new ValidationFailedError("clinvar", `ClinVar uid ${vsel.clinvarUid} not in response`);
        const cv38 = cv.locations.find((l) => l.assembly === "GRCh38");
        const cv37 = cv.locations.find((l) => l.assembly === "GRCh37");
        check("T14-clinvar-record", !cv.isHaplotypeOrCompound && cv.canonicalSpdi.includes(allele.spdi) && cv38?.start === allele.genomicPosition, `${cv.accessionVersion} ${cv.objectType}; spdi ${cv.canonicalSpdi.join(",")}; GRCh38 ${cv38?.start}; GRCh37 ${cv37?.start}; ${cv.classification} (${cv.reviewStatus})`, ["variant"]);
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
            includesThisAllele: r.canonicalSpdi.includes(allele.spdi),
          }))
          .sort((a, b) => Number(a.uid) - Number(b.uid));
        check(
          "T35-clinvar-related-records-separate",
          related.every((r) => r.accessionVersion !== cv.accessionVersion) && related.filter((r) => r.relation === "other-allele-or-variant").every((r) => !r.includesThisAllele),
          `${related.length} other record(s) for ${vsel.rsId}: ${related.filter((r) => r.relation === "haplotype-or-compound").length} haplotype/compound (${related.filter((r) => r.relation === "haplotype-or-compound" && r.includesThisAllele).length} include ${allele.spdi}), ${related.filter((r) => r.relation === "other-allele-or-variant").length} other allele/variant (${related.filter((r) => r.relation === "other-allele-or-variant").map((r) => `${r.accessionVersion} ${r.classification}`).join("; ") || "none"}); none merged`,
          ["clinvar-record"],
        );
        const cvBuild = inputs.clinvarEinfo ? (json(inputs.clinvarEinfo) as { einforesult?: { dbinfo?: { dbbuild?: string }[] } }).einforesult?.dbinfo?.[0]?.dbbuild ?? null : null;
        return { sel: vsel, recoder, variation, vep, allele, rsAlleles, codonMap, span, window, winStart, winEnd, tc, uniPos, mature, mLabel, natVar, cv, cv37, related, cvStars, cvConflicts, cvBasis, cvBuild };
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
          residues = mapUniprotPosition(struct, sifts, config.uniprotAccession, V.uniPos, (a) => assemblyOf(struct, a));
          altName = AA_PDB_NAME[V.allele.coding.altAa];
          const refName = AA_PDB_NAME[V.allele.coding.refAa];
          carries = residues.every((r) => r.compId === altName && r.authCompId === altName) ? "alternate" : residues.every((r) => r.compId === refName) ? "reference" : "mixed";
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
        const alnMismatch = xc.alignment.mismatches.map((m) => m.referencePos);
        check("T39-full-chain-alignment-agrees", xc.agrees && seqMismatch.join(",") === alnMismatch.join(","), `entity sequence at the mapped label_seq_id differs from UniProt at ${seqMismatch.join(", ") || "none"}; the independent alignment reports ${alnMismatch.join(", ") || "none"}`, ["residue-mapping-table"]);
        if (V && residues) {
          const vres = residues;
          const naive = struct.polySeqScheme.find((r) => r.labelAsymId === vres[0]!.labelAsymId && r.labelSeqId === V.uniPos);
          check("T24-wrong-numbering-detectable", naive !== undefined && naive.monId !== vres[0]!.compId && uni.sequence[V.mature! - 1] !== V.allele.coding.refAa, `label ${V.uniPos} in ${vres[0]!.labelAsymId} is ${naive?.monId} (not ${vres[0]!.compId}); UniProt position ${V.mature} is ${uni.sequence[V.mature! - 1]} (not ${V.allele.coding.refAa})`, ["residue-mapping"]);
        }
        const mutNumbering = ent.mutation ? classifyPdbxMutation(ent.mutation, uni.sequence, chainRange) : "unknown";
        check("T19-pdbx-mutation-numbering", ent.mutation === null || mutNumbering === "mature/legacy", `_entity.pdbx_mutation "${ent.mutation}" -> numbering ${mutNumbering}`, ["structure"]);
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

        // contacts of the variant residue (side-chain atoms beyond CB)
        let contactChains: { residue: ResidueRef; probeAtoms: string[]; contacts: ReturnType<typeof interChainContacts>["contacts"] }[] | null = null;
        if (residues) {
          contactChains = residues.map((r) => {
            const probeAtoms = [...new Set(struct.atoms.filter((a) => a.model === 1 && a.labelAsymId === r.labelAsymId && a.labelSeqId === r.labelSeqId && !BACKBONE.has(a.atomName) && a.element !== "H").map((a) => a.atomName))].sort();
            const c = interChainContacts(struct, r.authAsymId, r.authSeqId, probeAtoms, config.contactCutoffAngstrom);
            return { residue: r, probeAtoms, contacts: c.contacts };
          });
          const cc = contactChains;
          check("T28-contacts-computed", cc.every((c) => c.probeAtoms.length > 0), cc.map((c) => `${c.residue.authAsymId}${c.residue.authSeqId}: ${c.contacts.filter((x) => x.compId !== "HOH").map((x) => `${x.authAsymId}${x.authSeqId}`).join(",") || "none"}`).join("; "), ["residue-contacts"]);
        }
        return { pdbId, struct, sifts, rEntry, rEntity, rAsm, pdbRelease, entityId, segments, ent, siftsChains, xc, rRegion, residues, chainMap, tableRows, row7, nameMismatch, seqMismatch, alnMismatch, knownIssues, polymerAsyms, defaultAssembly, contactChains };
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
      check("T32-alphafold-labelled", af.uniprotAccession === config.uniprotAccession && md5Match && af.sequence[V.uniPos - 1] === V.allele.coding.refAa, `${af.entryId} v${af.modelVersion}; md5 match ${md5Match}; residue ${V.uniPos} in model = ${af.sequence[V.uniPos - 1]} (reference), so never used to place ${V.allele.coding.altAa}`, ["predicted-model"]);
    } else {
      check("T32-alphafold-labelled", af.uniprotAccession === config.uniprotAccession && md5Match, `${af.entryId} v${af.modelVersion}; md5 match ${md5Match}; no reference variant selected, so the model is never used to place one`, ["predicted-model"]);
    }
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
        E9: prov("codonMap", `${tRaw.id} codon ${V.allele.coding.codonNumber}`, String(tRaw.version), ensemblRelease, A),
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
  const rp = (record: string, sources: Provenance[], transformations: string[], ev: Evidence[]) => ({
    sources,
    transformations,
    validation: validationFor(record),
    evidenceCategory: ev[0]!.category,
  });

  const iv = (s: number, e: number, strand: number) => interval(gene.assembly_name, gene.seq_region_name, s, e, strand, { assemblyPatch: A });
  const chrAcc = V ? (parseVersioned(V.allele.hgvsg.split(":")[0]!).id.startsWith("NC_") ? V.allele.hgvsg.split(":")[0]! : null) : null;

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
      evidence("curated-database-annotation", `${uni.accession} (${uni.entryName}) canonical sequence, ${uni.length} aa; initiator Met ${initMet?.description.toLowerCase()}; chain ${chainF?.start}-${chainF?.end}.`, { qualifier: initMet?.evidences.join("; ") ?? null }),
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
      const { allele, tc, cv, cv37, natVar, uniPos, mature, mLabel, related, cvStars, cvConflicts, cvBasis, cvBuild } = V;
      const varEv = [
        evidence(classifyClinvarReview(cv.reviewStatus), `ClinVar ${cv.accessionVersion}: ${cv.classification}.`, { qualifier: cv.reviewStatus }),
        evidence("curated-database-annotation", `UniProt ${natVar!.featureId}: ${natVar!.originalSequence} to ${natVar!.alternativeSequences.join("/")} at position ${natVar!.start} (${natVar!.description}).`, { qualifier: natVar!.evidences.join("; ") }),
        evidence("reference-sequence-derivation", `${allele.hgvsc[0]} changes codon ${allele.coding.codonNumber} ${allele.coding.refCodon} to ${allele.coding.altCodon}, giving ${allele.coding.proteinChange} by translation.`),
        evidence("computational-prediction", `VEP consequence on ${transcript.id.id}: ${tc.consequence_terms.join(", ")}.`),
      ];
      const varRec = Variant.parse({
        kind: "variant",
        key: allele.hgvsg,
        commonName: V.sel.commonName,
        rsId: V.variation.name,
        rsAlleles: V.rsAlleles,
        allele: { reference: allele.genomicRef, alternate: allele.genomicAlt, strand: 1 },
        location: { ...iv(allele.genomicPosition, allele.genomicPosition, 1), refSeqAccession: chrAcc },
        locationGRCh37: cv37 ? interval("GRCh37", cv37.chromosome, cv37.start, cv37.stop, 1) : null,
        hgvs: { genomic: allele.hgvsg, coding: [...allele.hgvsc].sort(), protein: [...allele.hgvsp].sort() },
        spdi: allele.spdi,
        transcript: transcript.id,
        cdsPosition: allele.coding.cdsPosition,
        cdnaPosition: tc.cdna_start ?? null,
        codon: { number: allele.coding.codonNumber, reference: allele.coding.refCodon, alternate: allele.coding.altCodon, genomic: iv(V.span.start, V.span.end, transcript.interval.strand) },
        aminoAcids: { reference: allele.coding.refAa, alternate: allele.coding.altAa },
        proteinChangeComputed: allele.coding.proteinChange,
        numbering: {
          translatedPosition: uniPos,
          maturePosition: mature,
          matureLabel: mLabel,
          translatedLabel: translatedLabel(allele.coding.refAa, uniPos, allele.coding.altAa),
        },
        consequence: { terms: tc.consequence_terms, codons: tc.codons ?? "", source: `Ensembl VEP (${ensemblRelease})` },
        clinvar: {
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
        },
        evidence: varEv,
        provenance: rp("variant", [PV.E11, PV.E10, PV.E12, PV.E9, PV.E8, P.E5, P.U1, PV.C1], ["select-allele", "filter-hgvs-to-selected-transcript", "apply-substitution-to-cds", "translate-codon", "exon-walk", "mature-index", "drop-trait-names"], varEv),
      });
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
        variantKey: allele.hgvsg,
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
      const { struct, sifts, entityId, segments, ent, xc, rRegion, residues, chainMap, tableRows, row7, nameMismatch, seqMismatch, alnMismatch, polymerAsyms, defaultAssembly, contactChains } = S;
      const structEv = [
        evidence("experimental-structure-observation", `${struct.entryId}: ${struct.method}, ${struct.resolution} A resolution, deposited ${struct.depositionDate}.`),
      ];
      const entities = struct.entities.map((e) => ({
        entityId: e.id,
        type: e.type,
        description: e.description,
        moleculeCount: e.moleculeCount,
        mutation: e.mutation ? { text: e.mutation, numbering: classifyPdbxMutation(e.mutation, e.id === entityId ? uni.sequence : "", e.id === entityId ? chainRange : null) } : null,
        sequence: e.sequenceCanonical,
        strandIds: e.strandIds,
        siftsUniprot: [...new Set(sifts.filter((s) => s.entityId === e.id).map((s) => s.uniprotAccession))].sort(),
      }));
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
        revision: struct.latestRevision,
        depositionDate: struct.depositionDate,
        citation: struct.primaryCitation,
        entities,
        chains,
        assemblies: struct.assemblies.map((a) => ({ ...a, polymerAsymIds: a.asymIds.filter((x) => polymerAsyms.has(x)) })),
        defaultAssemblyId: defaultAssembly.id,
        modelFile: { path: cifPath, format: "mmcif", sha256: mmcifBody.sha256, bytes: new TextEncoder().encode(mmcifBody.body).byteLength },
        evidence: structEv,
        provenance: rp("structure", [PS.P1, PS.P2, PS.P3, PS.P4, PS.S1], ["parse-mmcif", "field-select", "sifts-entity-selection", "classify-pdbx-mutation-numbering"], structEv),
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
        const conEv = [
          evidence("computed-from-experimental-data", `Within ${config.contactCutoffAngstrom} A of the ${residues[0]!.compId} side chain, in the asymmetric unit: ${withContacts.map((c) => `chain ${c.residue.authAsymId} contacts chain(s) ${[...new Set(c.contacts.filter((x) => x.compId !== "HOH").map((x) => x.authAsymId))].join(",")}`).join("; ") || "no inter-chain protein contacts"}.`),
          ...(without.length > 0
            ? [evidence("inference-not-verified", `Chains ${without.map((c) => c.residue.authAsymId).join(", ")} show no protein contact inside the asymmetric unit; they may contact symmetry-related molecules, which were not generated.`)]
            : []),
        ];
        const conRec = ResidueContacts.parse({
          kind: "residue-contacts",
          entryId: struct.entryId,
          scope: "asymmetric unit, model 1, no symmetry mates",
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
        sequenceChecksumMatchesUniprot: af.sequenceChecksumMd5 === uni.md5.toUpperCase(),
        disclaimer: afDisclaimer,
        usableForVariantPlacement: false,
        evidence: pmEv,
        provenance: rp("predicted-model", sourcesUsed.filter((s) => s.source === "alphafold"), ["field-select", "keep-in-file-disclaimer"], pmEv),
      });
      add(`predicted-model-${af.entryId}.json`, "predicted-model", pmRec);
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
        selectedStructure: S ? { entryId: S.struct.entryId } : null,
        verifiedMappings,
        predictedModel: pmRec ? { modelId: pmRec.modelId, version: pmRec.modelVersion } : null,
        variantPositions: V ? [V.uniPos] : [],
      }),
      derivedFrom: files.map((f) => f.path).filter((p) => p.endsWith(".json")),
    });
    add("capabilities.json", "capabilities", capRec);

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
        variant: V ? { hgvsg: V.allele.hgvsg, hgvsc: V.allele.hgvsc, hgvsp: V.allele.hgvsp, mature: V.mLabel } : null,
        clinvar: V ? `${V.cv.accessionVersion} ${V.cv.classification} (${V.cv.reviewStatus})` : null,
        clinvarReview: V ? { stars: V.cvStars, conflicting: V.cvConflicts.conflicting, relatedRecords: V.related.length } : null,
        fullChainMapping: S ? { positions: S.tableRows.length, chains: S.chainMap.chains, residueNameDiffers: S.nameMismatch.map((r) => r.uniprotPosition) } : null,
        structure: S ? `${S.struct.entryId} rev ${S.struct.latestRevision.version}` : null,
        mapping: S && V && S.residues ? S.residues.map((r) => ({ uniprot: V.uniPos, mature: V.mature, labelAsym: r.labelAsymId, labelSeq: r.labelSeqId, authAsym: r.authAsymId, authSeq: r.authSeqId, residue: r.compId, assembly: r.assemblyId })) : null,
        drift: drift.map((d) => d.id),
        knownIssues: knownIssues.map((k) => k.id),
      },
    };
  };
  return assemble();
}
