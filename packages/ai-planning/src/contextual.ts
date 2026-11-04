// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Contextual questions (Phase 10, P10.1.2; docs/phase-10-ai-explorer.md section 3).
 *
 * A question with a deictic subject ("this residue", "this codon", "here", "the selected one", or no
 * subject while a selection is present) is bound to the shared world state before planning. The
 * context then carries the selection as a trusted entity with what the records say about it
 * (`SelectionFacts`): the codon's bases and amino acid, whether it is the variant codon or residue, the
 * UniProt features covering the position with their evidence codes, the recorded contacts of that
 * exact residue and chain only, and the ClinVar line only when the position is the variant's.
 *
 * Every value is read from the curated records by deterministic code. The answer sentences are
 * composed here too, so that the rule-based planner and the app's explanation say the same thing
 * whichever planner chose the actions: a non-variant selection never receives the variant's evidence,
 * and a residue never receives another chain's contacts.
 */
import { z } from "zod";
import { WATER_OR_LIGAND, selectionFeature, variantShortName, type ContextEvidence, type ContextPositionFeature, type ContextResidueContacts, type ContextualRecords, type DeicticBinding, type PlanningContext, type SelectionFacts } from "./context.ts";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const Ev = z.object({ category: z.number(), statement: z.string() }).loose();
const ProteinIn = z
  .object({
    accession: z.string(),
    features: z.array(z.object({ type: z.string(), start: z.number().nullable(), end: z.number().nullable(), description: z.string().nullable().optional(), evidences: z.array(z.string()) }).loose()),
  })
  .loose();
const ContactsIn = z
  .object({
    entryId: z.string(),
    scope: z.string(),
    cutoffAngstrom: z.number(),
    chains: z.array(z.object({ residue: z.object({ authAsymId: z.string(), authSeqId: z.union([z.string(), z.number()]), compId: z.string() }).loose(), contacts: z.array(z.object({ authAsymId: z.string(), authSeqId: z.union([z.string(), z.number()]), compId: z.string() }).loose()) }).loose()),
    evidence: z.array(Ev),
  })
  .loose();
const VariantIn = z.object({ numbering: z.object({ translatedPosition: z.number() }).loose(), variantKind: z.enum(["substitution", "deletion"]).optional() }).loose();

/**
 * The records contextual questions read, from the set's protein, contacts and variant records. The
 * contacts evidence ids follow the context builder's (`contacts:<entry>-<chain><residue>` for the
 * residue whose partners the record's first statement names); an entry the record computes no
 * protein contact for cites the record's statement about those chains (`contacts:<entry>-none`) when
 * the record has one. Every other entry cites nothing it does not state.
 */
export function contextualRecords(b: { protein: unknown; contacts?: unknown | null; variant?: unknown | null }): ContextualRecords {
  const protein = ProteinIn.parse(b.protein);
  const positionFeatures: ContextPositionFeature[] = protein.features
    .filter((f) => f.start !== null && f.end !== null)
    .map((f) => ({ type: f.type, description: f.description ?? "", start: f.start!, end: f.end!, evidences: [...f.evidences] }));
  const evidence: ContextEvidence[] = [];
  let residueContacts: ContextResidueContacts[] = [];
  let contactsScope: ContextualRecords["contactsScope"] = null;
  if (b.contacts) {
    const c = ContactsIn.parse(b.contacts);
    contactsScope = { structureId: c.entryId, scope: c.scope, cutoffAngstrom: c.cutoffAngstrom };
    const withPartners = c.chains.find((x) => x.contacts.some((p) => !WATER_OR_LIGAND.has(p.compId))) ?? null;
    const noneEv = c.evidence[1] && /no protein contact/i.test(c.evidence[1].statement) ? { id: `contacts:${c.entryId}-none`, category: c.evidence[1].category, statement: c.evidence[1].statement } : null;
    if (noneEv) evidence.push(noneEv);
    residueContacts = c.chains.map((x) => {
      const partners = x.contacts.filter((p) => !WATER_OR_LIGAND.has(p.compId)).map((p) => ({ chainId: p.authAsymId, residueNumber: Number(p.authSeqId), compId: p.compId }));
      const evidenceId = x === withPartners ? `contacts:${c.entryId}-${x.residue.authAsymId}${x.residue.authSeqId}` : partners.length === 0 && noneEv ? noneEv.id : null;
      return { structureId: c.entryId, chainId: x.residue.authAsymId, residueNumber: Number(x.residue.authSeqId), compId: x.residue.compId, partners, evidenceId };
    });
  }
  const variant = b.variant ? VariantIn.parse(b.variant) : null;
  return {
    proteinAccession: protein.accession,
    positionFeatures,
    contactsScope,
    residueContacts,
    variantPosition: variant ? variant.numbering.translatedPosition : null,
    variantKind: variant ? (variant.variantKind ?? "substitution") : null,
    evidence,
  };
}

