# SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
"""Derive the HbS position mapping from the saved raw records (no network).

Reads research/raw/{uniprot,ensembl,rcsb,pdbe}/ and prints/saves a JSON
table: UniProt P68871 position -> 2HBS beta chains (label/auth seq ids)
with residue names read from pdbx_poly_seq_scheme and atom_site.
"""
import json, pathlib
from Bio.PDB.MMCIF2Dict import MMCIF2Dict
from Bio.Seq import Seq

RAW = pathlib.Path(__file__).resolve().parents[2] / "research" / "raw"
OUT = RAW.parent / "derived" / "hbs_mapping_2HBS.json"

def fasta_seq(p):
    return "".join(l.strip() for l in p.read_text().splitlines() if not l.startswith(">"))

def main():
    uni = json.loads((RAW / "uniprot/P68871.json").read_text())
    useq = uni["sequence"]["value"]
    cds = fasta_seq(RAW / "ensembl/seq_ENST00000335295_cds.fa")
    ensp = fasta_seq(RAW / "ensembl/seq_ENSP00000333994_protein.fa")
    translated = str(Seq(cds).translate(to_stop=True))
    d = MMCIF2Dict(str(RAW / "rcsb/2HBS.cif"))
    ent_ids = d["_entity.id"]; ent_desc = d["_entity.pdbx_description"]
    ep_ids = d["_entity_poly.entity_id"]
    ep_seq = {e: s.replace("\n", "") for e, s in zip(ep_ids, d["_entity_poly.pdbx_seq_one_letter_code_can"])}
    ep_strands = dict(zip(ep_ids, d["_entity_poly.pdbx_strand_id"]))
    beta_entity = [e for e, s in zip(ent_ids, ent_desc) if "BETA" in s.upper()]
    assert len(beta_entity) == 1
    be = beta_entity[0]
    # pdbx_poly_seq_scheme
    pss = list(zip(d["_pdbx_poly_seq_scheme.asym_id"], d["_pdbx_poly_seq_scheme.entity_id"],
                   d["_pdbx_poly_seq_scheme.seq_id"], d["_pdbx_poly_seq_scheme.mon_id"],
                   d["_pdbx_poly_seq_scheme.auth_seq_num"], d["_pdbx_poly_seq_scheme.pdb_strand_id"],
                   d["_pdbx_poly_seq_scheme.pdb_ins_code"]))
    # atom_site: CA atoms of model 1
    atoms = zip(d["_atom_site.label_asym_id"], d["_atom_site.label_seq_id"], d["_atom_site.label_comp_id"],
                d["_atom_site.auth_asym_id"], d["_atom_site.auth_seq_id"], d["_atom_site.auth_comp_id"],
                d["_atom_site.label_atom_id"], d["_atom_site.pdbx_PDB_model_num"], d["_atom_site.label_entity_id"])
    ca = {}
    for la, ls, lc, aa, as_, ac, at, mn, le in atoms:
        if at == "CA" and mn == "1":
            ca[(la, ls)] = dict(label_comp_id=lc, auth_asym_id=aa, auth_seq_id=as_, auth_comp_id=ac, label_entity_id=le)
    # mature offset: entity sequence vs UniProt (exact substring search, recorded, not assumed)
    eseq = ep_seq[be]
    offset = None
    for k in range(len(useq) - len(eseq) + 1):
        mism = sum(1 for a, b in zip(useq[k:k + len(eseq)], eseq) if a != b)
        if mism <= 2:
            offset = k; break
    diffs = [(i + 1, useq[offset + i], eseq[i]) for i in range(len(eseq)) if useq[offset + i] != eseq[i]]
    uni_pos = 7
    label_seq = uni_pos - offset  # entity seq_id is 1-based
    rows = []
    for asym, ent, sid, mon, auth, strand, ins in pss:
        if ent == be and sid == str(label_seq):
            a = ca.get((asym, sid), {})
            rows.append(dict(label_asym_id=asym, label_entity_id=ent, label_seq_id=int(sid),
                             pdbx_poly_seq_scheme_mon_id=mon, auth_asym_id=strand,
                             auth_seq_num=auth, ins_code=ins,
                             atom_site_CA_label_comp_id=a.get("label_comp_id"),
                             atom_site_CA_auth_asym_id=a.get("auth_asym_id"),
                             atom_site_CA_auth_seq_id=a.get("auth_seq_id"),
                             atom_site_CA_auth_comp_id=a.get("auth_comp_id")))
    # neighbouring context in chain B (label 4..8)
    ctx = [dict(label_seq_id=int(sid), mon_id=mon, auth_seq_num=auth, uniprot_pos=int(sid) + offset,
                uniprot_residue=useq[int(sid) + offset - 1])
           for asym, ent, sid, mon, auth, strand, ins in pss if asym == "B" and 3 <= int(sid) <= 9]
    out = dict(
        uniprot_accession=uni["primaryAccession"], uniprot_entry_version=uni["entryAudit"]["entryVersion"],
        uniprot_sequence_version=uni["entryAudit"]["sequenceVersion"], uniprot_length=len(useq),
        uniprot_residue_at_7=useq[6], uniprot_residue_at_6=useq[5],
        cds_length_nt=len(cds), cds_codon_7=cds[18:21], cds_base_c20=cds[19],
        translated_cds_equals_uniprot=translated == useq, ensp_equals_uniprot=ensp == useq,
        beta_entity_id=be, beta_entity_description=ent_desc[ent_ids.index(be)],
        beta_entity_strands=ep_strands[be], beta_entity_length=len(eseq),
        entity_seq_offset_vs_uniprot=offset, entity_vs_uniprot_differences=diffs,
        hbs_uniprot_position=uni_pos, hbs_label_seq_id=label_seq, hbs_rows=rows, chain_B_context=ctx,
        entities={e: dict(description=s, strands=ep_strands.get(e)) for e, s in zip(ent_ids, ent_desc)},
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps(out, indent=2))

if __name__ == "__main__":
    main()
