// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * A small, dependency-free reader for the text form of PDBx/mmCIF (CIF 1.1 syntax).
 * See docs/mmcif-parser.md for why this is not Mol*'s parser or a Python step.
 *
 * Supports: data blocks, single-item categories, loop_ categories, unquoted values,
 * '…' and "…" quoted values (a quote closes only when followed by whitespace),
 * ;-delimited text fields, # comments, and the '.' (inapplicable) and '?' (unknown)
 * markers, which are kept verbatim and read as null by the accessors.
 *
 * Fails with a typed error, never a partial result, on: an unterminated quoted value or
 * text field, a loop whose value count is not a multiple of its column count, a value
 * with no tag, or a file with no data block. Missing categories are reported by the
 * caller (`requireCategories`), since which ones are needed depends on the use.
 */
import { MalformedResponseError, ParseError } from "../http/errors.ts";

export interface CifCategory {
  readonly name: string;
  readonly fields: readonly string[];
  /** Row-major values; rows[i][j] is fields[j] of row i. */
  readonly rows: readonly (readonly string[])[];
}

export interface CifBlock {
  readonly header: string;
  readonly categories: ReadonlyMap<string, CifCategory>;
}

type Token = { t: "data"; v: string } | { t: "loop" } | { t: "tag"; v: string } | { t: "value"; v: string } | { t: "save" };

function isWs(c: string | undefined): boolean {
  return c === " " || c === "\t" || c === "\n" || c === "\r";
}

function* tokenize(text: string, source: string | null): Generator<Token> {
  const n = text.length;
  let i = 0;
  let lineStart = true;
  while (i < n) {
    const c = text[i];
    if (c === "\n") {
      i++;
      lineStart = true;
      continue;
    }
    if (isWs(c)) {
      i++;
      continue;
    }
    if (c === "#") {
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    if (c === ";" && lineStart) {
      // Text field: runs to the next line that starts with ';'.
      const end = text.indexOf("\n;", i + 1);
      if (end < 0) throw new MalformedResponseError(source, "truncated", "", false, `unterminated text field at offset ${i}`);
      let v = text.slice(i + 1, end);
      if (v.endsWith("\r")) v = v.slice(0, -1);
      yield { t: "value", v: v.replace(/^\r?\n/, "") };
      i = end + 2;
      lineStart = false;
      continue;
    }
    lineStart = false;
    if (c === "'" || c === '"') {
      let j = i + 1;
      for (;;) {
        const k = text.indexOf(c, j);
        if (k < 0 || text.slice(i, k).includes("\n")) {
          throw new MalformedResponseError(source, "truncated", "", false, `unterminated quoted value at offset ${i}`);
        }
        if (k + 1 >= n || isWs(text[k + 1])) {
          yield { t: "value", v: text.slice(i + 1, k) };
          i = k + 1;
          break;
        }
        j = k + 1;
      }
      continue;
    }
    let j = i;
    while (j < n && !isWs(text[j])) j++;
    const word = text.slice(i, j);
    i = j;
    const lower = word.toLowerCase();
    if (lower.startsWith("data_")) yield { t: "data", v: word.slice(5) };
    else if (lower === "loop_") yield { t: "loop" };
    else if (lower.startsWith("save_")) yield { t: "save" };
    else if (word.startsWith("_")) yield { t: "tag", v: word };
    else yield { t: "value", v: word };
  }
}

function splitTag(tag: string): [string, string] {
  const dot = tag.indexOf(".");
  if (dot < 0) return [tag.slice(1), ""];
  return [tag.slice(1, dot), tag.slice(dot + 1)];
}

/** Parse the first data block of an mmCIF text. */
export function parseMmcif(text: string, source: string | null = null): CifBlock {
  const it = tokenize(text, source);
  const categories = new Map<string, { fields: string[]; rows: string[][] }>();
  let header: string | null = null;
  let tok = it.next();

  const single = (cat: string, field: string, value: string): void => {
    let c = categories.get(cat);
    if (!c) {
      c = { fields: [], rows: [[]] };
      categories.set(cat, c);
    }
    c.fields.push(field);
    c.rows[0]!.push(value);
  };

  while (!tok.done) {
    const t = tok.value;
    if (t.t === "data") {
      if (header !== null) break; // only the first block
      header = t.v;
      tok = it.next();
    } else if (t.t === "save") {
      throw new ParseError("mmCIF", ["save frames are not supported in model files"], source);
    } else if (t.t === "tag") {
      if (header === null) throw new ParseError("mmCIF", ["tag before data_ block"], source);
      const v = it.next();
      if (v.done || v.value.t !== "value") {
        throw new MalformedResponseError(source, "truncated", "", false, `tag ${t.v} has no value`);
      }
      const [cat, field] = splitTag(t.v);
      single(cat, field, v.value.v);
      tok = it.next();
    } else if (t.t === "loop") {
      if (header === null) throw new ParseError("mmCIF", ["loop_ before data_ block"], source);
      const fields: string[] = [];
      let cat: string | null = null;
      tok = it.next();
      while (!tok.done && tok.value.t === "tag") {
        const [c, f] = splitTag(tok.value.v);
        if (cat !== null && c !== cat) throw new ParseError("mmCIF", [`loop mixes categories ${cat} and ${c}`], source);
        cat = c;
        fields.push(f);
        tok = it.next();
      }
      if (cat === null) {
        if (tok.done) throw new MalformedResponseError(source, "truncated", "", false, "file ends after loop_");
        throw new ParseError("mmCIF", ["loop_ with no tags"], source);
      }
      const values: string[] = [];
      while (!tok.done && tok.value.t === "value") {
        values.push(tok.value.v);
        tok = it.next();
      }
      if (values.length % fields.length !== 0) {
        throw new MalformedResponseError(source, "truncated", "", false, `loop ${cat}: ${values.length} values for ${fields.length} columns`,
        );
      }
      const rows: string[][] = [];
      for (let r = 0; r < values.length; r += fields.length) rows.push(values.slice(r, r + fields.length));
      categories.set(cat, { fields, rows });
    } else {
      throw new ParseError("mmCIF", [`value '${t.v.slice(0, 20)}' without a tag`], source);
    }
  }
  if (header === null) throw new ParseError("mmCIF", ["no data_ block"], source);
  const out = new Map<string, CifCategory>();
  for (const [name, c] of categories) out.set(name, { name, fields: c.fields, rows: c.rows });
  return { header, categories: out };
}

/** '.' and '?' are CIF's inapplicable and unknown markers. */
export function cifNull(v: string | undefined): string | null {
  return v === undefined || v === "." || v === "?" ? null : v;
}

/** Rows of a category as records keyed by field name. Empty array if the category is absent. */
export function rowsOf(block: CifBlock, category: string): Record<string, string>[] {
  const c = block.categories.get(category);
  if (!c) return [];
  return c.rows.map((r) => {
    const o: Record<string, string> = {};
    c.fields.forEach((f, j) => {
      o[f] = r[j] ?? "?";
    });
    return o;
  });
}

export function requireCategories(block: CifBlock, names: readonly string[], source: string | null = null): void {
  const missing = names.filter((n) => !block.categories.has(n));
  if (missing.length > 0) {
    throw new MalformedResponseError(source, "truncated", "", false, `missing mmCIF categories: ${missing.join(", ")}`);
  }
}