/** The context with the contextual records added (a copy; the other fields are untouched). */
export function withContextualRecords(ctx: PlanningContext, b: { protein: unknown; contacts?: unknown | null; variant?: unknown | null }): PlanningContext {
  return { ...ctx, contextualRecords: contextualRecords(b) };
}

const AA3: Record<string, string> = { A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met", F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop" };

/** Does a feature cover a position? A disulfide bond names its two cysteines, not the span between them. */
export function featureCovers(f: ContextPositionFeature, position: number): boolean {
  if (/^disulfide bond$/i.test(f.type)) return f.start === position || f.end === position;
  return f.start <= position && position <= f.end;
}
/** A site-level feature: one that names this position alone (a binding site, a modified residue, a natural variant at one position, ...). */
export const isSiteLevel = (f: ContextPositionFeature): boolean => f.start === f.end || /^disulfide bond$/i.test(f.type);

/** The selection as the shared world state holds it (the selection bridge's link and the structure pick). */
export interface SelectionInput {
  /** The codon selected in DNA World (or linked to the structure pick by the bridge), with what the bridge read. */
  codon: { transcriptId: string; codon: number; bases: string; aminoAcid: string; protein: { accession: string; position: number; residue: string } | null } | null;
  residue: { structureId: string; chainId: string; residueNumber: number; compId: string } | null;
  /** The bridge's reason when the selection is not linked to the protein. */
  unmappedReason?: string | null;
}

/**
 * The selection as a trusted entity with what the records say about it. Returns null when nothing is
 * selected. Reads only the context (its contextual records, variants, features and evidence).
 */
export function selectionFacts(ctx: PlanningContext, sel: SelectionInput): SelectionFacts | null {
  if (!sel.codon && !sel.residue) return null;
  const rec = ctx.contextualRecords ?? null;
  const v = ctx.variants[0] ?? null;
  const protein = sel.codon?.protein ?? null;
  const position = protein?.position ?? null;
  const isVariantCodon = !!(rec && sel.codon && rec.variantPosition !== null && sel.codon.codon === rec.variantPosition);
  const featureId = sel.residue ? selectionFeature(ctx, sel.residue.structureId, sel.residue.chainId, sel.residue.residueNumber) : null;
  const isVariantResidue = !!(v && featureId !== null && featureId === v.featureId);
  // The variant's position: the codon is the variant codon, or the residue is the variant residue of record.
  const atVariant = isVariantCodon || isVariantResidue;
  const features = rec && position !== null ? rec.positionFeatures.filter((f) => featureCovers(f, position)) : [];
  let contacts: SelectionFacts["contacts"] = null;
  if (sel.residue) {
    const r = sel.residue;
    const scope = rec?.contactsScope ?? null;
    const recordedFor = (rec?.residueContacts ?? []).filter((x) => x.structureId === r.structureId).map((x) => `${x.compId} ${x.chainId}${x.residueNumber}`);
    // The exact residue and chain only: another chain's entry is never this residue's.
    const entry = (rec?.residueContacts ?? []).find((x) => x.structureId === r.structureId && x.chainId === r.chainId && x.residueNumber === r.residueNumber) ?? null;
    contacts = !scope || scope.structureId !== r.structureId ? { status: "no-record", entry: null, recordedFor: [] } : !entry ? { status: "not-in-record", entry: null, recordedFor } : { status: entry.partners.length > 0 ? "recorded" : "none-in-record", entry, recordedFor };
  }
  const clinvarEv = atVariant && v ? (ctx.evidence.find((e) => e.id.startsWith("clinvar:") && v.evidenceIds.includes(e.id)) ?? null) : null;
  return {
    codon: sel.codon ? { transcriptId: sel.codon.transcriptId, codon: sel.codon.codon, bases: sel.codon.bases, aminoAcid: sel.codon.aminoAcid, aminoAcidName: AA3[sel.codon.aminoAcid] ?? sel.codon.aminoAcid } : null,
    residue: sel.residue ? { ...sel.residue } : null,
    protein,
    unmappedReason: protein ? null : (sel.unmappedReason ?? null),
    isVariantCodon,
    isVariantResidue,
    variant: atVariant && v ? { id: v.id, label: v.label, featureId: v.featureId } : null,
    features,
    contacts,
    clinvar: clinvarEv ? { evidenceId: clinvarEv.id, statement: clinvarEv.statement } : null,
    binding: null,
  };
}

