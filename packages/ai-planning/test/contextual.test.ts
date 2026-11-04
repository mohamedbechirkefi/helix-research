// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 10 (P10.1.2, docs/phase-10-ai-explorer.md section 3): contextual questions bound to the
 * selection. The binding, the selection facts read from the records, the rule-based answers, and the
 * two prohibitions: never the variant's evidence for a non-variant selection, never another chain's
 * contacts. The Phase 3 to 9 contexts, the pinned HBB fixture and prompt v5 are unchanged.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PHASE10_ACTIONS,
  bindSelection,
  buildHbbContext,
  buildMessages,
  contextualAnswer,
  contextualKind,
  contextualRecords,
  deterministicPlan,
  selectionFacts,
  validatePlan,
  withContextualRecords,
  withExplorerRecords,
  withSelectionFacts,
  withSession,
  type PlanningContext,
  type SelectionInput,
} from "../src/index.ts";
import { REPO_ROOT, cftrBundle, hbbBundleWithPathways, hbbContext } from "./load.ts";

const PHASE6 = ["resolveGene", "resolveVariant", "loadStructure", "enterWorld", "focusCamera", "highlightResidue", "revealEvidence", "cancelActions", "compareVariants", "highlightSequenceRegion"];
const AA: Record<string, string> = { TTT: "F", TTC: "F", TTA: "L", TTG: "L", CTT: "L", CTC: "L", CTA: "L", CTG: "L", ATT: "I", ATC: "I", ATA: "I", ATG: "M", GTT: "V", GTC: "V", GTA: "V", GTG: "V", TCT: "S", TCC: "S", TCA: "S", TCG: "S", CCT: "P", CCC: "P", CCA: "P", CCG: "P", ACT: "T", ACC: "T", ACA: "T", ACG: "T", GCT: "A", GCC: "A", GCA: "A", GCG: "A", TAT: "Y", TAC: "Y", TAA: "*", TAG: "*", CAT: "H", CAC: "H", CAA: "Q", CAG: "Q", AAT: "N", AAC: "N", AAA: "K", AAG: "K", GAT: "D", GAC: "D", GAA: "E", GAG: "E", TGT: "C", TGC: "C", TGA: "*", TGG: "W", CGT: "R", CGC: "R", CGA: "R", CGG: "R", AGT: "S", AGC: "S", AGA: "R", AGG: "R", GGT: "G", GGC: "G", GGA: "G", GGG: "G" };

type Bundle = ReturnType<typeof hbbBundleWithPathways>;
const set = (dir: string, b: Bundle) => {
  const seqs = JSON.parse(readFileSync(join(REPO_ROOT, "data", "curated", dir, "sequences.json"), "utf8")) as { records: { sequenceKind: string; sourceId: string; sequence: string }[] };
  const cds = seqs.records.find((r) => r.sequenceKind === "cds")!;
  const protein = b.protein as { accession: string; sequence: string };
  /** What the selection bridge reads for codon k: the bases, the translation, the UniProt residue. */
  const codon = (k: number): NonNullable<SelectionInput["codon"]> => {
    const bases = cds.sequence.slice(3 * (k - 1), 3 * k);
    return { transcriptId: cds.sourceId, codon: k, bases, aminoAcid: AA[bases]!, protein: { accession: protein.accession, position: k, residue: protein.sequence[k - 1]! } };
  };
  const ctx = (world: PlanningContext["currentWorld"], sel: SelectionInput, query: string): PlanningContext => {
    const base: PlanningContext = { ...withContextualRecords(withExplorerRecords(buildHbbContext(b), b), b), executableActions: [...PHASE6, ...PHASE10_ACTIONS], routeByCues: true, cueRules: "dh010", answer: "follow-up", currentWorld: world };
    const withSel = withSession(base, {
      selection: sel.residue ? { ...sel.residue, numbering: "auth", featureId: null } : null,
      loadedStructureId: sel.residue?.structureId ?? null,
      sequenceSelection: sel.codon ? { transcriptId: sel.codon.transcriptId, codon: sel.codon.codon } : null,
    });
    const fixed = { ...withSel, selection: withSel.selection ? { ...withSel.selection, featureId: withSel.features.find((f) => f.kind === "residue" && f.chains.includes(withSel.selection!.chainId) && f.authSeqId === withSel.selection!.residueNumber)?.id ?? null } : null };
    return withSelectionFacts(fixed, selectionFacts(fixed, sel), query);
  };
  return { codon, ctx };
};
const hbbB = hbbBundleWithPathways();
const HBB = set("hbb", hbbB);
const CFTR = set("cftr", cftrBundle() as Bundle);
const res = (chainId: string, residueNumber: number, compId: string, structureId = "2HBS") => ({ structureId, chainId, residueNumber, compId });
const ask = (q: string, ctx: PlanningContext) => {
  const { plan, rule } = deterministicPlan(q, ctx);
  const v = validatePlan(plan, ctx, { query: q });
  expect(v.issues, `${q}: ${JSON.stringify(v.issues)}`).toEqual([]);
  const answer = contextualAnswer(q, ctx);
  const text = answer?.sentences.map((s) => s.text).join(" ") ?? "";
  const ids = [...plan.citations, ...plan.actions.flatMap((a) => (a.type === "revealEvidence" ? [a.evidenceId] : [])), ...(answer?.sentences.flatMap((s) => s.evidenceIds) ?? [])];
  return { plan, rule, answer, text, ids, types: plan.actions.map((a) => a.type) };
};
const VARIANT_EVIDENCE = ["clinvar:VCV000015333", "uniprot:VAR_002863", "hgvs:ENST00000335295.4:c.20A>T"];
const H6_PARTNERS = ["ALA B70", "ASP B73", "THR B84", "PHE B85", "LEU B88"];

