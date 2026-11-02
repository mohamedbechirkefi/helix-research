# SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
"""Check every link in the report files and the DOIs against Crossref.

Usage: python3 -I scripts/report/check_links.py paper/report.en.md paper/report.fr.md > out.tsv
Standard library only. Sends User-Agent "helix-research" and nothing else.
Publisher pages often answer 403 to scripts after a correct DOI redirect, so a
DOI counts as checked when Crossref returns its record (title printed for review).
"""
import json, re, sys, time, urllib.error, urllib.request

UA = {"User-Agent": "helix-research"}
URL_RE = re.compile(r"https?://[^\s)>\]`\"]+")


def fetch(url, tries=3):
    for attempt in range(1, tries + 1):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return r.status, r.geturl(), r.read(), attempt
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == tries:
                return e.code, e.geturl() or url, b"", attempt
        except Exception as e:  # timeouts, resets
            if attempt == tries:
                return f"ERR {type(e).__name__}", url, b"", attempt
        time.sleep(5 * attempt)


urls = sorted({u.rstrip(".,;") for p in sys.argv[1:] for u in URL_RE.findall(open(p, encoding="utf-8").read())})
print("url\tstatus\tfinal_url\tattempts\tcrossref")
bad = 0
for u in urls:
    status, final, _, n = fetch(u)
    cr = ""
    if u.startswith("https://doi.org/"):
        cs, _, body, _ = fetch("https://api.crossref.org/works/" + u[len("https://doi.org/"):])
        if cs == 200:
            m = json.loads(body)["message"]
            cr = f"{m['author'][0].get('family')} | {' '.join(m['title'][0].split())} | {m.get('container-title', [''])[0]} | {m.get('volume')}"
        else:
            cr = f"crossref {cs}"
    ok = status == 200 or (u.startswith("https://doi.org/") and cr and not cr.startswith("crossref"))
    bad += not ok
    print(f"{u}\t{status}\t{final}\t{n}\t{cr}")
    time.sleep(0.5)
print(f"# {len(urls)} links, {bad} failing", file=sys.stderr)
sys.exit(1 if bad else 0)
