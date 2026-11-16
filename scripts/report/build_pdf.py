# SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
"""Build the PDFs of the report and the article, EN and FR, from paper/{report,article}.{en,fr}.md:
markdown -> pandoc (typst writer) -> Typst preamble (title page or title block, outline, list of figures) -> PDF
with the typst Python package. Adapted from the author's Hive report build (hive-graph-selfplay
scripts/build_report.py, same author): the preamble, the table-width model and the breakable code spans.

The sources keep their own chapter numbers ("## 1. Introduction"), so headings are not numbered again; the title,
the subtitle and the hand-written contents list of each source are replaced by the title page and Typst's outline.
Figures are `![caption](figures/x)`, relative to paper/, so the same files render on GitHub.

Tools (none installed system-wide): helix/.tools/pandoc (3.6.3) and helix/.tools/pyreport (typst 0.15.0,
pypdf 6.20.0). Usage, from helix-research:
  ../.tools/pyreport/bin/python -I scripts/report/build_pdf.py [report|article|all] [en|fr|all]
"""

import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PAPER = REPO / "paper"
BUILD = PAPER / "build"
PANDOC = REPO.parent / ".tools" / "pandoc"
FONT_PATHS = ["/System/Library/Fonts", "/System/Library/Fonts/Supplemental", "/Library/Fonts"]
VERSION = "1.0"

STR = {
    "en": dict(
        lang="en", author="Mohamed Bechir Kefi",
        subtitle={"report": "Technical report", "article": "Article"},
        status="Independent research report (not peer-reviewed)",
        version=f"Version {VERSION}", date="16 November 2026",
        contents="Contents", lof="List of figures",
    ),
    "fr": dict(
        lang="fr", author="Mohamed Bechir Kefi",
        subtitle={"report": "Rapport technique", "article": "Article"},
        status="Rapport de recherche indépendant (non évalué par les pairs)",
        version=f"Version {VERSION}", date="16 novembre 2026",
        contents="Table des matières", lof="Liste des figures",
    ),
}


def esc(t):
    return t.replace("\\", "\\\\").replace('"', '\\"')


def preamble(s, title, short):
    head = rf'''
#let horizontalrule = line(start: (25%,0%), end: (75%,0%))
#set document(title: "{esc(title)}", author: "{s['author']}")
#set page(paper: "a4", margin: (top: 2.5cm, bottom: 2.5cm, left: 2.6cm, right: 2.6cm), numbering: "1",
  header: context {{ if counter(page).get().first() > 1 [#set text(size: 8.5pt, fill: luma(90)); #emph[Helix] #h(1fr) #counter(page).display()] }})
#set text(font: "New York", size: 11pt, lang: "{s['lang']}")
#set par(justify: true, leading: 0.62em, spacing: 0.9em)
#show heading.where(level: 1): it => {{ {"" if short else "pagebreak(weak: true);"} v(1.4em); block[#text(size: {16 if short else 20}pt, weight: "bold")[#it.body]]; v(0.8em) }}
#show heading.where(level: 2): it => {{ v(0.9em); block[#text(size: {12.5 if short else 14}pt, weight: "bold")[#it.body]]; v(0.4em) }}
#show heading.where(level: 3): it => {{ v(0.7em); block[#text(size: 11.5pt, weight: "bold", style: "italic")[#it.body]]; v(0.3em) }}
#set table(inset: (x: 4.5pt, y: 3.5pt), stroke: (x, y) => if y == 0 {{ (bottom: 0.8pt, top: 0.8pt) }} else {{ (bottom: 0.3pt + luma(175)) }})
#show table.cell.where(y: 0): strong
#show table: set text(size: 9pt)
#show table: set par(justify: false, leading: 0.5em)
#show table.cell: set align(top)
#show figure.where(kind: table): set figure.caption(position: top)
#set figure.caption(separator: [{' : ' if s['lang'] == 'fr' else ': '}])
#show figure.caption: it => {{ set text(size: 9.5pt); block(width: 94%)[#align(left)[#it]] }}
#set figure(gap: 0.7em)
#show figure: it => {{ v(0.5em); it; v(0.5em) }}
#show heading: set block(sticky: true)
#show link: set text(fill: rgb("#1a3d7c"))
#show raw: set text(font: "Menlo", size: 8.6pt)
#show raw.where(block: true): it => block(fill: luma(246), inset: 7pt, radius: 2pt, width: 100%, it)
#set footnote.entry(separator: line(length: 30%, stroke: 0.4pt))
'''
    if short:
        return head + rf'''
#align(center)[
  #set par(justify: false)
  #set text(hyphenate: false)
  #v(0.4cm)
  #text(size: 18pt, weight: "bold")[{title}]
  #v(0.9em)
  #text(size: 12pt)[{s['author']}]
  #v(0.3em)
  #text(size: 9.5pt, fill: luma(80))[{s['subtitle']['article']}; {s['status']}; {s['version']}, {s['date']}]
  #v(0.9em)
]
'''
    return head + rf'''
#page(numbering: none, header: none)[
  #set par(justify: false)
  #set text(hyphenate: false)
  #v(4.5cm)
  #align(center)[
    #text(size: 23pt, weight: "bold")[{title}]
    #v(0.9em)
    #text(size: 14pt)[{s['subtitle']['report']}]
    #v(3.2cm)
    #text(size: 13pt)[{s['author']}]
    #v(1.6cm)
    #text(size: 10.5pt)[{s['status']}]
    #v(0.35em)
    #text(size: 10.5pt)[{s['version']}, {s['date']}]
  ]
]
#counter(page).update(1)
'''