describe("the binding (plan section 3)", () => {
  const both = { residue: true, codon: true };
  it("binds the deictic subjects, and a question with no subject while something is selected", () => {
    expect(bindSelection("Why is this residue important?", both, "protein")).toEqual({ subject: "this residue", target: "residue" });
    expect(bindSelection("What is this codon?", both, "dna")).toEqual({ subject: "this codon", target: "codon" });
    expect(bindSelection("What is here?", both, "dna")).toEqual({ subject: "here", target: "codon" });
    expect(bindSelection("What is here?", both, "protein")).toEqual({ subject: "here", target: "residue" });
    expect(bindSelection("Why is the selected one important?", { residue: false, codon: true }, "protein")).toEqual({ subject: "the selected one", target: "codon" });
    expect(bindSelection("Why is it important?", both, "protein")).toEqual({ subject: "implicit", target: "residue" });
    expect(bindSelection("What does it touch?", both, "protein")).toEqual({ subject: "implicit", target: "residue" });
    expect(bindSelection("What is it?", both, "dna")).toEqual({ subject: "implicit", target: "codon" });
  });
  it("does not bind a question that names its own subject, or with nothing selected and no deictic words", () => {
    for (const q of ["Show me where the sickle-cell mutation affects hemoglobin.", "What does the HbS residue touch in the crystal?", "Which transcript is shown?", "Why is HBB important?", "What diseases are associated with HBB?", "Show the domains", "Which pathways list HBB?"]) expect(bindSelection(q, both, "protein"), q).toBeNull();
    expect(bindSelection("Why is it important?", { residue: false, codon: false }, "protein")).toBeNull();
    expect(contextualKind("Why is this residue important?")).toBe("importance");
    expect(contextualKind("What does this residue touch?")).toBe("contacts");
    expect(contextualKind("What is this codon?")).toBe("identity");
  });
  it("a deictic question with nothing selected is a clarification, not a guess", () => {
    const ctx = HBB.ctx("dna", { codon: null, residue: null }, "What is this codon?");
    const { plan, rule } = deterministicPlan("What is this codon?", ctx);
    expect(rule).toBe("contextual-nothing-selected");
    expect(plan.outcome).toBe("clarify");
  });
});

