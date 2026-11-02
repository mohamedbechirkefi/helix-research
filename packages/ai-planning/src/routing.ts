// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Question routing by cue words (author decision D-H008, 2026-11-02).
 *
 *   - A first answer goes to the world the question names. DNA cues: DNA, codon, sequence, base,
 *     nucleotide, letter (gene sequence included). Protein cues: protein, structure, 3D, shape,
 *     residue, amino acid, fold, effect or what the variant does.
 *   - A neutral question (no cue) stays in the world on screen; the app starts in DNA World.
 *   - Explicit cues override the world on screen; the answer still stays in one world (rule 13).
 *
 * Interpretations made here (recorded in the journal entry of D-H008, for the author):
 *   - Names of the molecule (HBB, beta-globin, hemoglobin, hemoglobin subunit beta) are NOT cues:
 *     the gene and the protein share them, so they name no world.
 *   - Direct synonyms of the author's words count, and are marked strong: crystal, X-ray, PDB, 2HBS
 *     and AlphaFold (structure), "affects" (effect), French equivalents (ADN, sequence, lettre;
 *     proteine, residu, acide amine, forme, effet).
 *   - Words that belong to one world but are less direct are weak cues: chain, contact, touch,
 *     interact, neighbour, the names of amino acids (Protein); transcript, mRNA, the codons GAG
 *     and GTG, and coding HGVS like c.20A>T (DNA). They route, but never trigger the validator.
 *
 * Text is folded (accents removed, lower case) before matching, as in the rule-based planner.
 *
 * Author decision D-H010 (2026-11-02) amends the lists for contexts that ask for it
 * (`cueRules: "dh010"`; the D-H008 lists stay as they were, for reproducibility):
 *   - The molecule names (hemoglobin, haemoglobin, hemoglobine and deoxy-/oxy- forms; beta-globin,
 *     beta globin, β-globin, beta-globine; HBB) are protein cues, and strong (they trigger the
 *     validator when nothing else is named).
 *   - "chain" (chaine) is a protein cue, and strong.
 * Rules chosen for the mixed cases (recorded in the D-H010 journal entry, for the author):
 *   - An explicit DNA cue beats a molecule name: the name only names the subject ("which codon of
 *     hemoglobin changes?" names DNA World). A DNA cue with an explicit protein cue (protein,
 *     structure, residue, chain, ...) still names both worlds (mixed: any one world).
 *   - The gene words (gene, genes, genomic, genome, locus, chromosome) are weak DNA cues, so "the HBB
 *     gene" names DNA World (the gene is DNA) while "the HBB mutation" names Protein World.
 */
import type { World } from "./context.ts";

export const ROUTING_VERSION = "helix-routing-dh008-v1";
/** D-H010 cue lists (author, 2026-11-02): molecule names and chain are protein cues. */
export const ROUTING_VERSION_DH010 = "helix-routing-dh010-v1";

/** Which cue lists a routed context uses: D-H008 (default, reproducible) or D-H010. */
export type CueRules = "dh008" | "dh010";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .toLowerCase();

interface Cue {
  world: "dna" | "protein";
  strong: boolean;
  re: RegExp;
  /** D-H010: a molecule name, which names the subject only; any DNA cue beats it. */
  molecule?: boolean;
}

/** The cue lists. Each regular expression is matched on folded text, globally. */
export const CUES: readonly Cue[] = [
  // DNA World, the author's words.
  { world: "dna", strong: true, re: /\b(dna|adn|codons?|sequences?|bases?|base pairs?|nucleotides?|letters?|lettres?)\b/g },
  // DNA World, weaker: the transcript, the codons themselves, a coding HGVS name.
  { world: "dna", strong: false, re: /\b(transcripts?|mrna|arnm|gag|gtg)\b|\bc\.\d+[acgt]>[acgt]\b/g },
  // Protein World, the author's words and direct synonyms.
  {
    world: "protein",
    strong: true,
    re: /\b(proteins?|proteines?|structures?|structural|3-?d|three-dimensional|shapes?|formes?|residues?|residus?|amino acids?|acides? amines?|fold|folds|folded|folding|effects?|effets?|affect\w*|crystal\w*|cristal\w*|x-ray|pdb|2hbs|alphafold)\b|\bwhat (it|this|that|the [\w-]+( [\w-]+)?) does\b|\bwhat does (it|this|that|the [\w-]+( [\w-]+)?) do\b/g,
  },
  // Protein World, weaker: structure vocabulary and the names of amino acids.
  {
    world: "protein",
    strong: false,
    re: /\b(chains?|chaines?|contacts?|touch\w*|interact\w*|neighbou?r\w*|alanine|arginine|asparagine|aspartate|aspartic acid|cysteine|glutamine|glutamate|glutamic acid|glycine|histidine|isoleucine|leucine|lysine|methionine|phenylalanine|proline|serine|threonine|tryptophan|tyrosine|valine)\b/g,
  },
];

const D008 = CUES;
/**
 * The D-H010 cue lists: the D-H008 lists with "chain" moved to the strong protein cues, the gene
 * words added to the weak DNA cues, and the molecule names added as protein cues (strong, beaten by
 * any DNA cue). Matched on folded text in which the Greek letter beta is spelled "beta".
 */