def outline(s):
    return rf'''
#pagebreak(weak: true)
#outline(title: "{s['contents']}", depth: 2, indent: 1.3em)
#pagebreak(weak: true)
#outline(title: "{s['lof']}", target: figure.where(kind: image))
'''


def split_source(md):
    """Title, front matter (metadata table and notices) and body. The H1 is the title; a following '## ' subtitle
    and the hand-written contents list are dropped (the title page and the outline replace them)."""
    md = re.sub(r"^<!--.*?-->\s*", "", md, flags=re.S)
    lines = md.splitlines()
    title = lines[0].removeprefix("# ").strip()
    rest = lines[1:]
    out, skip = [], False
    for i, l in enumerate(rest):
        if re.match(r"^## (Technical report|Rapport technique)", l):
            continue
        if re.match(r"^\*\*Mohamed Bechir Kefi\*\*$", l):
            continue
        if re.match(r"^## (Contents|Table des matières)\s*$", l):
            skip = True
            continue
        if skip:
            if l.strip() == "---":
                skip = False
            continue
        out.append(l)
    text = "\n".join(out)
    # Horizontal rules separate chapters in the source; chapters start a page (report) or follow on (article).
    text = re.sub(r"(?m)^---\s*$", "", text)
    return title, text


def pandoc(md_text, work):
    tmp = work / "_body.md"
    tmp.write_text(md_text, encoding="utf-8")
    out = work / "_body.typ"
    subprocess.run([str(PANDOC), str(tmp), "-f", "markdown+lists_without_preceding_blankline", "-t", "typst",
                    "--shift-heading-level-by=-1", "--wrap=none", "-o", str(out)], check=True)
    return out.read_text(encoding="utf-8")