describe("the selection facts read from the records", () => {
  it("contextual records: every positioned feature, every contacts entry with its own evidence, the variant position", () => {
    const r = contextualRecords(hbbB);
    expect(r.variantPosition).toBe(7);
    expect(r.residueContacts.map((x) => [`${x.chainId}${x.residueNumber}`, x.partners.length, x.evidenceId])).toEqual([
      ["B6", 0, "contacts:2HBS-none"],
      ["D6", 0, "contacts:2HBS-none"],
      ["F6", 0, "contacts:2HBS-none"],
      ["H6", 5, "contacts:2HBS-H6"],
    ]);
    expect(r.evidence.map((e) => [e.id, e.category])).toEqual([["contacts:2HBS-none", 4]]);
  });
  it("H6: the variant residue, its features, the ClinVar line, its own contacts", () => {
    const f = HBB.ctx("protein", { codon: HBB.codon(7), residue: res("H", 6, "VAL") }, "Why is this residue important?").selectionFacts!;
    expect([f.isVariantCodon, f.isVariantResidue, f.variant?.id, f.clinvar?.evidenceId, f.contacts?.status]).toEqual([true, true, "NC_000011.10:g.5227002T>A", "clinvar:VCV000015333", "recorded"]);
    expect(f.codon).toMatchObject({ bases: "GAG", aminoAcid: "E", aminoAcidName: "Glu" });
    expect(f.features.map((x) => x.type)).toEqual(["Chain", "Domain", "Natural variant", "Natural variant", "Natural variant", "Natural variant"]);
    expect(f.contacts?.entry?.partners.map((p) => `${p.compId} ${p.chainId}${p.residueNumber}`)).toEqual(H6_PARTNERS);
  });
  it("B6: the variant residue too (2HBS is HbS), but the record computes no contact for it; H6's partners are not B6's", () => {
    const f = HBB.ctx("protein", { codon: HBB.codon(7), residue: res("B", 6, "VAL") }, "What does this residue touch?").selectionFacts!;
    expect([f.isVariantResidue, f.contacts?.status, f.contacts?.entry?.partners.length]).toEqual([true, "none-in-record", 0]);
  });
  it("a non-variant codon has no variant, no ClinVar line and only the features covering it", () => {
    const f = HBB.ctx("dna", { codon: HBB.codon(20), residue: res("B", 19, "ASN") }, "What is this codon?").selectionFacts!;
    expect([f.isVariantCodon, f.isVariantResidue, f.variant, f.clinvar]).toEqual([false, false, null, null]);
    expect(f.features.map((x) => `${x.type} ${x.start}-${x.end}`)).toEqual(["Chain 2-147", "Domain 3-147"]);
  });
});

