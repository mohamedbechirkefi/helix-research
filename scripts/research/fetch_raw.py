# SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
"""Fetch raw records for Phase 1 research and record a manifest.

Usage: python scripts/research/fetch_raw.py <source> <name> <url> [--accept MIME] [--post-json FILE]

Saves research/raw/<source>/<name> and appends a line (URL, UTC date,
sha256, HTTP status, selected response headers) to
research/raw/<source>/MANIFEST.tsv. Standard library only.
"""
import argparse, datetime, hashlib, json, pathlib, sys, time, urllib.request, urllib.error

UA = "helix-research (Mohamed Bechir Kefi)"
ROOT = pathlib.Path(__file__).resolve().parents[2] / "research" / "raw"
KEEP = ["content-type", "x-uniprot-release", "x-uniprot-release-date", "interpro-version",
        "x-ratelimit-limit", "x-ratelimit-remaining", "last-modified", "etag"]

def main():
    p = argparse.ArgumentParser()
    p.add_argument("source"); p.add_argument("name"); p.add_argument("url")
    p.add_argument("--accept", default=None)
    p.add_argument("--post-json", default=None)
    a = p.parse_args()
    headers = {"User-Agent": UA}
    if a.accept:
        headers["Accept"] = a.accept
    data = None
    if a.post_json:
        data = pathlib.Path(a.post_json).read_bytes()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(a.url, data=data, headers=headers)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body, status, hdrs = r.read(), r.status, r.headers
            break
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < 3:
                wait = float(e.headers.get("Retry-After", 2 ** attempt))
                time.sleep(wait); continue
            body, status, hdrs = e.read(), e.code, e.headers
            break
    out = ROOT / a.source
    out.mkdir(parents=True, exist_ok=True)
    (out / a.name).write_bytes(body)
    sha = hashlib.sha256(body).hexdigest()
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    kept = {k: hdrs.get(k) for k in KEEP if hdrs.get(k)}
    man = out / "MANIFEST.tsv"
    if not man.exists():
        man.write_text("file\tretrieved_utc\thttp_status\tsha256\tbytes\tmethod\turl\theaders\n")
    with man.open("a") as f:
        f.write(f"{a.name}\t{now}\t{status}\t{sha}\t{len(body)}\t{'POST' if data else 'GET'}\t{a.url}\t{json.dumps(kept)}\n")
    print(status, len(body), sha[:12], a.name)
    sys.exit(0 if status == 200 else 1)

if __name__ == "__main__":
    main()