TABLE_SEP = re.compile(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$")


def widen_tables(md):
    """Separator dashes proportional to each column's content, so pandoc's relative widths fit the text."""
    lines, out, i = md.splitlines(), [], 0
    TEXT_PT, CODE_PT, TEXT_CH = 453.0, 4.7, 5.0

    def longest_chunk(cell):
        best = 0.0
        for tok in cell.split():
            if tok.startswith("`") or tok.endswith("`"):
                for seg in re.split(r"(?<=[/\-_.,])", tok.strip("`*")):
                    best = max(best, len(seg) * CODE_PT)
            else:
                best = max(best, len(tok) * TEXT_CH)
        return best

    while i < len(lines):
        line = lines[i]
        if TABLE_SEP.match(line) and i > 0 and lines[i - 1].lstrip().startswith("|"):
            j, rows = i + 1, [lines[i - 1]]
            while j < len(lines) and lines[j].lstrip().startswith("|"):
                rows.append(lines[j]); j += 1
            cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
            ncol = max(len(r) for r in cells)
            seps = [c.strip() for c in line.strip().strip("|").split("|")]
            mins, content = [], []
            for k in range(ncol):
                col = [r[k] for r in cells if k < len(r)]
                mins.append(min(max((longest_chunk(c) for c in col), default=20.0) + 12, 300.0))
                content.append(8 + sum(min(len(c), 300) for c in col) / max(1, len(col)))
            spare = TEXT_PT - sum(mins)
            if spare < 0:
                mins = [m * TEXT_PT / sum(mins) for m in mins]
                spare = 0
            tot = float(sum(content))
            new = []
            for k in range(ncol):
                sep = seps[k] if k < len(seps) else "---"
                dashes = "-" * max(3, int(round(mins[k] + spare * content[k] / tot)))
                new.append((":" if sep.startswith(":") else "") + dashes + (":" if sep.endswith(":") else ""))
            out.append("| " + " | ".join(new) + " |")
            i += 1
            continue
        out.append(line)
        i += 1
    return "\n".join(out)


def post(typ):
    """Left-aligned table text; long code tokens made breakable after a separator; bare URLs clickable."""
    typ = "\n".join(l.replace("auto", "left") if l.lstrip().startswith("align: (") else l for l in typ.splitlines())

    def breakable(m):
        inner = m.group(1)
        if " " in inner or len(inner) < 18:
            return m.group(0)
        segs = [x for x in re.split(r"(?<=[/\-_.,])", inner) if x]
        return "#sym.zws".join("`" + x + "`" for x in segs)
    typ = re.sub(r"(?<!`)`([^`\n]+)`(?!`)", breakable, typ)
    url = re.compile(r'(?<![\"\[(])(https?:(?:\\/\\/|//)[^\s\)\]>]+?)(?=[\s\)\]>]|[.,;](?:\s|$)|$)')
    return url.sub(lambda m: '#link("' + m.group(1).replace("\\/", "/") + '")[' + m.group(1) + ']', typ)


def build(kind, lang):
    s = STR[lang]
    short = kind == "article"
    title, body = split_source((PAPER / f"{kind}.{lang}.md").read_text(encoding="utf-8"))
    work = BUILD / f"{kind}-{lang}-work"
    work.mkdir(parents=True, exist_ok=True)
    typ_body = post(pandoc(widen_tables(body), work))
    # The front matter (metadata table, notices) runs until the first chapter heading; the outline goes after it.
    m = re.search(r"(?m)^= ", typ_body)
    front, rest = (typ_body[:m.start()], typ_body[m.start():]) if m else ("", typ_body)
    doc = preamble(s, title, short) + "\n" + front + "\n" + ("" if short else outline(s)) + "\n" + rest
    (BUILD / "figures").mkdir(parents=True, exist_ok=True)
    for f in (PAPER / "figures").iterdir():
        shutil.copy(f, BUILD / "figures" / f.name)
    typ = BUILD / f"{kind}-{lang}.typ"
    typ.write_text(doc, encoding="utf-8")
    import typst
    pdf = typ.with_suffix(".pdf")
    typst.compile(str(typ), output=str(pdf), root=str(BUILD), font_paths=FONT_PATHS)
    from pypdf import PdfReader
    print(f"{pdf.relative_to(REPO)}: {len(PdfReader(str(pdf)).pages)} pages, {pdf.stat().st_size // 1024} KB")


if __name__ == "__main__":
    kinds = ["report", "article"] if len(sys.argv) < 2 or sys.argv[1] == "all" else [sys.argv[1]]
    langs = ["en", "fr"] if len(sys.argv) < 3 or sys.argv[2] == "all" else [sys.argv[2]]
    for k in kinds:
        for l in langs:
            build(k, l)
