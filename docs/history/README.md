
# History rewrite of 2026-11-09

On 2026-11-09, at the author's request, the history of `main` was rewritten to remove local absolute paths (the session scratch folder and the workspace folder) from every commit and commit message. The paths were replaced by `scratchpad/`, `<session>/`, `<helix-workspace>/`, `<research-workspace>/` and `~/`. No other content changed: the tree of the last commit is byte-identical before and after.

Every commit id changed. Documents written before the rewrite cite the old ids; `commit-map-2026-11-09.tsv` maps each old id to its new one (first 7 characters are enough to look one up).
