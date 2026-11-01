# SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
"""List atoms within 4.5 A of the side-chain CG1/CG2 of beta Val6 (auth numbering)
in each beta chain of 2HBS, other chains only, deposited asymmetric unit only
(no crystal symmetry mates). Reads research/raw/rcsb/2HBS.cif, writes
research/derived/val6_contacts_2HBS.json."""
import json, pathlib
from Bio.PDB import MMCIFParser, NeighborSearch
ROOT = pathlib.Path(__file__).resolve().parents[2] / "research"
CUTOFF = 4.5
s = MMCIFParser(QUIET=True, auth_chains=True, auth_residues=True).get_structure("2HBS", str(ROOT / "raw/rcsb/2HBS.cif"))
m = s[0]
ns = NeighborSearch(list(m.get_atoms()))
out = {"cutoff_angstrom": CUTOFF, "numbering": "auth_asym_id / auth_seq_id", "scope": "asymmetric unit, model 1, no symmetry mates", "chains": {}}
for ch in "BDFH":
    r = m[ch][6]
    hits = set()
    for a in r:
        if a.get_id() in ("CG1", "CG2"):
            for b in ns.search(a.coord, CUTOFF):
                p = b.get_parent(); c = p.get_parent().id
                if c != ch:
                    hits.add((c, p.id[1], p.get_resname()))
    out["chains"][ch] = {"residue": r.get_resname(), "contacts": [list(h) for h in sorted(hits)]}
p = ROOT / "derived/val6_contacts_2HBS.json"
p.write_text(json.dumps(out, indent=2) + "\n")
print(json.dumps(out, indent=2))