// ---- binding -----------------------------------------------------------------------------------

const DEICTIC: [RegExp, "residue" | "codon" | "either"][] = [
  [/\b(this|that|the selected|the current|selected|current) (residue|amino acid|position|site)\b|\bce (residu|acide amine)\b/, "residue"],
  [/\b(this|that|the selected|the current|selected|current) (codon|base|triplet)\b|\bce codon\b/, "codon"],
  [/\b(the selected one|this one|that one|the selection|my selection)\b|\bcelui-ci\b/, "either"],
  [/\bhere\b|\bici\b/, "either"],
];
/** Words that name a subject of their own: a question carrying one is not bound implicitly. */
const NAMED_SUBJECT = /(sickle|drepano|\bhbs\b|\be6v\b|glu6val|glu7val|\be7v\b|rs\d+|mutation|mutated|variant|substitution|deletion|\bgene\b|genome|locus|transcript|\bprotein\b|structure|crystal|\bpdb\b|domain|pathway|disease|associat|chain [a-z]\b|\bresidue \d+|\bcodon \d+|\bposition \d+|hemoglobin|haemoglobin|globin)/;
const IMPORTANCE = /\bimportan(t|ce)\b|\bsignifican(t|ce)\b|\bwhy (does|do) (it|this|that) matter\b|\bwhat role\b/;
const CONTACTS = /\b(contacts?|touch(es)?|interacts?|interacting|neighbou?rs?)\b/;
/** A gene-symbol-like token (HBB, CFTR, BRCA1) names a subject too. */
const GENE_LIKE = /\b[A-Z][A-Z0-9-]{2,9}\b/;
const IDENTITY = /^\s*(what('s| is| does)|which|tell me about|describe|explain)\b/;

/** An identity question binds implicitly only when it has no subject but a pronoun ("what is it?", "what does this encode?"). */
const IMPLICIT_IDENTITY = /^\s*(what('s| is| does)|tell me about|describe|explain) (it|this|that)( (encode|code for|mean|do))?\s*\??\s*$/;

export type ContextualKind = "importance" | "contacts" | "identity";

/** The kind of contextual question (importance, contacts, identity), or null. */
export function contextualKind(query: string): ContextualKind | null {
  const q = fold(query);
  if (IMPORTANCE.test(q)) return "importance";
  if (CONTACTS.test(q)) return "contacts";
  if (IDENTITY.test(q)) return "identity";
  return null;
}

/** The deictic words of a question, with the subject they name, or null. */
export function deicticSubject(query: string): { words: string; subject: "residue" | "codon" | "either" } | null {
  const q = fold(query);
  for (const [re, subject] of DEICTIC) {
    const m = q.match(re);
    if (m) return { words: m[0], subject };
  }
  return null;
}

/**
 * Binds a question to the selection (plan section 3): a deictic subject binds to it; a contextual
 * question with no subject of its own binds to it while a selection is present. "here" and "the
 * selected one" bind to the codon in DNA World and to the residue elsewhere, falling back to what is
 * selected. Returns null when the question is not about the selection.
 */
export function bindSelection(query: string, sel: { residue: boolean; codon: boolean }, world?: PlanningContext["currentWorld"]): DeicticBinding | null {
  const d = deicticSubject(query);
  const kind = contextualKind(query);
  const pick = (want: "residue" | "codon" | "either"): "residue" | "codon" => {
    if (want === "residue") return "residue";
    if (want === "codon") return "codon";
    if (world === "dna") return sel.codon ? "codon" : "residue";
    return sel.residue || !sel.codon ? "residue" : "codon";
  };
  if (d) return { subject: d.words, target: pick(d.subject) };
  if (kind && (sel.residue || sel.codon) && !NAMED_SUBJECT.test(fold(query)) && !GENE_LIKE.test(query) && (kind !== "identity" || IMPLICIT_IDENTITY.test(fold(query)))) return { subject: "implicit", target: pick("either") };
  return null;
}

/** The context with the selection facts set and bound to the question (a copy). */
export function withSelectionFacts(ctx: PlanningContext, facts: SelectionFacts | null, query?: string): PlanningContext {
  if (!facts) return { ...ctx, selectionFacts: null };
  const binding = query === undefined ? null : bindSelection(query, { residue: facts.residue !== null, codon: facts.codon !== null }, ctx.currentWorld);
  return { ...ctx, selectionFacts: { ...facts, binding } };
}

// ---- the answer --------------------------------------------------------------------------------

/** One sentence of a contextual answer: "record" cites a record; "planner" states what is not recorded or offers the nearest recorded thing. */
export interface ContextualSentence {
  text: string;
  kind: "record" | "location" | "planner";
  evidenceIds: string[];
  /** "lead": the sentence that names the selection; "detail": features and contacts; "offer": the nearest recorded thing. */
  role: "lead" | "detail" | "offer";
}

const residueName = (r: { compId: string; chainId: string; residueNumber: number }) => `${r.compId} ${r.chainId}${r.residueNumber}`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const featureText = (f: ContextPositionFeature) => `${f.type}${f.description ? ` ${f.description}` : ""} (${f.start === f.end ? `position ${f.start}` : `${f.start} to ${f.end}`}; ${f.evidences.length > 0 ? f.evidences.join(", ") : "no evidence code"})`;

/**
 * The sentences that answer a contextual question from the selection facts alone. Returns null when
 * the context has no bound selection. Evidence ids are the context's (or the contextual records'
 * own); a sentence without a record is a planner sentence, never a claim.
 */
export function contextualAnswer(query: string, ctx: PlanningContext): { kind: ContextualKind; binding: DeicticBinding; sentences: ContextualSentence[] } | null {
  const facts = ctx.selectionFacts ?? null;
  const rec = ctx.contextualRecords ?? null;
  if (!facts || !facts.binding || !rec) return null;
  const kind = contextualKind(query) ?? "identity";
  const out: ContextualSentence[] = [];
  const has = (id: string) => ctx.evidence.some((e) => e.id === id) || rec.evidence.some((e) => e.id === id);
  const acc = rec.proteinAccession;
  const uniprotEv = [`uniprot:${acc}`].filter(has);
  const v = ctx.variants[0] ?? null;
  const short = v ? variantShortName(v.label) : null;
  const pos = facts.protein?.position ?? null;
  const residueTarget = facts.binding.target === "residue";

  // Lead: what is selected, read from the records.
  if (facts.codon && (!residueTarget || !facts.residue)) {
    const c = facts.codon;
    const prot = facts.protein ? ` UniProt ${facts.protein.accession} position ${facts.protein.position} is ${facts.protein.residue} (${AA3[facts.protein.residue] ?? facts.protein.residue}).` : "";
    out.push({ text: `Codon ${c.codon} of ${c.transcriptId} (c.${3 * (c.codon - 1) + 1} to c.${3 * c.codon}) reads ${c.bases} in the curated coding sequence and translates to ${c.aminoAcidName} (${c.aminoAcid}).${prot}`, kind: "record", evidenceIds: uniprotEv, role: "lead" });
  } else if (facts.residue) {
    const r = facts.residue;
    const sifts = ctx.evidence.find((e) => e.id.startsWith(`sifts:${r.structureId}-`))?.id ?? null;
    if (facts.protein) {
      out.push({ text: `Selected: ${residueName(r)} of ${r.structureId}, which the mapping of record links to ${facts.protein.accession} position ${facts.protein.position}${facts.codon ? ` (codon ${facts.codon.codon}, ${facts.codon.bases})` : ""}.`, kind: "location", evidenceIds: sifts ? [sifts] : [`pdb:${r.structureId}`].filter(has), role: "lead" });
    } else {
      out.push({ text: `Selected: ${residueName(r)} of ${r.structureId}. It is not linked to ${acc}${facts.unmappedReason ? `: ${facts.unmappedReason}` : ""}, so no protein feature or variant record applies to it.`, kind: "location", evidenceIds: [`pdb:${r.structureId}`].filter(has), role: "lead" });
    }
  }

  // The variant, only at the variant's position.
  if (facts.variant && v) {
    const f = ctx.features.find((x) => x.id === v.featureId) ?? null;
    const what = facts.isVariantResidue ? (rec.variantKind === "deletion" ? `the residue ${short} removes` : `the ${short} variant residue`) : rec.variantKind === "deletion" ? `the codon of the residue ${short} removes` : `the ${short} variant codon`;
    const hgvs = !residueTarget || !facts.residue ? ctx.evidence.filter((e) => e.id.startsWith("hgvs:")).map((e) => e.id) : [];
    const ev = [...v.evidenceIds.filter((id) => !id.startsWith("clinvar:") && has(id)), ...hgvs];
    const label = f ? f.label.replace(`${v.label}: `, "") : null;
    out.push({ text: `This is ${what} (${v.label}${label ? `: ${label}` : ""}).`, kind: "record", evidenceIds: ev, role: "lead" });
  } else if (v && rec.variantPosition !== null && kind !== "contacts") {
    const away = pos !== null ? Math.abs(pos - rec.variantPosition) : null;
    out.push({ text: `This is not the ${short} position: the curated variant is at codon ${rec.variantPosition}${away !== null ? `, ${away} codon${away === 1 ? "" : "s"} away` : ""}. Ask about the variant to see its records.`, kind: "planner", evidenceIds: [], role: "offer" });
  }

  // UniProt features covering the position, with their evidence codes.
  if (pos !== null && kind !== "contacts") {
    const site = facts.features.filter(isSiteLevel);
    const ranges = facts.features.filter((f) => !isSiteLevel(f));
    if (facts.features.length > 0) out.push({ text: `UniProt ${acc} lists at position ${pos}: ${facts.features.map(featureText).join("; ")}.`, kind: "record", evidenceIds: uniprotEv, role: "detail" });
    if (site.length === 0) {
      const around = ranges.map((f) => `the ${f.type} ${f.description ? `${f.description} ` : ""}(${f.start} to ${f.end})`);
      out.push({ text: `No site-level feature (a binding site, a modified residue, a natural variant) is recorded at position ${pos}: nothing beyond the sequence${ranges.length > 0 ? " and the ranges above" : ""} is recorded here, and Helix does not infer an importance the records do not state.${around.length > 0 ? ` Recorded around it: ${list(around)}.` : ""}`, kind: "planner", evidenceIds: [], role: "offer" });
    }
  }

  // ClinVar: only when the position is the variant's.
  if (facts.clinvar && kind !== "contacts") out.push({ text: facts.clinvar.statement, kind: "record", evidenceIds: [facts.clinvar.evidenceId], role: "detail" });

  // Contacts: the exact residue and chain only.
  if (facts.contacts && (kind === "contacts" || (kind === "importance" && facts.contacts.status === "recorded"))) {
    const c = facts.contacts;
    const r = facts.residue!;
    const scope = rec.contactsScope;
    if (c.status === "recorded" && c.entry) {
      out.push({ text: `${residueName(r)} contacts ${list(c.entry.partners.map((p) => `${p.compId} ${p.chainId}${p.residueNumber}`))} within ${scope?.cutoffAngstrom ?? "?"} A (${scope?.scope ?? "as recorded"}).`, kind: "record", evidenceIds: c.entry.evidenceId && has(c.entry.evidenceId) ? [c.entry.evidenceId] : [], role: "detail" });
    } else if (c.status === "none-in-record") {
      const ev = c.entry?.evidenceId && has(c.entry.evidenceId) ? [c.entry.evidenceId] : [];
      const stmt = ev.length > 0 ? ` The record says: ${rec.evidence.find((e) => e.id === ev[0])?.statement ?? ""}` : "";
      out.push({ text: `The contacts record of ${r.structureId} computes no protein contact within ${scope?.cutoffAngstrom ?? "?"} A of ${residueName(r)} (${scope?.scope ?? "as recorded"}).${stmt}`, kind: ev.length > 0 ? "record" : "planner", evidenceIds: ev, role: "detail" });
    } else if (c.status === "not-in-record") {
      out.push({ text: `No contacts are recorded for ${residueName(r)}: the contacts record of ${r.structureId} computes them only for ${list(c.recordedFor)}.`, kind: "planner", evidenceIds: [], role: "detail" });
    } else {
      out.push({ text: `No contacts record exists for ${r.structureId} in this set.`, kind: "planner", evidenceIds: [], role: "detail" });
    }
    const others = (rec.residueContacts ?? []).filter((x) => x.partners.length > 0 && !(x.structureId === r.structureId && x.chainId === r.chainId && x.residueNumber === r.residueNumber));
    if (c.status !== "recorded" && others.length > 0) out.push({ text: `The nearest recorded thing: contacts are recorded for ${list(others.map((x) => `${x.compId} ${x.chainId}${x.residueNumber}`))}; select ${others.length === 1 ? "it" : "one of them"} to see them. They are not ${residueName(r)}'s.`, kind: "planner", evidenceIds: [], role: "offer" });
  } else if (kind === "contacts" && !facts.residue) {
    out.push({ text: "Contacts are recorded per structure residue; this selection is a codon with no structure residue linked to it.", kind: "planner", evidenceIds: [], role: "detail" });
  }
  return { kind, binding: facts.binding, sentences: out };
}