describe("the rule-based answers", () => {
  it("why is this residue important (H6): the records with their evidence, the ClinVar line, H6's own contacts", () => {
    const a = ask("Why is this residue important?", HBB.ctx("protein", { codon: HBB.codon(7), residue: res("H", 6, "VAL") }, "Why is this residue important?"));
    expect(a.rule).toBe("contextual-importance");
    expect(a.types.slice(0, 2)).toEqual(["focusCamera", "highlightResidue"]);
    expect(a.plan.citations).toEqual(expect.arrayContaining(["clinvar:VCV000015333", "uniprot:VAR_002863", "contacts:2HBS-H6"]));
    expect(a.text).toContain("This is the HbS variant residue (HbS (sickle haemoglobin): p.Glu7Val");
    expect(a.text).toContain("ClinVar VCV000015333.184: Pathogenic.");
    expect(a.text).toContain(`VAL H6 contacts ${H6_PARTNERS.slice(0, -1).join(", ")} and ${H6_PARTNERS.at(-1)} within 4.5 A`);
  });
  it("what does this residue touch (B6): no H6 partner, the record's statement, H6 offered as the nearest recorded thing", () => {
    const q = "What does this residue touch?";
    const a = ask(q, HBB.ctx("protein", { codon: HBB.codon(7), residue: res("B", 6, "VAL") }, q));
    expect(a.rule).toBe("contextual-contacts");
    expect(a.types.slice(0, 2)).toEqual(["focusCamera", "highlightResidue"]);
    expect(a.plan.actions.slice(0, 2).every((x) => "target" in x && x.target.kind === "selection")).toBe(true);
    for (const p of H6_PARTNERS) expect(a.text).not.toContain(p);
    expect(a.ids).not.toContain("contacts:2HBS-H6");
    expect(a.ids).toContain("contacts:2HBS-none");
    expect(a.text).toContain("computes no protein contact within 4.5 A of VAL B6");
    expect(a.answer!.sentences.find((s) => s.role === "offer")!.text).toContain("contacts are recorded for VAL H6");
  });
  it("what does this residue touch (H6): the Phase 4 contact scene, unchanged", () => {
    const q = "What does this residue touch in the crystal?";
    const a = ask(q, HBB.ctx("protein", { codon: HBB.codon(7), residue: res("H", 6, "VAL") }, q));
    expect(a.rule).toBe("contextual-contacts-recorded");
    expect(a.plan.actions.slice(0, 2)).toEqual([
      { type: "focusCamera", target: { kind: "feature", featureId: "HbS_contact_H6_B" } },
      { type: "highlightResidue", target: { kind: "feature", featureId: "HbS_contact_H6_B" } },
    ]);
  });
  it("what is this codon (20, no site-level feature): bases, amino acid, the ranges, nothing beyond the sequence, never the variant's evidence", () => {
    const q = "What is this codon?";
    const a = ask(q, HBB.ctx("dna", { codon: HBB.codon(20), residue: res("B", 19, "ASN") }, q));
    expect(a.rule).toBe("contextual-identity");
    expect(a.types).toEqual(["highlightSequenceRegion", "revealEvidence"]);
    expect(a.text).toContain("Codon 20 of ENST00000335295.4 (c.58 to c.60) reads AAC in the curated coding sequence and translates to Asn (N). UniProt P68871 position 20 is N (Asn).");
    expect(a.text).toContain("No site-level feature");
    expect(a.text).toContain("This is not the HbS position: the curated variant is at codon 7, 13 codons away.");
    for (const id of VARIANT_EVIDENCE) expect(a.ids).not.toContain(id);
    expect(a.text).not.toContain("Pathogenic");
  });
  it("why is this residue important (a non-variant residue in Protein World): never the variant's evidence", () => {
    const q = "Why is this residue important?";
    const a = ask(q, HBB.ctx("protein", { codon: HBB.codon(20), residue: res("B", 19, "ASN") }, q));
    for (const id of [...VARIANT_EVIDENCE, "contacts:2HBS-H6"]) expect(a.ids).not.toContain(id);
    expect(a.plan.entities.variantId).toBeNull();
    expect(a.text).toContain("does not infer an importance the records do not state");
  });
  it("a residue the mapping does not link (alpha chain A) says so; nothing of P68871 is claimed", () => {
    const q = "Why is this residue important?";
    const a = ask(q, HBB.ctx("protein", { codon: null, residue: res("A", 12, "ALA"), unmappedReason: "chain A is not P68871 in the mapping table of record" }, q));
    expect(a.text).toContain("Selected: ALA A12 of 2HBS. It is not linked to P68871: chain A is not P68871 in the mapping table of record");
    for (const id of [...VARIANT_EVIDENCE, "uniprot:P68871", "contacts:2HBS-H6"]) expect(a.ids).not.toContain(id);
  });
  it("CFTR: F508 is the residue the deletion removes; a non-variant residue gets no F508del evidence and not F508's contacts", () => {
    const q = "Why is this residue important?";
    const a = ask(q, CFTR.ctx("protein", { codon: CFTR.codon(508), residue: res("A", 508, "PHE", "5UAK") }, q));
    expect(a.text).toContain("This is the residue F508del removes (F508del (p.Phe508del)");
    expect(a.plan.citations.some((id) => id.startsWith("clinvar:"))).toBe(true);
    const q2 = "What does this residue touch?";
    const b = ask(q2, CFTR.ctx("protein", { codon: CFTR.codon(498), residue: res("A", 498, "MET", "5UAK") }, q2));
    expect(b.ids.some((id) => id.startsWith("contacts:") || id.startsWith("clinvar:"))).toBe(false);
    expect(b.text).toContain("No contacts are recorded for MET A498");
  });
});

describe("what stays measured", () => {
  it("the Phase 3 to 9 contexts carry no contextual field and plan as before; prompt v5 is byte-identical with the records added", () => {
    const base = hbbContext();
    expect(base.contextualRecords).toBeUndefined();
    const sel = withSession(base, { selection: { structureId: "2HBS", chainId: "H", residueNumber: 6, numbering: "auth", compId: "VAL", featureId: "HbS_substitution" } });
    expect(deterministicPlan("Why is this residue important?", sel).rule).toBe("selection-explain");
    const routed: PlanningContext = { ...sel, answer: "follow-up", currentWorld: "protein", routeByCues: true, cueRules: "dh010" };
    const withRecords = withSelectionFacts(withContextualRecords(routed, hbbB), selectionFacts(withContextualRecords(routed, hbbB), { codon: HBB.codon(7), residue: res("H", 6, "VAL") }), "Why is this residue important?");
    const withPersonalisation = { ...withRecords, personalisation: { depth: "detailed", interests: ["structure"] } };
    expect(JSON.stringify(buildMessages("Why is this residue important?", withPersonalisation))).toBe(JSON.stringify(buildMessages("Why is this residue important?", routed)));
  });
});