export const CUES_DH010: readonly Cue[] = [
  D008[0]!,
  { world: "dna", strong: false, re: /\b(transcripts?|mrna|arnm|gag|gtg|genes?|genomic|genomique|genomes?|locus|loci|chromosomes?)\b|\bc\.\d+[acgt]>[acgt]\b/g },
  D008[2]!,
  { world: "protein", strong: true, re: /\b(chains?|chaines?)\b/g },
  {
    world: "protein",
    strong: false,
    re: /\b(contacts?|touch\w*|interact\w*|neighbou?r\w*|alanine|arginine|asparagine|aspartate|aspartic acid|cysteine|glutamine|glutamate|glutamic acid|glycine|histidine|isoleucine|leucine|lysine|methionine|phenylalanine|proline|serine|threonine|tryptophan|tyrosine|valine)\b/g,
  },
  { world: "protein", strong: true, molecule: true, re: /\b((deoxy|oxy|carboxy|met)?ha?emoglobin(e|s)?|beta[- ]?globine?s?|hbb)\b/g },
];

export interface QuestionCues {
  version: string;
  /** Cue words found, per world, in order of appearance (folded). */
  dna: string[];
  protein: string[];
  /** Whether a strong cue of that world was found. */
  strong: { dna: boolean; protein: boolean };
  /** The world the question names: one world, "both" (mixed), or null (neutral). */
  named: "dna" | "protein" | "both" | null;
  /** D-H010 lists only: the molecule names found (also listed in `protein`). */
  molecule?: string[];
}

/** The cue words of a question. Deterministic; never asks a model. */
export function questionCues(query: string, rules: CueRules = "dh008"): QuestionCues {
  if (rules === "dh010") return questionCuesDh010(query);
  const q = fold(query);
  const found: { dna: string[]; protein: string[] } = { dna: [], protein: [] };
  const strong = { dna: false, protein: false };
  for (const c of CUES) {
    for (const m of q.matchAll(c.re)) {
      found[c.world].push(m[0]);
      if (c.strong) strong[c.world] = true;
    }
  }
  const named = found.dna.length > 0 && found.protein.length > 0 ? "both" : found.dna.length > 0 ? "dna" : found.protein.length > 0 ? "protein" : null;
  return { version: ROUTING_VERSION, dna: found.dna, protein: found.protein, strong, named };
}

/**
 * D-H010: a molecule name counts for Protein World only when the question has no DNA cue; a DNA
 * cue with an explicit protein cue is mixed. Matches are listed in order of appearance.
 */
function questionCuesDh010(query: string): QuestionCues {
  const q = fold(query).replace(/β/g, "beta");
  const hits: { at: number; world: "dna" | "protein"; word: string; strong: boolean; molecule: boolean }[] = [];
  for (const c of CUES_DH010) for (const m of q.matchAll(c.re)) hits.push({ at: m.index, world: c.world, word: m[0], strong: c.strong, molecule: !!c.molecule });
  hits.sort((a, b) => a.at - b.at);
  const dna = hits.filter((h) => h.world === "dna");
  const protein = hits.filter((h) => h.world === "protein");
  const explicitProtein = protein.filter((h) => !h.molecule);
  const molecule = protein.filter((h) => h.molecule);
  const named = dna.length > 0 ? (explicitProtein.length > 0 ? "both" : "dna") : protein.length > 0 ? "protein" : null;
  // A molecule name beaten by a DNA cue does not make the protein side strong.
  const proteinStrong = explicitProtein.some((h) => h.strong) || (dna.length === 0 && molecule.length > 0);
  return {
    version: ROUTING_VERSION_DH010,
    dna: dna.map((h) => h.word),
    protein: protein.map((h) => h.word),
    strong: { dna: dna.some((h) => h.strong), protein: proteinStrong },
    named,
    molecule: molecule.map((h) => h.word),
  };
}

export interface Routing {
  cues: QuestionCues;
  /** Where the answer goes: the named world, else the current world; null when the question names both. */
  world: World | null;
  why: "named" | "current-world" | "mixed" | "no-current-world";
}

/** Where a question's answer goes under D-H008 (or D-H010's lists), given the world on screen. */
export function routeQuestion(query: string, currentWorld: World | undefined, rules: CueRules = "dh008"): Routing {
  const cues = questionCues(query, rules);
  if (cues.named === "dna" || cues.named === "protein") return { cues, world: cues.named, why: "named" };
  if (cues.named === "both") return { cues, world: null, why: "mixed" };
  if (currentWorld === undefined) return { cues, world: null, why: "no-current-world" };
  return { cues, world: currentWorld, why: "current-world" };
}

/**
 * The world a question names without any doubt, for the validator (conservative): cues of one
 * world only, at least one of them strong. Weak-only or mixed questions give null.
 */
export function unambiguousCueWorld(query: string, rules: CueRules = "dh008"): "dna" | "protein" | null {
  const c = questionCues(query, rules);
  if (c.named === "dna" && c.strong.dna) return "dna";
  if (c.named === "protein" && c.strong.protein) return "protein";
  return null;
}
