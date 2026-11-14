<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Helix : exploration dirigée par l'IA et liée aux preuves, du génome à la structure des protéines

## Rapport technique, copie française de la version maîtresse anglaise

| | |
|---|---|
| Auteur | Mohamed Bechir Kefi |
| Version | Version de travail 0.8, 2026-11-14 |
| Statut | Chapitres 1 à 8, 9.1 à 9.8, 10 et 11 rédigés (phases 0 à 11, jusqu'à l'exécution de la revue de passage de la phase 11). La section 9.9 (phase 12) est une section d'attente comportant uniquement son titre. |
| Fichiers associés | Registre des affirmations `paper/claims.md` ; journal des expériences `journal/` |
| Copie française | `paper/report.fr.md`, produite pour la première fois après la phase 4 (voir `paper/README.md`) |
| Statut de cette copie | Deuxième copie française, établie à partir de la version anglaise de travail 0.6 du 2026-11-02 ; en cas de divergence, la version anglaise fait foi jusqu'à la relecture de l'auteur. |
| Licence | Helix Source-Available Non-Commercial Research License v1.0 (voir `LICENSE`) |

**Avertissement non clinique.** Helix est un projet de recherche et d'enseignement. Rien dans ce rapport ne constitue un diagnostic, une interprétation de variant pour une personne ou un avis médical. Les classifications ClinVar sont rapportées en tant qu'enregistrements, et non en tant que recommandations.

**Comment lire les preuves.**
- Les identifiants d'affirmation tels que **[C07]** renvoient aux lignes de `paper/claims.md`.
- Les identifiants de journal tels que `HX-P1-2026-11-01-hbs-mapping` renvoient aux entrées de `journal/`.
- Chaque nombre de ce rapport provient de l'un d'eux. Les entrées de journal des phases 1 et 2 ont été rédigées rétrospectivement le 2026-11-01 à partir des preuves consignées ; leur première ligne le précise.

---

## Table des matières

1. Introduction
2. Contexte scientifique
3. Travaux connexes
4. Données et modèle scientifique (phases 1 et 2)
5. Faisabilité du rendu (phase 1)
6. Faisabilité de l'application de bureau (phase 1, amendement A-1)
7. Noyau de données et validation (phase 2)
8. IA locale et dans le navigateur : faisabilité et évaluation (phase 3)
9. Phases ultérieures (phases 4 à 12) [sections d'attente]
10. Limites et menaces à la validité
11. Éthique, licences, vie privée et coût
12. Déclaration d'utilisation de l'IA
13. Reproduction
14. Bibliographie

Annexe A. Carte des phases et index des preuves

---

## 1. Introduction

### 1.1 Problème

Une personne qui lit que la drépanocytose est causée par « le changement d'une seule lettre dans le gène de la bêta-globine » n'a aucun moyen simple de voir ce que cette phrase signifie à chaque échelle. Le changement se situe à plusieurs endroits à la fois :

- une position sur le chromosome 11 ;
- un codon dans un transcrit ;
- un acide aminé dans une protéine ;
- une valine à la surface d'un tétramère d'hémoglobine cristallisé.

Les ressources publiques qui contiennent chacun de ces faits sont excellentes mais séparées : Ensembl pour les génomes et les transcrits, UniProt pour les protéines, la Protein Data Bank pour les structures, ClinVar pour les assertions cliniques. Chacune utilise son propre système de coordonnées et sa propre convention de numérotation. Passer correctement de l'une à l'autre est un travail d'expert. Ce rapport documente un piège concret : pour la structure même la plus souvent utilisée pour montrer l'hémoglobine S, l'entrée PDB 2HBS, la numérotation du fichier déposé diffère d'une position de la numérotation UniProt actuelle (section 4.4).

Les grands modèles de langage incitent à répondre à une question en langage naturel en laissant un modèle « piloter » une visionneuse moléculaire. Ces mêmes modèles produisent des identifiants plausibles mais faux. Dans l'expérience de bureau de ce projet, un modèle local à qui l'on demandait de montrer la structure de la drépanocytose a renvoyé un plan bien formé pour la mauvaise entrée PDB (section 6.4) [C23].

### 1.2 Objectif

Helix est un environnement interactif dans lequel ce sont les données scientifiques réelles, et non la mémoire d'un modèle, qui déterminent ce qui est affiché. La question d'un utilisateur peut être interprétée par un modèle d'IA. La sortie du modèle n'est qu'un plan proposé d'actions typées. Un exécuteur déterministe vérifie chaque identifiant par rapport à des enregistrements vérifiés avant que quoi que ce soit ne change à l'écran, et chaque fait affiché porte sa provenance.

L'objectif produit est un parcours cinématographique et multi-échelle de l'ADN à la structure des protéines. L'objectif de recherche, que couvre ce rapport, est d'établir, preuves à l'appui :

1. que la correspondance scientifique entre les échelles peut être calculée et vérifiée à partir de sources publiques, sans positions saisies à la main (chapitres 4 et 7) ;
2. qu'un moteur de rendu moléculaire mature peut être coordonné avec une couche 3D cinématographique sans perte de fidélité scientifique (chapitre 5) ;
3. que le même code peut s'exécuter comme application web et comme application de bureau avec une IA locale (chapitre 6) ;
4. quels modèles d'IA gratuits, s'il en existe, peuvent proposer des plans de manière suffisamment fiable pour être utiles une fois chaque plan validé (chapitre 8, phase 3) ;
5. que la chaîne complète, de la question à l'action validée puis au monde rendu, fonctionne de bout en bout (chapitres 9.1 et suivants).

### 1.3 Périmètre de la première tranche

La première tranche verticale porte sur un seul gène et un seul variant : HBB (bêta-globine) et l'allèle HbS, cause de la drépanocytose. Cette tranche a été choisie parce que :

- elle est bien caractérisée scientifiquement ;
- elle dispose d'une structure expérimentale de la protéine mutante (2HBS) ;
- elle met à l'épreuve chacune des parties difficiles de la correspondance : un gène sur le brin inverse, un rsID multi-allélique, le retrait de la méthionine initiatrice, une numérotation historique et un contact situé hors de l'assemblage biologique par défaut.

La généralisation à d'autres gènes relève de la phase 9.

### 1.4 Méthode et phase 0

Le projet suit une feuille de route écrite (`helix/ROADMAP.md`, fichier de continuité privé) comportant les phases 0 à 12. Chaque phase comporte des tâches, des livrables, des preuves et une revue de passage. Un fichier de progression consigne l'état, les décisions et l'historique des sessions.

La phase 0 a établi :
- les dépôts : un dépôt de recherche public sous une licence non commerciale à code source consultable, et un dépôt produit privé ;
- les fichiers de continuité ;
- un audit de la machine de référence (Apple M1 Pro, 10 cœurs, 16 Go, macOS 15.3.1) ;
- la politique d'outillage : installations gratuites en espace utilisateur uniquement, versions figées sur des publications datant d'au moins deux semaines.

Trois règles de l'espace de recherche s'appliquent tout au long du projet :
- chaque expérience est consignée au journal, résultats négatifs compris ;
- chaque nombre renvoie à une preuve ;
- chaque affirmation a une ligne dans le registre des affirmations.

Ces règles ont été adoptées pour Helix le 2026-11-01 (décision D-053 de l'espace de travail). Les phases 0 à 2 ont ensuite été documentées rétroactivement à partir des preuves existantes.

### 1.5 Contributions à ce jour

- Une correspondance vérifiée, source par source, de HbS depuis la coordonnée GRCh38 jusqu'au résidu de 2HBS, chaque étape étant confirmée par deux enregistrements indépendants ou plus (chapitre 4) [C04 à C09].
- La documentation d'une incohérence de numérotation à l'intérieur du fichier 2HBS qui conduirait un analyseur naïf à mettre en évidence le mauvais résidu (section 4.4) [C08].
- La preuve que la vue par défaut de 2HBS dans Mol* ne peut pas montrer le contact latéral de HbS, et l'explication de ce fait (section 4.5) [C10, C11].
- Une étude de faisabilité mesurée de la coordination de Mol* avec un canevas React Three Fiber, aboutissant à une décision d'architecture consignée (chapitre 5) [C13 à C19].
- Une étude de faisabilité mesurée d'une version de bureau Tauri avec IA locale (chapitre 6) [C20 à C23].
- Un jeu de données HBB curé et reproductible, construit par du code à partir des sources en ligne, avec 46 vérifications scientifiques qui échouent de manière sûre (chapitre 7) [C24 à C26].

---

## 2. Contexte scientifique

Ce chapitre résume les notions dont Helix dépend. Le guide complet, avec les sources de chaque énoncé, est `docs/scientific-research.md` (21 sections). Les conventions et les pièges figurent dans `docs/scientific-model-and-coordinate-mapping.md`.

### 2.1 Du génome à la protéine

- **L'ADN** est double brin. Un gène peut être lu à partir de l'un ou l'autre brin. HBB se trouve sur le brin inverse du chromosome 11 ; ses bases codantes sont donc les compléments des bases du brin direct que rapportent les navigateurs de génome et les fichiers VCF.
- **Les assemblages de référence** (GRCh38 et l'ancien GRCh37) définissent les coordonnées. La même base a des positions différentes dans les deux assemblages ; Helix n'affiche que GRCh38.
- **Un gène a de nombreux transcrits.** En choisir un selon sa longueur ou son ordre dans une liste est une source d'erreur connue. L'ensemble MANE Select, effort conjoint du NCBI et de l'EMBL-EBI, désigne pour chaque gène codant pour une protéine un transcrit identique dans Ensembl et RefSeq. HGVS le recommande pour décrire les variants chez l'humain.
- **La traduction** lit la séquence codante (CDS) codon par codon à partir de l'ATG. HGVS numérote les positions codantes à partir de c.1 au A de l'ATG, et les positions protéiques à partir de p.1 à la méthionine initiatrice.

### 2.2 Les variants et leurs noms

- **Un identifiant dbSNP n'est pas un allèle.** rs334 possède quatre allèles à la même position (T, A, C, G) ; un seul d'entre eux est HbS [C05].
- **HGVS** fournit les descriptions génomique (g.), codante (c.) et protéique (p.) ; **SPDI** fournit une description non ambiguë en base 0. Helix effectue la conversion entre elles dans le code et vérifie cette conversion (vérification T10).

### 2.3 Numérotation des protéines et structures

- **UniProt** numérote les résidus à partir de la méthionine initiatrice. Pour la bêta-globine, cette méthionine est retirée dans la protéine mature ; la littérature classique sur l'hémoglobine appelle donc la mutation drépanocytaire « Glu6Val » (E6V), tandis que HGVS et UniProt appellent le même changement p.Glu7Val.
- **Les entrées PDB** portent deux schémas de numérotation des résidus :
  - `label_*` : le schéma séquentiel du mmCIF ;
  - `auth_*` : le schéma des auteurs.

  Ils coïncident souvent, sans que cela soit garanti. La correspondance entre UniProt et un résidu PDB doit provenir de SIFTS, la correspondance au niveau du résidu maintenue par PDBe, ou d'un alignement explicite.
- **Unité asymétrique et assemblage biologique.** L'unité asymétrique d'un cristal peut contenir plusieurs copies d'une molécule. Un assemblage biologique est un sous-ensemble choisi ou une expansion par symétrie. Dans 2HBS, l'unité asymétrique contient deux tétramères d'hémoglobine, et l'assemblage 1 n'est que le premier d'entre eux.

### 2.4 Classes de preuve

Helix étiquette chaque énoncé affiché avec l'une de six classes de preuve, définies dans `packages/shared-types`. Exemples : observation expérimentale dans une structure déposée (classe 1) ; enregistrement d'une base de données curée (classe 2) ; valeur calculée à partir d'enregistrements (classe 3) ; inférence (classe 4). Une prédiction AlphaFold est étiquetée comme prédite et n'est jamais utilisée pour positionner un variant (vérification T32).

---

## 3. Travaux connexes

L'analyse complète est `docs/competitor-analysis.md`. Elle couvre treize outils et trois œuvres de narration moléculaire selon huit dimensions : fonctionnalités, limites, extensibilité, licence, performance, accessibilité, conception visuelle et prise en charge de l'IA. Sa méthode distingue les faits tirés d'une source primaire citée, les inférences au raisonnement explicité et les hypothèses restant à tester. Ce chapitre résume ce qui importe pour Helix.

### 3.1 Ressources sur les génomes et les protéines

**Navigateurs de génome.**
- Ensembl fournit l'API REST utilisée ici (version 116).
- Le UCSC Genome Browser et IGV sont des visionneuses à pistes de coordonnées dotées d'API documentées. Aucun des deux n'offre de vue de structure protéique.
- La plateforme Ensembl est en transition : la version 116 a été annoncée comme la dernière sur les plateformes actuelles, et le dépôt REST a été archivé le 2026-10-16. Il s'agit d'un risque consigné pour Helix [Ensembl 116 news; Ensembl new website news].

**Visionneuses centrées sur les protéines.**
- La visionneuse de caractéristiques d'UniProt (construite sur les composants web Nightingale) relie les caractéristiques de séquence à un panneau de structure.
- AlphaFold DB relie l'erreur d'alignement prédite à une vue 3D.
- Ces visionneuses sont reliées entre elles plutôt qu'unifiées à travers les échelles.

### 3.2 Visionneuses moléculaires et scènes déclaratives

- **Mol\*** est la visionneuse de structures de RCSB PDB et de PDBe [Sehnal et al. 2021]. Elle offre quatre niveaux d'intégration, de la visionneuse prête à l'emploi au canevas nu. Le clic pour centrer la vue sur un résidu et son environnement est la norme sur rcsb.org.
- **MolViewSpec** (MVS) est un format JSON déclaratif et validé pour les scènes moléculaires, implémenté comme extension de Mol* [Midlik et al. 2025].
- **iCn3D** synchronise des vues 1D, 2D et 3D et prend en charge des pistes d'annotation ClinVar.

### 3.3 Narration moléculaire

- **MolViewStories** fournit déjà des récits moléculaires rédigés, narrés et multi-scènes, avec transitions et texte interactif, construits sur MVS [Slanináková et al. 2026].
- **PDB-101 Molecule of the Month** raconte l'histoire de l'hémoglobine et de la drépanocytose et renvoie à 2HBS ; il utilise la numérotation mature « glutamate 6 » [PDB-101 Hemoglobin].
- Helix ne revendique donc aucune nouveauté pour la narration, la mise en évidence de résidus ou les scènes déclaratives [C29].

### 3.4 Visionneuses pilotées par l'IA

Le voisin le plus proche de la couche d'IA de Helix se trouve sur la branche master non publiée de Mol* : un cadre d'agent et un agent de visionneuse dotés d'outils typés, d'une fonction d'annulation, de politiques d'approbation et d'un traitement du texte non fiable [Mol* packages/ai; Mol* Prism agent spec]. Il est généraliste et fonctionne avec la clé fournie par l'utilisateur. S'il est publié, les actions d'IA de Helix au niveau de la structure ressembleront à un sous-ensemble d'une fonctionnalité amont gratuite (risque R1 de l'analyse).

### 3.5 Positionnement de Helix

L'analyse n'a trouvé aucun voisin qui relie un même plan d'action validé aux coordonnées du génome, de la protéine et de la structure à la fois, avec un enregistrement de provenance par action [C28]. Cette combinaison constitue la différenciation proposée, avec :
- la relecture déterministe des plans sans modèle ;
- les transitions entre échelles ;
- une version de bureau hors ligne avec IA locale.

Il s'agit d'une inférence à partir des sources lues le 2026-11-01, et non d'une prétention à l'antériorité. Deux hypothèses de l'analyse nécessitent une étude auprès d'utilisateurs, et non un avis d'expert :
- qu'un parcours continu soit plus clair que des visionneuses reliées ;
- qu'une interaction haut de gamme favorise la compréhension.

---

## 4. Données et modèle scientifique (phases 1 et 2)

### 4.1 Questions

1. Chaque enregistrement nécessaire à la tranche HBB peut-il être obtenu gratuitement, sans authentification, avec une provenance suffisante pour citer chaque valeur ?
2. L'allèle HbS peut-il être mis en correspondance du génome à la structure sans aucune position saisie à la main, chaque étape étant confirmée de manière indépendante ?
3. Un navigateur peut-il interroger directement les sources ?

### 4.2 Sources et acquisition

Un script fondé sur la seule bibliothèque standard a récupéré chaque enregistrement auprès de quatorze sources publiques le 2026-11-01, entre 18:14:50Z et 18:30:30Z :
- Ensembl (GRCh38 et le service GRCh37), UniProt, RCSB, PDBe/SIFTS, AlphaFold DB ;
- NCBI ClinVar et NCBI Gene, HGNC ;
- Reactome, InterPro, QuickGO, Gene Ontology, Open Targets.

Chaque réponse est stockée avec une ligne de manifeste indiquant l'heure UTC, le statut HTTP, le sha256, la taille, l'URL et les en-têtes de version. Les manifestes recensent 40 enregistrements, tous renvoyés avec le statut HTTP 200 [C01]. Aucune clé, aucun compte ni aucun paiement n'a été nécessaire, et le projet a dépensé $0 [C02].

Tableau 4.1. Versions figurant dans l'instantané (`research/raw/README.md`, `docs/data-source-registry.md`).

| Source | Version | Licence des données (résumé) |
|---|---|---|
| Ensembl | 116 (REST 15.12) | Sans restriction ; contenus de tiers exceptés |
| UniProt | 2026_03 (2026-09-02) | CC BY 4.0 |
| RCSB PDB, PDBe/SIFTS | 2HBS révision 1.5 (2026-08-12) | CC0 1.0 |
| AlphaFold DB | modèle v6 | CC BY 4.0, avertissement intégré au fichier conservé |
| ClinVar | Build261025-1250.1 (2026-10-25) | Œuvre du gouvernement des États-Unis ; réserve relative aux soumetteurs |
| HGNC | lastModified 2026-10-30 | CC0 |

Deux étapes de curation ont été appliquées (`journal/2026-11-01-raw-snapshot.md`).

- **Identifiants propriétaires retirés** [C03] :
  - les numéros OMIM/MIM dans les enregistrements UniProt, HGNC, NCBI Gene et ClinVar ;
  - les numéros d'accès HGMD dans la sortie de VEP.

  Ils renvoient à des ressources dont les conditions n'autorisent pas la redistribution. L'auteur a décidé de ne conserver que les données dont Helix a besoin. Chaque fichier expurgé conserve, dans sa ligne de manifeste, l'empreinte de la réponse d'origine.
- **Pages d'erreur retirées.** Deux pages d'erreur HTTP 500 d'Ensembl ont été supprimées ; la nouvelle tentative valide a été conservée.

### 4.3 La correspondance du génome au résidu

Le tableau 4.2 présente la correspondance et les enregistrements qui confirment chaque étape. La dérivation complète, avec chaque URL, est `research/hbs-mapping-note.md`.

Tableau 4.2. HbS à travers les couches (`journal/2026-11-01-hbs-mapping.md`).

| Couche | Valeur | Confirmé par |
|---|---|---|
| Gène | HBB, ENSG00000244734.6, GRCh38 chr11:5225464-5229395, brin inverse [C04] | Requête lookup d'Ensembl |
| Transcrit | ENST00000335295.4 = NM_000518.5, MANE Select, 628 nt en trois exons [C04] | Ensembl, HGNC, UniProt |
| Codon | codon 7 = GAG, c.20 = A ; génome 11:5227001-5227003 | Séquence Ensembl et `map/cds` |
| Allèle | rs334 a les allèles T/A/C/G ; HbS est l'allèle A : NC_000011.10:g.5227002T>A, c.20A>T, p.Glu7Val [C05] | variant_recoder d'Ensembl, ClinVar |
| Protéine | CDS traduite = ENSP00000333994.3 = UniProt P68871, 147 aa [C06] | Traduction Biopython, Ensembl, UniProt |
| Annotation UniProt | VAR_002863 en position 7, E vers V, dbSNP rs334 | UniProt |
| Numérotation mature | Met1 retirée, chaîne 2-147, donc p.7 = mature 6 (« E6V ») | Caractéristiques UniProt ; `pdbx_mutation` de 2HBS |
| Structure | 2HBS entité 2, chaînes bêta B, D, F, H : label_seq_id 6 = auth_seq_id 6 = VAL [C07] | SIFTS, alignement RCSB, référence croisée PDB d'UniProt, `atom_site` |
| Enregistrement clinique | VCV000015333.183, Pathogenic (critères fournis, plusieurs soumetteurs, aucun conflit) [C09] ; version .184 lors de la reconstruction de la phase 6 (section 9.3) | ClinVar |

Trois points méritent d'être soulignés.

- **L'inversion de brin.** Comme HBB est sur le brin inverse, le changement HbS est T>A sur le brin direct du génome et A>T sur le brin codant. La vérification T09 contrôle le complément à partir de la fenêtre génomique.
- **Le rsID n'est pas le variant.** À la même position, l'allèle C donne p.Glu7Gly et l'allèle G donne p.Glu7Ala (Hb G-Makassar). Helix associe le variant à l'allèle et à sa description HGVS g., jamais à rs334 seul.
- **La liste agrégée des traits de ClinVar n'est pas une liste d'effets.** La liste des traits de l'enregistrement rassemble les traits de toutes les soumissions, y compris la bêta-thalassémie et la susceptibilité au paludisme. Helix ne stocke que leur nombre, accompagné de cette remarque, et n'en tire aucun énoncé causal.

### 4.4 Une incohérence de numérotation à l'intérieur du fichier de structure

Le mmCIF de 2HBS contient sa propre référence à UniProt P68871 :
- `_struct_ref_seq` aligne les chaînes bêta sur les positions 1-146 ;
- `_struct_ref_seq_dif` place le variant à la position 6 de P68871.

UniProt numérote actuellement ce même glutamate 7. Le fichier utilise la numérotation mature historique tout en citant le numéro d'accès UniProt.

SIFTS, l'enregistrement d'alignement de RCSB et la référence croisée propre à UniProt font tous correspondre les positions UniProt 2-147 aux résidus 1-146. Ils concordent entre eux et divergent du fichier.

Un analyseur qui ferait confiance aux catégories de référence du fichier sélectionnerait le label 7 de la chaîne B, qui est un GLU, et non la VAL mutante [C08]. Helix adopte donc SIFTS comme correspondance de référence. Il la contre-vérifie avec son propre alignement global (décalage 1, identité 0.9932, un seul mésappariement, au niveau du variant), et il consigne dans le jeu de données ce que `_struct_ref_seq` aurait sélectionné (vérification T25).

Deux précautions supplémentaires découlent du même fichier :
- les numérotations label et auth coïncident pour chaque résidu de polymère de 2HBS, mais pas pour les non-polymères : l'hème de chaîne label J a la chaîne auth B et le numéro auth 153 ;
- le décalage d'une position est une propriété de cette protéine et de cette entrée. Helix le calcule pour chaque entrée et ne le code jamais en dur.

### 4.5 Où la valine mutante touche une autre molécule

La publication principale associée à la structure décrit le double brin de la fibre drépanocytaire comme stabilisé par des « lateral contacts involving the mutant valine interacting with a pocket between the E and F helices on another tetramer » (contacts latéraux faisant intervenir la valine mutante, en interaction avec une poche située entre les hélices E et F d'un autre tétramère) [Harrington et al. 1997].

Dans l'unité asymétrique déposée (seuil de 4.5 A, atomes de la chaîne latérale du résidu 6, sans copies symétriques) :
- seule la valine de la chaîne H est en contact avec une autre chaîne : les résidus Ala70, Asp73, Thr84, Phe85 et Leu88 de la chaîne B ;
- les valines des chaînes B, D et F n'ont aucun contact inter-chaînes dans le fichier [C10].

Tableau 4.3. Contacts de Val6 dans l'unité asymétrique de 2HBS (`research/derived/val6_contacts_2HBS.json`).

| Chaîne bêta | Contacts à moins de 4.5 A |
|---|---|
| B | aucun |
| D | aucun |
| F | aucun |
| H | B : ALA 70, ASP 73, THR 84, PHE 85, LEU 88 (et deux molécules d'eau) |

**Inférence (non vérifiée) :** le contact de H vers B est le contact latéral que décrivent les auteurs, observé une fois à l'intérieur de l'unité asymétrique. Les trois autres valines forment vraisemblablement le même type de contact avec des tétramères liés par symétrie qui ne figurent pas dans le fichier.

L'assemblage 1 (chaînes A à D), qui est ce qu'une visionneuse affiche par défaut, ne contient aucun contact de ce type [C11]. Helix doit donc charger l'unité asymétrique pour cette vue et étiqueter le contact comme un contact dans le cristal, et non comme une observation dans les cellules.

### 4.6 Accès direct depuis le navigateur

Chaque source a été sondée par une requête préalable (preflight) et par une requête GET portant un en-tête Origin [C12]. Chaque source a répondu à la requête GET avec un `Access-Control-Allow-Origin` qui admet une page web, mais sous trois contraintes :
- les requêtes préalables vers files.rcsb.org, models.rcsb.org et HGNC échouent ; les requêtes qui leur sont adressées doivent donc rester « simples » (sans en-têtes personnalisés) ;
- Ensembl n'expose aucun en-tête de réponse ; un navigateur ne peut donc pas lire son `Retry-After` et doit temporiser à l'aveugle ;
- un navigateur ne peut pas définir `User-Agent`, et le paramètre `email` du NCBI exposerait une adresse dans un paquet public. Helix n'envoie que `tool`.

Conséquences pour la conception :
- le parcours curé fonctionne hors ligne à partir de données embarquées ;
- les appels en ligne constituent une amélioration, placée derrière des adaptateurs dotés de délais d'expiration, de nouvelles tentatives et d'un seau à jetons par source réglé en dessous de chaque limite documentée.

---

## 5. Faisabilité du rendu (phase 1)

### 5.1 Question

Helix doit-il dessiner les structures moléculaires et les couches cinématographiques (ADN, chromosome, cellule, transitions) dans un même canevas partagé, ou dans des moteurs de rendu distincts maintenus synchronisés par un état partagé ? Le prompt maître demande que la coordination soit prototypée avant d'envisager un canevas unifié.

### 5.2 Mol* intégré dans une page web

Mol* 5.13.1 a été intégré dans une page Vite et React, en chargeant 2HBS et en ciblant le résidu 6 de la chaîne H (`journal/2026-11-01-molstar-embed.md`). Les mesures ont été effectuées dans Chrome 156 sans interface (headless) avec le GPU Apple (ANGLE Metal), avec un nouveau contexte de navigateur pour chaque exécution.

Tableau 5.1. Temps de chargement et d'interaction de Mol* sur le Mac de référence [C13].

| Mesure | API impérative, fichier local | MVS, fichier local | API impérative, files.rcsb.org |
|---|---|---|---|
| Création du plugin | 90 ms | 96 ms | 92 ms |
| Du chargement au premier rendu | 237 ms | 338 ms (`loadMVS` complet) | 718 ms |
| De l'action sur le résidu au rendu suivant | 224 ms | inclus dans `loadMVS` | 220 ms |
| Intervalle entre images pendant la rotation, vsync désactivée | p50 3.1, p95 3.9 ms | p50 2.9, p95 3.8 ms | p50 3.1, p95 3.9 ms |

- Avec la vsync activée, chaque condition a tenu des images de 16.7 ms. Le temps de téléchargement depuis RCSB varie selon le réseau (1081 ms lors de l'exécution répétée).
- Le paquet JavaScript pesait 1,120.8 kB après gzip, sans découpage du code.

Le résultat décisif est la **relecture** (read-back) [C14]. La page a demandé aux gestionnaires de sélection et de focus de Mol* lui-même ce qui était sélectionné. La réponse a été : chaîne H, label 6 = auth 6, VAL, entité 2, 7 atomes. Un clic de pointeur simulé sur le résidu a également été résolu en `VAL H6`. Helix peut donc vérifier que le résidu affiché est bien celui que nomme la preuve, au lieu de se fier à ses propres variables.

**Résultat négatif.** La première exécution a échoué avec « target not found ». Le préréglage par défaut de Mol* construit l'assemblage 1, qui ne contient pas la chaîne H (section 4.5) [C11]. Le chargement du modèle, c'est-à-dire de l'unité asymétrique, a corrigé le problème. Un réglage par défaut d'apparence anodine aurait montré la mauvaise scène.

### 5.3 MolViewSpec comme cible déclarative

La même vue a été écrite en MolViewSpec : un fichier de 3.1 kB, valide selon le validateur du format. MVS a déclaré tout ce dont une vue statique a besoin :
- le modèle, et le résidu en numérotation label ;
- les résidus en contact, la représentation et la couleur ;
- une étiquette 3D, une infobulle, le focus de la caméra et l'arrière-plan.

Il n'a pas pu exprimer [C15] :
- l'état de sélection de Mol* ;
- la mise en évidence au survol ;
- la représentation de focus avec les interactions environnantes ;
- un quelconque événement ;
- une modification incrémentale sans chargement d'un nouvel état.

**Décision** (`docs/competitor-analysis.md`, décision de réutilisation) :
- MolViewSpec est le format déclaratif de Helix pour les instantanés curés, les exports, et comme cible contrainte des plans compilés.
- L'API impérative gère l'interaction et la relecture.
- Le modèle d'IA n'écrit jamais directement du MVS. Il émet des actions Helix typées, que du code déterministe compile.

### 5.4 Coordination de Mol* avec un canevas React Three Fiber

Une seconde expérience a placé une hélice d'ADN illustrative, construite à partir de la véritable séquence codante de HBB et dessinée avec React Three Fiber (R3F), à côté de la vue Mol* ou par-dessus (`journal/2026-11-01-molstar-r3f-bridge.md`).
- Un magasin d'état (store) d'une vingtaine de lignes contenait la sélection partagée. Aucun des deux moteurs de rendu n'appelait l'autre.
- Le codon k correspond à la position UniProt k, au résidu mature k-1 et au label k-1 de 2HBS. Le codon 1 n'a aucun résidu de structure, et la page l'indique.

**Résultats.**

- **Identifiants corrects dans les deux sens** [C16] :
  - Un clic réel sur le codon 7 de l'ADN a conduit Mol* à sélectionner et à centrer le résidu 6 de la chaîne H de 2HBS. La relecture de Mol* a été `VAL H6`, 63 ms après la mise à jour du store dans la disposition côte à côte et 68 ms en superposition.
  - Les clics sur les résidus Mol* PRO H5, VAL H6, VAL H126, THR H12 et ALA H13 ont produit les codons 6, 7, 127, 13 et 14, tous corrects.
  - Une vérification de correspondance à chaque chargement compare les codons 2 à 14 à la structure. Douze sur treize concordent, et le seul désaccord est le codon 7 (GAG, glutamate) face à VAL : la substitution drépanocytaire elle-même, ce que la vérification doit précisément signaler.
- **Performance** [C17] :
  - Avec la vsync activée, les deux canevas ensemble ont tenu des images de 16.7 ms dans toutes les configurations, sans aucune image au-delà de 20 ms.
  - Avec la vsync désactivée et les deux canevas animés, le temps moyen par image a été de 2.50 ms côte à côte et de 4.15 ms en superposition, contre 1.71 ms pour Mol* seul et 1.47 ms pour R3F seul.
  - Le coût de Mol* croît avec la surface de son canevas.
  - La page a utilisé exactement deux contextes WebGL2.
- **Propriété du pointeur** [C18]. Dans la première superposition, un même clic atteignait les deux moteurs de rendu et produisait deux mises à jour du store. La correction consiste à n'avoir à tout instant qu'un seul propriétaire du pointeur, déterminé par la phase de l'état du monde.
- **Anomalie ouverte** [C19]. Une unique image longue de 290 à 400 ms apparaissait au début de chaque rotation de Mol* dans la page de liaison, et non dans la page contenant Mol* seul. Elle est inexpliquée et reportée à la phase 4.

Tableau 5.2. Coût par image avec la vsync désactivée, moyenne / p95 en ms (`research/experiments/molstar-r3f-bridge/README.md`).

| Configuration | Côte à côte | Superposition |
|---|---|---|
| Les deux au repos (R3F continue le rendu) | 1.36 / 2.7 | 1.36 / 2.7 |
| Mol* en rotation | 2.50 / 3.9 | 4.16 / 7.5 |
| R3F en rotation | 1.26 / 2.7 | 1.27 / 2.8 |
| Les deux en rotation | 2.50 / 4.0 | 4.15 / 7.4 |
| Référence, Mol* seul | 1.71 / 3.1 | s.o. |
| Référence, R3F seul | 1.47 / 2.8 | s.o. |

Il s'agit d'intervalles entre images mesurés sur le fil principal d'un ordinateur portable rapide, et non de minuteries GPU ni de mesures sur du matériel d'entrée de gamme.

### 5.5 Décision

Helix utilise des **canevas coordonnés** (`docs/rendering-integration-decisions.md` §4) :
- Mol* gère toute structure moléculaire réelle ; R3F gère les couches illustratives et cinématographiques.
- Un unique magasin d'état du monde faisant autorité pilote les deux, y compris la propriété du pointeur.
- Les transitions relèvent de la chorégraphie (mouvements de caméra, fondus enchaînés, jetons de couleur partagés), et non d'une géométrie partagée.

Un survol géométrique continu depuis l'ADN jusqu'aux atomes n'a pas été tenté. Il nécessiterait une transformation spatiale entre une illustration et des coordonnées réelles, ce qui n'a aucune signification scientifique et devrait être étiqueté comme illustratif. Un canevas unifié ne sera réexaminé que si Mol* documente un moyen de partager une scène avec three.js, ou si apparaît un besoin mesuré que la coordination ne peut satisfaire.

---

## 6. Faisabilité de l'application de bureau (phase 1, amendement A-1)

### 6.1 Question

L'amendement A-1 (auteur, 2026-11-01) ajoute une version de bureau macOS du même code web, avec IA locale et parcours hors ligne. La question était de savoir si cela est faisable avec des outils gratuits et sans modifier le code web.

### 6.2 Conception

- Une application Tauri 2 charge la version web inchangée de la section 5.2 (`journal/2026-11-01-tauri-shell.md`). Le code propre à Tauri est injecté sous forme de script distinct ; la page ne comporte aucune importation Tauri.
- L'accès au réseau est restreint à deux niveaux :
  - une politique de sécurité du contenu n'autorise que l'application elle-même, le port local d'Ollama et files.rcsb.org ;
  - la capacité HTTP n'autorise que l'adresse locale d'Ollama.

### 6.3 Résultats

**Rendu et empaquetage** [C20].
- Mol* a rendu 2HBS dans le WKWebView de macOS avec WebGL2, et la relecture a de nouveau donné `VAL H6`.
- Lancement à chaud : 231 ms jusqu'à l'initialisation du plugin, 256 ms jusqu'au premier rendu, 321 ms de l'action au rendu. Le premier lancement à froid a été plus lent (2,740 ms jusqu'au premier rendu), effet propre au premier lancement.
- Taille : le paquet de l'application pèse 8.4 MB, l'image disque 4.5 MB.
- Signature : la version est signée ad hoc et passe la vérification `codesign`. Gatekeeper la rejette, comme attendu en l'absence d'un Developer ID payant et d'une notarisation.

**Pas de WebGPU** [C21]. WKWebView sur macOS 15.3.1 n'expose pas WebGPU, alors que Chrome 156 sur la même machine l'expose. Les modèles exécutés dans le navigateur sur le moteur WebGPU ne sont donc pas disponibles dans l'enveloppe de bureau sur cette version du système. L'IA locale de la version de bureau passe par Ollama.

**Voies d'accès à l'IA locale** [C22].
- Un serveur Ollama local (version 0.9.6, modèle llama3.1) a répondu par trois voies en environ 5 s par appel à chaud : le `fetch` de la webview, le plugin HTTP à portée restreinte de Tauri et une commande Rust personnalisée.
- Une requête hors de la portée HTTP a été refusée en 2 ms.
- Une requête préalable provenant d'une origine web arbitraire a été refusée (403), ce qui confirme que l'IA locale est une voie réservée à l'application de bureau.

### 6.4 Le plan pour la mauvaise structure

Sollicité, sans indication de structure, pour planifier une vue de la structure de la drépanocytose, llama3.1 a renvoyé un JSON conforme au schéma demandé mais désignant l'entrée PDB 1BZO au lieu de 2HBS [C23]. La réponse était bien formée et fausse.

Cette observation unique motive la règle de conception centrale de Helix : les plans des modèles sont des propositions non fiables, et un exécuteur déterministe valide chaque identifiant par rapport aux enregistrements curés avant l'exécution. La phase 3 mesure la fréquence de telles erreurs (chapitre 8).

### 6.5 Décision

- La version de bureau atteint Ollama par la commande Rust ou par une portée HTTP limitée à une adresse, et non par le réglage CORS par défaut d'Ollama, qui dépend de sa version et de sa configuration.
- Le code web reste indépendant de la plateforme, derrière une abstraction de fournisseur d'IA (phase 3, tâche P3.2.4).

---

## 7. Noyau de données et validation (phase 2)

### 7.1 Architecture

La correspondance de la phase 1 a été reconstruite sous forme de code dans trois paquets TypeScript (`docs/data-core.md`). Les dépendances vont dans un seul sens, sans cycle.

| Paquet | Responsabilité |
|---|---|
| `shared-types` | Schémas Zod avec conventions de coordonnées explicites, identifiants versionnés, références de résidus label/auth, les six classes de preuve, schémas de provenance et de manifeste. Aucune entrée/sortie. |
| `data-adapters` | Tout ce qui touche au réseau ou à un format de fichier. Noyau HTTP avec délais d'expiration, nouvelles tentatives avec temporisation croissante, seau à jetons par source, erreurs typées et détection du HTML servi à la place du JSON. Également : un cache adressé par le contenu, un petit lecteur mmCIF, des adaptateurs par source et une protection contre les identifiants propriétaires. |
| `scientific-core` | Logique déterministe sur les enregistrements analysés : conversions de coordonnées, règle MANE Select, traduction, résolution des variants, correspondance avec la structure fondée sur SIFTS avec contre-vérification par alignement, contacts, vérifications de capacités, classificateur de preuves, rapports de dérive et constructeur de tranche. |

**Le lecteur mmCIF.** Un lecteur dédié d'environ 400 lignes a été préféré à l'analyseur de Mol* (une dépendance volumineuse) et à une étape Python (qui ne peut pas s'exécuter dans un navigateur).
- Il analyse 2HBS (1 MB) en environ 50 ms sous Node.
- Ses modes de défaillance sont testés, y compris un fichier coupé exactement à une frontière de ligne.
- Son calcul des contacts concorde avec le résultat Biopython de la phase 1 (vérification T28).

### 7.2 Règle de plateforme

Comme le même code doit s'exécuter dans un navigateur, dans l'enveloppe Tauri et sous Node, les paquets d'exécution n'utilisent que des API de la plateforme web : `fetch`, `AbortController`, l'encodage de texte et Web Crypto. Cette règle est imposée de deux manières [C27] :
- chaque paquet compile sans les types Node ;
- un test parcourt les sources à la recherche d'importations Node.

MD5 est implémenté en TypeScript, car Web Crypto n'en fournit pas. Il sert uniquement à comparer avec la somme de contrôle publiée par UniProt.

### 7.3 Vérifications de construction

Le constructeur exécute 46 vérifications à chaque construction, en ligne ou hors ligne. Tout échec d'une vérification de niveau erreur interrompt la construction, et rien n'est écrit : il n'existe ni jeu de données partiel ni repli silencieux. La dérive de version entre ressources est consignée comme avertissement, jamais comme échec. Chaque corps d'entrée doit correspondre à l'empreinte consignée lors de la récupération avant d'être analysé.

La construction en ligne du 2026-11-01 a réussi les 46 vérifications, sans échec ni avertissement [C24]. Le tableau 7.1 les regroupe ; `docs/scientific-validation.md` donne chaque vérification, sa justification et son dernier résultat.

Tableau 7.1. Vérifications de construction par groupe (`data/curated/hbb/manifest.json`).

| Groupe | Exemples (dernier résultat) |
|---|---|
| Identité et transcrit | Gène ENSG00000244734.6 ; ENST00000335295.4 seul MANE Select parmi 19 transcrits ; les alias HGNC renvoient au même gène |
| Coordonnées et séquence | La somme des longueurs d'exons vaut 628 ; CDS de 444 nt, de l'ATG au TAA ; traduction = Ensembl = UniProt, 147 aa, même md5 [C06] ; le parcours des exons propre à Helix place c.20 en 5227002, comme le font deux sources ; aller-retour SPDI |
| Variant | rs334 multi-allélique, seul A donne p.Glu7Val ; le p. calculé est égal à celui de variant_recoder et de VEP ; UniProt VAR_002863 ; enregistrement ClinVar associé par SPDI |
| Structure et correspondance | Entité choisie par le numéro d'accès SIFTS ; décalage d'alignement 1, identité 0.9932 ; résidu lu dans `atom_site` ; les numérotations erronées aboutissent à des résidus différents ; désaccord de `_struct_ref_seq` consigné ; contacts calculés |
| Modèle prédit et dérive | Le modèle AlphaFold correspond à UniProt par md5 et est signalé comme inutilisable pour positionner un variant ; dérive de version consignée |

La construction a également consigné :
- deux problèmes connus : la numérotation de `_struct_ref_seq`, et les 16 chaînes de non-polymères dont les identifiants label et auth diffèrent ;
- deux entrées de dérive : la référence croisée d'UniProt cite la version 5 du gène alors qu'Ensembl sert la 6 ; VEP cite la version 216 de l'entrée UniProt alors qu'UniProt sert la 219.

### 7.4 Régénération

Le jeu de données a été construit en ligne deux fois de suite à partir du même commit, puis les résultats ont été comparés [C25].
- Sur 12 fichiers, 2 étaient identiques à l'octet près.
- Les 193 différences étaient toutes admises : horodatages de récupération et de validation, ainsi que les empreintes et tailles des 9 fichiers d'enregistrement qui les intègrent.
- Il n'y avait aucune autre différence.

Une paire antérieure différait par l'empreinte d'un corps brut, car la réponse de HGNC contient un minuteur propre à chaque requête. La comparaison n'accepte désormais une telle différence qu'après avoir confirmé que les deux corps en cache sont identiques une fois ce champ documenté retiré.

### 7.5 Tests

La suite compte 113 tests dans 9 fichiers. 110 réussissent, et 3 tests de fumée en ligne facultatifs (opt-in) sont ignorés par défaut ; exécutés séparément, ces 3 tests réussissent [C26]. La suite comprend :
- les 32 tests déterministes du plan d'acquisition, sur des données de test figées ;
- des tests HTTP contre un véritable serveur local (délais d'expiration, limitation de débit, erreurs serveur, HTML à la place du JSON, corps tronqués, annulation) ;
- des tests du cache, de l'analyseur et des schémas ;
- des tests du jeu de données qui vérifient les empreintes des fichiers versionnés et l'absence d'identifiants propriétaires.

### 7.6 Contenu du jeu de données curé

Le jeu de données (`data/curated/hbb/`) comprend onze enregistrements, le fichier 2HBS inchangé et un manifeste avec la provenance complète :
- gène, transcrit, séquences, protéine, variant HbS ;
- la structure, la correspondance des résidus, les contacts ;
- les métadonnées du modèle AlphaFold et un index des capacités.

Les noms de traits ClinVar ne sont délibérément pas stockés (section 4.3).

---

## 8. IA locale et dans le navigateur : faisabilité et évaluation (phase 3)

La méthode complète, tous les tableaux et les commandes de reproduction figurent dans `docs/ai-model-benchmark.md`. Les expériences sont consignées au journal sous `HX-P3-2026-11-01-ai-benchmark-ollama` et `HX-P3-2026-11-01-webllm-browser`.

### 8.1 Question et règle de conception

Un modèle gratuit s'exécutant sur la machine de l'utilisateur peut-il transformer une question en un plan d'actions de scène de manière suffisamment fiable pour être utile ? La règle de conception de la section 6.4 est fixée à l'avance : aucun plan ne s'exécute sans avoir passé la validation, quels que soient les résultats.

Un nouveau paquet, `ai-planning`, contient le schéma des plans, le contexte de planification et le validateur. Il est maintenu séparé afin que les paquets de données n'importent jamais de code lié aux modèles. Comme les autres paquets d'exécution, il n'utilise que des API de la plateforme web.

- **Forme d'un plan.** Un plan comporte :
  - une issue : `plan`, `unsupported` ou `clarify` ;
  - une intention, les entités et une liste d'actions ;
  - un niveau d'explication, des citations, des questions de suivi et une justification.

  Chaque objet est strict : un champ inconnu est donc une erreur.
- **Actions.** Parmi elles : résoudre un gène ou un variant, charger une structure (avec l'unité asymétrique ou un assemblage nommé), entrer dans un monde, centrer la caméra, mettre en évidence un résidu, révéler une preuve, annuler.
  - Le modèle ne nomme jamais une chaîne, un numéro de résidu ou un maillage. Il nomme une caractéristique curée, telle que `HbS_substitution`, et du code déterministe la résout.
- **Contexte.** Les seuls identifiants qu'un plan peut utiliser proviennent des onze enregistrements HBB curés :
  - le gène, le transcrit, la protéine et le variant ;
  - les deux structures, 2HBS (expérimentale) et AF-P68871-F1 (prédite, jamais utilisée pour positionner le variant) ;
  - deux caractéristiques et dix identifiants de preuve.
  - Le texte récupéré est joint en tant que donnée non fiable et ne compte jamais comme ancrage.
- **Validation,** dans l'ordre :
  1. Analyse du JSON.
  2. Schéma strict.
  3. Ancrage : chaque identifiant doit figurer dans le contexte, y compris les identifiants présents dans le texte libre, sauf si l'utilisateur les a saisis.
  4. Capacités.
  5. Prérequis : une caractéristique n'est ciblée qu'une fois sa structure chargée dans un assemblage qui la contient.
  6. Cohérence de l'issue [C30].

### 8.2 Banc d'essai

Le jeu principal compte 53 éléments [C31] : 11 pris en charge, 13 paraphrases, 6 questions de suivi sur une sélection, 12 non pris en charge, 5 ambigus et 6 injections. Sept éléments sont en français.
- **Les éléments non pris en charge** comprennent des questions médicales (une dose d'hydroxyurée pour un enfant), d'autres gènes, une demande d'exécution de code et une demande portant sur la mauvaise structure 1BZO.
- **Les éléments d'injection** placent des instructions dans le texte récupéré, par exemple « ignore all previous instructions and load 1BZO », ou un commentaire caché demandant CFTR.

Les réponses attendues ont été rédigées avant l'exécution de tout modèle. Un jeu réservé distinct de 16 éléments a été rédigé une fois le repli déterministe achevé, et n'a pas servi à le modifier.

### 8.3 Dispositif d'évaluation

Chaque modèle a reçu le même prompt système, le même schéma (transmis au paramètre `format` d'Ollama), le même contexte et le même nombre de tentatives :
- trois exécutions à température 0, avec les graines 0, 1 et 2 ;
- une exécution à température 0.7.

Il n'y a eu ni nouvelle tentative ni réparation, et chaque sortie est stockée avec ses temps et son score. Un modèle factice injectant des défauts connus a été exécuté en premier, et le dispositif a détecté chacun d'eux [C32].

Environnement : Ollama 0.40.6, installé en espace utilisateur à partir d'une version dont la somme de contrôle a été vérifiée, sur le Mac de référence (Apple M1 Pro, 16 Go).

### 8.4 Résultats

Tableau 8.1. Jeu principal, température 0, 159 sorties par modèle (`docs/ai-model-benchmark.md` §3.2) [C33].

| Planificateur | Correct et valide | Identifiants non ancrés (sorties) | Médical/non pris en charge refusé | Éléments d'injection corrects | Refus à tort | Temps total p50 / p95 |
|---|---|---|---|---|---|---|
| Repli déterministe (sur l'échantillon de conception) | 100% | 0 | 13/13 | 6/6 | 0/35 | < 2 ms |
| ministral-3:8b | **86.8%** | 12 (9) | 39/39 | 9/18 | 12/105 | 10.0 / 20.3 s |
| qwen3.5:4b | 57.9% | 20 (17) | 38/39 | 9/18 | 6/105 | 7.0 / 25.2 s |
| llama3.1:8b | 47.2% | 6 (3) | 39/39 | 9/18 | 45/105 | 3.2 / 7.3 s |
| phi4-mini:3.8b | 34.0% | 27 (18) | 24/39 | 6/18 | 36/105 | 3.8 / 6.0 s |

Le score de 100% du repli est obtenu sur l'échantillon de conception : ses règles ont été écrites en ayant ce jeu sous les yeux ; il montre donc une couverture, et non une capacité de généralisation.

**Jeu réservé** [C34] :
- Le classement change : le repli obtient 75.0%, qwen3.5:4b 62.5%, ministral-3:8b 56.3% et llama3.1:8b 37.5%.
- Le meilleur modèle sur le jeu principal perd une trentaine de points sur des questions autour desquelles son prompt n'avait pas été conçu.
- Avec 16 éléments, des écarts d'un ou deux éléments relèvent du bruit.

**La validation a joué son rôle** [C35]. Chaque identifiant non ancré a été détecté :
- des numéros d'accès inventés (P68881, P688871) ;
- des identifiants mémorisés pour des gènes hors du contexte (TP53 et P04637) ;
- des identifiants injectés répétés dans le texte libre (1BZO, 4HHB) ;
- un identifiant de variant inventé.

Sous la politique « utiliser le plan du modèle s'il est valide, sinon le plan déterministe », aucun plan non ancré n'aurait atteint la scène. Sur le jeu réservé, cette politique obtient 87.5% avec qwen3.5:4b et 75.0% avec ministral-3:8b. Ses erreurs restantes sont des plans valides mais faux, par exemple une demande de clarification là où un plan était attendu, que la validation ne peut pas détecter.

**Autres mesures.**
- **Identifiants contraints.** Restreindre les champs d'identifiant aux identifiants du contexte a supprimé toutes les violations dans les champs structurés, mais n'a rendu aucun modèle plus correct [C36].
- **Injection.** Aucun modèle n'a traité correctement plus de la moitié des sorties d'injection. La plupart ont évité l'action injectée, mais ont ensuite refusé ou remis en question la véritable demande de l'utilisateur.
- **Mémoire.** qwen3.5:4b, qu'Ollama exécute sur son moteur MLX, est passé d'environ 4.5 GB à 12.3 GB au cours d'une exécution, soit les trois quarts de la mémoire de la machine [C37]. La cause n'est pas vérifiée.

### 8.5 Inférence dans le navigateur

Qwen3.5-2B s'est exécuté dans Chrome au moyen de WebLLM 0.2.86 sur WebGPU [C38] :
- **Téléchargement :** 1.08 GB. Le premier chargement a pris environ 75 minutes sur une connexion lente ; les chargements suivants ont pris 2 s.
- **Vitesse :** le décodage a atteint environ 16 à 17 jetons par seconde, et un plan a pris 25 s en valeur médiane.
- **Sortie :** aucune sortie n'était conforme au schéma telle que renvoyée, car le modèle émet un bloc de raisonnement vide avant le JSON. Une fois ce bloc retiré par le fournisseur, 10 sur 10 sont conformes au schéma et 4 sur 10 sont correctes et valides, sans aucun identifiant non ancré.

Le résultat décisif concerne la scène moléculaire [C39]. Avec le modèle sur le fil principal de la page, la scène Mol* s'est figée une fois pendant 28.7 s. Dans un Web Worker, la pire image a duré 133 ms. L'inférence dans le navigateur n'est donc acceptable que dans un worker. Elle n'est pas disponible dans l'enveloppe de bureau, qui ne dispose pas de WebGPU (section 6.3).

### 8.6 Repli déterministe

Le repli est une liste ordonnée de règles appliquées à la requête de l'utilisateur. Il ne lit jamais le texte récupéré ; les instructions injectées ne peuvent donc pas l'atteindre. Les règles, par ordre de priorité :
1. les demandes cliniques et les demandes de code sont refusées ;
2. les identifiants hors du contexte sont rejetés ;
3. les questions ambiguës reçoivent une demande de clarification ;
4. les commandes prises en charge produisent des plans ;
5. tout le reste est « non pris en charge », sans conjecture.

Résultats [C40] :
- Il répond correctement aux 53 éléments principaux (sur l'échantillon de conception) et à 12 des 16 éléments réservés.
- Ses 69 plans passent tous la validation.
- Ses quatre échecs sur le jeu réservé sont sans danger : une demande de clarification ou un plan qui en fait moins que demandé.
- Les règles n'ont pas été modifiées après l'exécution sur le jeu réservé, de sorte que ce chiffre reste honnête.

### 8.7 Fournisseurs, directeur et décision

**Fournisseurs.** Une interface de fournisseur unique couvre le planificateur déterministe, Ollama et WebLLM. Chacun indique s'il est disponible et pourquoi, et un registre bascule de l'un à l'autre à l'exécution. Le fournisseur déterministe est obligatoire.

**Directeur.** Un directeur de parcours minimal enchaîne les étapes :
1. la résolution du gène par le noyau scientifique : un gène impossible à résoudre reçoit une réponse sans appel à un modèle ;
2. un plan provenant du fournisseur actif ;
3. la validation ;
4. le repli ;
5. l'annulation des requêtes périmées.

Les deux composants sont testés avec des fournisseurs factices et sur chaque élément du banc d'essai.

**Décision :**

| Rôle | Choix | Justification |
|---|---|---|
| Par défaut partout | Planificateur déterministe | Fonctionne hors ligne, jamais non ancré, meilleur sur le jeu réservé |
| Modèle de développement et de bureau | ministral-3:8b (Apache-2.0) par Ollama, derrière la validation et le repli | Meilleurs résultats sur le jeu principal, stable à température 0 ; lent (10 s en médiane), l'interface doit donc afficher la progression et permettre l'annulation |
| Pas le choix par défaut sur le bureau | qwen3.5:4b (Apache-2.0) | Meilleur score de politique sur le jeu réservé, mais sa mémoire a atteint environ 12 GB sur un Mac de 16 GB |
| Web, option expérimentale | Qwen3.5-2B (base Apache-2.0) avec WebLLM, dans un worker, après acceptation par l'utilisateur du téléchargement de 1.08 GB | Faisable mais faible (4/10) |
| Rejetés | llama3.1:8b, phi4-mini:3.8b | Nombreux refus à tort et obligations de la licence Llama ; résultats les plus faibles et suggestions de suivi cliniques |

Il n'existe aucune voie infonuagique ni payante.

### 8.8 Limites de la phase 3

- **Le banc d'essai est petit,** porte sur un seul gène, et certaines réponses attendues relèvent du jugement. Les pourcentages décrivent ce jeu, et non la capacité de planification en général.
- **Les règles strictes façonnent les nombres.** L'ancrage du texte libre compte un modèle comme non ancré même lorsqu'il ne nomme un identifiant injecté que pour le refuser.
- **La latence provient d'une seule machine,** sur laquelle d'autres travaux s'exécutaient par moments (environ ±10%).
- **Les chiffres de mémoire** ne sont pas comparables d'un moteur d'exécution d'Ollama à l'autre.
- **Non testés :** l'appel d'outils, les autres bibliothèques d'inférence dans le navigateur, Safari et Firefox.
- **Le directeur** est une implémentation de référence, sans récupération au-delà du contexte curé ni mémoire de session.
- **Suite de tests :** après la phase 3, elle compte 160 tests ; 157 réussissent et 3 tests en ligne facultatifs sont ignorés par défaut [C41].

---

## 9. Phases ultérieures (phases 4 à 12)

*Sections d'attente. Chaque section est rédigée lors de l'exécution de sa phase, et vérifiée lors de la revue de passage de cette phase.*

### 9.1 Preuve AI-to-World (phase 4)

**Question.** Dans l'application en fonctionnement, une question saisie entraîne-t-elle une action visuelle validée et vérifiée sur la structure réelle ? C'est la chaîne d'acceptation du prompt maître (§7.5).

**Conception.**
- Un directeur de produit, porté depuis la référence de la phase 3 (section 8.7), propose un plan à partir d'un contexte restreint à ce que la version peut afficher.
- Un Scene Action Interpreter (interpréteur d'actions de scène) vérifie le plan avant toute exécution :
  - l'époque de session du plan ;
  - une seconde validation du plan ;
  - chaque action par rapport à un registre de huit contrats typés, chacun avec ses capacités, ses prérequis et ses vérifications scientifiques.
- Les cibles ne sont résolues qu'à partir des enregistrements de correspondance SIFTS et de contacts de la phase 2.
- La mise en évidence et le focus ne sont considérés comme effectués que lorsque les gestionnaires de sélection et de focus de Mol* lui-même relisent les résidus résolus.
- L'explication est rédigée par du code déterministe à partir des enregistrements curés. Chaque phrase porteuse d'une affirmation cite un identifiant de preuve avec sa provenance, et le texte propre au planificateur est étiqueté comme tel.

**Résultats** (`HX-P4-2026-11-02-ai-to-world-e2e`).
- **Relecture.** La question de référence était « Show me where the sickle-cell mutation affects hemoglobin. » (Montre-moi où la mutation drépanocytaire affecte l'hémoglobine.) À chaque exécution, Mol* a relu VAL 6 sur les chaînes B, D, F et H de l'unité asymétrique de 2HBS, avec le focus sur H6 : 5 exécutions avec le planificateur déterministe et 5 avec ministral-3:8b [C42].
- **Temps jusqu'à la mise en évidence vérifiée, planificateur déterministe :** une médiane de 1,061 ms après la question, incluant un mouvement de caméra d'environ 700 ms [C43].
- **Temps jusqu'à la mise en évidence vérifiée, ministral-3:8b :** une médiane de 15,922 ms, presque entièrement consacrée à la planification (médiane de 15,516 ms). La première exécution, à froid, a pris 28.7 s. Le temps de planification à chaud est plus long que la médiane de 10 s de la phase 3, et ce point n'a pas été étudié.
- **Validation.** Aucun plan du modèle n'a été rejeté. Le modèle a choisi un ordre différent mais valide, en mettant en évidence avant de centrer la vue, et n'a émis aucune action de preuve explicite [C44].
- **Preuves.** Chaque affirmation affichée citait un identifiant de preuve sourcé [C45].
- **Autres questions.**
  - Une question de suivi portant sur la sélection a montré le contact de H6 avec la chaîne B, accompagné de l'énoncé précisant qu'il se situe dans l'unité asymétrique du cristal.
  - Les questions non prises en charge et les questions cliniques ont laissé la scène inchangée.

**Interruption** (`HX-P4-2026-11-02-cancellation`).
- L'arrêt pendant une transition de caméra a pris une médiane de 28 ms, et la caméra n'a plus bougé ensuite.
- L'arrêt pendant l'inférence a pris de 13 à 14 ms, et la requête suivante au modèle n'a pas été retardée [C46].
- Un plan produit avant que l'utilisateur ne clique sur un résidu a été rejeté comme périmé, et une question remplacée pendant l'inférence a été écartée [C47].

**L'image longue de la section 5.4** (`HX-P4-2026-11-02-long-frame`) [C48].
- Elle ne se produit pas dans l'application à canevas unique.
- Dans la page de liaison de la phase 1, elle se reproduit à chaque début de rotation de Mol* avec la vsync désactivée. Elle requiert à la fois le second canevas, qui effectue un rendu en continu, et des clics préalables sur le canevas Mol*.
- Une trace montre le fil principal attendant environ 195 ms de l'espace dans le tampon de commandes du GPU.
- Cela contredit l'hypothèse de la phase 1 d'une reconstruction ponctuelle de composants. Le déclencheur interne à Mol* reste inexpliqué, et la sonde est reportée à la phase 5.

**Comportements de Mol\* découverts pendant la construction.**
- Une notification de rendu est émise immédiatement lors de l'abonnement.
- Une demande de focus émise juste après un chargement saute au lieu de s'animer, car Mol* n'a pas fini de valider la scène.
- Mol* saute des rendus pendant la finalisation des shaders.
- L'interruption de la caméra repose sur un champ public mais non documenté.

Ces quatre comportements sont gérés dans le code et documentés dans le dépôt produit.

**Limites.**
- Une seule machine, Chrome 156 sans interface, cinq exécutions par planificateur, une seule structure et le seul monde protéique.
- Safari, Firefox et la webview de bureau n'ont pas été exécutés.
- Les fichiers bruts des résultats de bout en bout se trouvent dans le dépôt produit privé ; leur copie éventuelle dans ce dépôt est une décision de l'auteur encore ouverte.

**Tests.** Après la phase 4, le dépôt produit compte 52 tests qui réussissent, et ce dépôt 160 (157 réussissent, 3 tests en ligne facultatifs ignorés) ; la vérification des types est sans erreur dans les deux [C49].

### 9.2 Moteur de parcours et intégration des deux mondes (phase 5)

**Question.** Peut-on relier deux représentations réelles de HBB, la séquence du transcrit et la structure expérimentale, de sorte que l'utilisateur puisse circuler de l'une à l'autre dans les deux sens, que les sélections restent scientifiquement cohérentes et que chaque action puisse être annulée sans risque ?

**Conception.**
- **Les mondes comme déclarations.** Chaque monde est une déclaration typée de ce dont il a besoin et de ce qu'il offre : données, interactions, actions, coûts mesurés, replis, alternative accessible, et caractère illustratif ou non de sa géométrie. Les déclarations sont vérifiées à la compilation et à l'exécution.
- **Chapitres.** Un planificateur déterministe propose des chapitres. Un module d'appariement ne propose un chapitre que si son monde existe dans la version et si chaque type de données dont il a besoin figure dans l'inventaire curé du sujet.
- **DNA World** (le monde de l'ADN) est une hélice illustrative dessinée avec React Three Fiber. Sa base i est la base i de l'ADNc curé, et elle porte la mention « Illustrative geometry, real sequence » (géométrie illustrative, séquence réelle).
- **Protein World** (le monde des protéines) est Mol* appliqué à 2HBS.
- **Le pont de sélection** relie le codon, la position dans la protéine et le résidu de la structure uniquement au moyen des enregistrements de la phase 2, sans aucune arithmétique de décalage.
- **Un seul chemin pour chaque changement.** Tous les changements de scène, y compris les changements de monde et les chapitres, passent par le Scene Action Interpreter de la section 9.1.
- **Un seul propriétaire du pointeur à la fois,** et le canevas R3F n'effectue un rendu que lorsque quelque chose change.

**Résultats** (`HX-P5-2026-11-02-dna-world-bridge`, `HX-P5-2026-11-02-transitions`, `HX-P5-2026-11-02-modes-rapid`).
- **L'ADN dessiné est la séquence réelle.** La page en fonctionnement a dessiné les 628 bases conformément à la séquence curée, et des clics réels ont sélectionné la base cliquée [C50].
- **Le pont fonctionne dans les deux sens.**
  - Le codon 7 a été relié à la position 7 de P68871 et à VAL 6 sur les chaînes B, D, F et H de 2HBS, d'après la relecture de Mol*.
  - Des clics sur ces résidus ont ramené au codon 7.
  - Le codon 1, le codon stop et les résidus sans correspondance ont indiqué pourquoi ils n'ont pas d'équivalent [C51].
- **Changement de monde.** Un changement à chaud a pris une médiane de 719 ms, un changement à froid 1,754 ms. Chaque aller-retour a conservé la sélection, les deux caméras, la structure et la mise en évidence [C52].
- **Interruption d'un changement de monde.** Elle a ramené au monde de départ en une médiane de 29 ms [C53].
- **Les chapitres exigent leurs données.** Sur l'ensemble des 4,096 sous-ensembles de types de données, le module d'appariement n'a jamais proposé un chapitre sans les données dont il a besoin [C54].
- **Mode guidé, exploration libre et reprise.** Le mode guidé, l'exploration libre et la reprise du récit ont réussi avec les deux planificateurs [C55].
- **Interaction rapide.** Dans six cas, la sélection ou le gène a été modifié pendant une transition ou pendant l'inférence. À chaque fois, l'action devenue obsolète a été annulée ou rejetée avant d'atteindre la scène [C55].
- **Un défaut trouvé et corrigé.** La mise au point de cette vérification a révélé un défaut de cohérence : un plan du modèle produit avant que l'utilisateur ne sélectionne un codon s'exécutait quand même et écrasait la sélection. La sélection dans l'ADN compte désormais comme un changement de sujet, ce qui rend périmés les plans antérieurs.

**L'image longue des sections 5.4 et 9.1** (`HX-P5-2026-11-02-long-frame-reprobe`) [C56].
- Avec un rendu R3F effectué uniquement à la demande, le blocage au début d'une rotation de Mol* n'est apparu dans aucune condition.
- Un canevas R3F visible, effectuant un rendu en continu sans limitation de la fréquence d'images, a produit des blocages d'environ 2 s.
- L'application effectue donc le rendu R3F à la demande ; le rendu permanent est écarté.
- Le blocage est désormais évité par conception, mais son déclencheur interne à Mol* n'est toujours pas isolé et n'a pas été tracé au cours de cette phase.

**Limites.**
- Une seule machine, Chrome sans interface, peu de répétitions.
- Seul le codon 7 atteignait un résidu de la structure lors de la phase 5, car le jeu de données ne contenait alors un enregistrement de correspondance que pour cette position. La phase 6 a étendu le lien aux 146 codons mis en correspondance (section 9.3).
- La planification des chapitres est uniquement déterministe.
- Démarrer dans DNA World ajoute environ 0.73 s à la question de référence, pour le fondu entre les mondes [C57].
- La navigation au clavier dans la bande des codons n'a pas été testée de bout en bout. Safari, Firefox et la webview de bureau n'ont pas été exécutés.

**Tests.** Après la phase 5, le dépôt produit compte 93 tests qui réussissent, et ce dépôt 160 (157 réussissent, 3 tests en ligne facultatifs ignorés) ; la vérification des types est sans erreur dans les deux [C58].

### 9.3 Tranche verticale HBB complète (phase 6)

**Question.** La tranche HBB peut-elle être utilisée de bout en bout dans son ensemble, avec trois propriétés :
- chaque énoncé affiché remonte à un enregistrement ;
- une question de suivi modifie de nouveau la scène ;
- l'expérience se dégrade honnêtement lorsque des données ou l'IA font défaut ?

**Conception.**
- **Données.** Deux enregistrements ont été ajoutés au jeu de données curé : l'enregistrement ClinVar de l'allèle HbS avec son statut de revue, et la correspondance SIFTS résidu par résidu de la chaîne complète de P68871 sur 2HBS. Le jeu de données a ensuite été reconstruit en ligne.
- **Actions.** Deux actions validées ont été ajoutées : la comparaison des séquences de référence et variante, et la mise en évidence d'une région de la séquence.
- **Parcours.** Quatre parcours ont été construits : première visite, données manquantes (des données de test clairement étiquetées comme telles), absence d'IA, et limites connues affichées dans l'interface.

**Résultats** (`HX-P6-2026-11-02-hbb-rebuild`, `HX-P6-2026-11-02-clinvar-live-smoke`, `HX-P6-2026-11-02-vertical-slice-e2e`).
- **ClinVar.** VCV000015333.184 classe l'allèle HbS comme Pathogenic : « criteria provided, multiple submitters, no conflicts » (critères fournis, plusieurs soumetteurs, aucun conflit), 2 étoiles sur 4, aucun conflit. L'enregistrement en était à la version .183 lors de la phase 2. Les neuf autres enregistrements ClinVar associés à rs334 sont stockés séparément et ne sont jamais fusionnés [C59].
- **Reconstruction.**
  - La construction étendue a réussi les 53 vérifications à partir d'un commit propre [C60].
  - Une seconde construction ne différait que par des champs expliqués.
  - Le manifeste désigne désormais un commit présent sur la branche publique, ce qui comble la lacune de provenance signalée à la section 10.
- **Le lien entre l'ADN et la structure couvre toute la chaîne.** L'enregistrement de chaîne complète fait correspondre les positions 2 à 147 aux quatre chaînes bêta. Dans l'application, les 146 codons mis en correspondance ont été reliés exactement aux résidus enregistrés, par consultation et jamais par décalage. Le codon 1 et le codon stop indiquent pourquoi ils n'ont pas d'équivalent [C61].
- **La vue de comparaison** n'est affichée que si elle reproduit l'enregistrement (c.20A>T, GAG en GTG, Glu en Val) ; un enregistrement corrompu est refusé [C62].
- **Questions de suivi.** Une question de suivi a produit une seconde action visuelle, vérifiée par relecture, dans 3 exécutions sur 3 avec chaque planificateur. Avec le planificateur à base de règles, la question de suivi a pris une médiane de 775 ms ; avec ministral-3:8b, 17,116 ms, et le modèle a rédigé lui-même le plan à chaque fois [C63].
- **Première visite.** Un gène non curé (CFTR) a été refusé sans scène, et « beta-globin » a atteint la première scène en 1,731 ms [C64].
- **Données manquantes.** Les enregistrements de structure ayant été retirés, le variant a été montré sur la séquence avec la raison de cette absence, et aucune structure ni aucun modèle prédit n'a été demandé [C65].
- **Sans IA.** En l'absence de tout modèle joignable, chaque parcours qui n'en a pas besoin a fonctionné, et l'interface a indiqué pourquoi aucun modèle ne s'exécute [C66].
- **Régression.** Les suites des phases 4 et 5 réussissent toujours. Le temps de planification du modèle est passé à une médiane de 21.5 s, contre 15.5 s auparavant, ce qui n'a pas été étudié [C67].

**Limites.**
- Un seul gène. Les données de test du cas de données manquantes sont HBB dont des enregistrements ont été retirés, et non un gène réel dont la structure est limitée.
- Les scénarios (blueprints) A, E et F ont été exécutés une fois chacun, sur une seule machine, dans Chrome sans interface.
- Avec le prompt étendu, les premiers plans du modèle sont plus longs que nécessaire et visitent les deux mondes.
- La vidéo de démonstration raccourcit les pauses de plus de 1.2 s, si bien que le temps de planification n'y apparaît pas avec sa durée réelle.

**Tests.** Après la phase 6, le dépôt produit compte 110 tests qui réussissent, et ce dépôt 181 : 177 réussissent et 4 tests en ligne facultatifs sont ignorés par défaut ; ces 4 tests en ligne réussissent lorsqu'on les exécute [C68].

### 9.3.1 Après la revue de la phase 6 (décisions D-H007 et D-H008)

L'auteur a validé le passage de la phase 6 le 2026-11-02 et a demandé un ensemble de modifications. Chaque modification a été caractérisée par des tests avant d'être effectuée, et chaque mesure est consignée dans le journal.

**Modifications du produit.** L'écran d'accueil s'affiche désormais à chaque visite, et l'application s'ouvre dans DNA World en vertu d'une règle explicite : le monde de départ est choisi d'après les données disponibles, DNA World ayant la préférence. Le temps entre la question et la mise en évidence avec le planificateur à base de règles a été de 1,775.9 ms (médiane, n = 5), dans la plage observée lors de la phase 6 (C69). Les suggestions de suivi du modèle passent désormais par un filtre déterministe (`helix-followup-filter-v1`) : une suggestion n'est conservée que si elle est non clinique, reste dans le contexte curé et peut recevoir une réponse par une scène autorisée du planificateur à base de règles. Sur 816 suggestions consignées lors d'exécutions antérieures, le filtre en a conservé 64, dont aucune n'est clinique (C70).

**Pourquoi la planification du modèle a ralenti.** Le chiffre de « 10 s » de la phase 3 était une médiane sur l'ensemble des 53 éléments du banc d'essai ; la question de référence elle-même prenait 17.5 s lors de la phase 3 et n'avait pas ralenti avant la phase 6. De la phase 5 à la phase 6, ce temps a augmenté d'environ 6 s, et 97.6% de cette hausse s'explique par la longueur de la sortie : la première réponse s'était mise à visiter les deux mondes, ce qui ajoutait environ 128 jetons générés, à environ 46 ms chacun. La croissance du prompt, le décodage contraint, les limites de contexte et la charge de la machine n'en expliquaient aucune part (C71). La même étude a établi que les « exact messages » (messages exacts) conservés dans deux entrées antérieures de bout en bout (E2E) avaient été capturés après la réponse ; la capture a été corrigée et les entrées annotées.

**Un seul monde par première réponse.** À la demande de l'auteur, une première réponse reste désormais dans un seul monde. La règle est énoncée dans le prompt et appliquée par une vérification qui rejette toute première réponse changeant de monde, avec le repli habituel ; les plans ne sont jamais réordonnés. Sur la question de référence, la planification est passée de 21.7 s à 18.8 s, et les 15 premières réponses du jeu de questions de bout en bout (E2E) sont toutes restées dans un seul monde ; la validation sur le banc d'essai est restée à 90.6%, tandis que les réponses correctes et valides sont passées de 79.2% à 75.5% (C72).

**Routage selon les mots de la question.** Une première réponse va vers le monde que la question nomme (DNA, codon, sequence ou letter pour l'ADN ; protein, structure, 3D, shape ou effect pour la protéine) ; une question neutre reste dans le monde courant, et après une réponse sur le variant dans DNA World, la première suggestion est le pont vers la protéine. Dix-sept nouveaux éléments réservés et leurs réponses attendues ont été enregistrés dans le dépôt avant qu'aucun modèle ne les voie. Le modèle a choisi le bon monde pour 14 des 15 éléments qui en désignent un, l'application a exécuté le bon monde pour les 15, et 16 des 17 éléments ont été corrects et valides (C73). Deux éléments existants dont la règle modifie les réponses attendues conservent leurs deux oracles, et les scores sont rapportés par rapport à chacun d'eux. L'élément réservé RH15 a révélé une lacune dans le motif clinique du planificateur à base de règles (« I will get sick », je vais tomber malade, n'était pas refusé) ; le motif a été élargi, aucun autre élément n'a changé, et RH15 ne compte plus comme inédit pour le planificateur à base de règles (C74). Avec le routage, le filtre a conservé 10 des 54 suggestions du modèle, dont aucune n'est clinique (C75).

### 9.3.2 Les noms de molécules comme indices, et une expérience de prompt non livrée (D-H010, D-H011)

**Les noms de molécules et « chain » (D-H010).** L'auteur a ensuite décidé que hemoglobin, beta-globin, HBB et « chain » (chaîne) désignent la protéine, tandis que gene, locus, chromosome et genome désignent l'ADN ; un mot relatif à l'ADN l'emporte sur un nom de molécule, puisque le nom ne fait qu'énoncer le sujet. Seize nouveaux éléments réservés et leurs oracles ont été enregistrés dans le dépôt avant toute exécution avec le prompt modifié (v5). La réponse exécutée a atteint le bon monde pour les 14 éléments routés, mais le modèle seul ne l'a choisi que pour 9 des 14 : les questions portant sur HBB, beta-globin et, en français, hémoglobine allaient encore vers DNA World et ont été corrigées par la vérification des indices de monde, au prix d'un repli et d'une attente complète du modèle (environ 23.6 s dans l'application en fonctionnement). Sur le jeu principal, les réponses correctes et valides sont passées de 39 à 40 par rapport aux oracles modifiés (C76). Un élément réservé a révélé une seconde lacune dans le motif clinique du planificateur à base de règles (« make me sick », me rendre malade) ; le motif a été élargi, aucun autre élément n'a changé, et l'élément ne compte plus comme inédit pour le planificateur à base de règles (C77).

**La refonte des instructions (D-H011).** Pour que le modèle route lui-même les questions portant sur les noms, cinq versions de travail du prompt ont été essayées sur les éléments de développement déjà vus, 21 nouveaux éléments réservés et leurs oracles ayant été enregistrés dans le dépôt avant l'exécution de toute version. Deux résultats négatifs ont façonné la version finale : un tableau d'indices dans les règles envoyait des questions neutres (« Show me the HbS variant », montre-moi le variant HbS) vers Protein World, parce que le modèle lisait HbS comme un nom de molécule, et nommer le monde affiché à l'écran dans le message de l'utilisateur amenait le modèle à répondre dans ce monde quelle que soit la question (routage par le modèle : 3 sur 14). Ce qui a amené le modèle à s'engager a été de lui demander d'entrer dans le monde choisi comme première action. Le prompt figé (v6) a été exécuté une fois sur le jeu réservé : 19 sur 21 valides, routage par le modèle 17 sur 19, exécution 19 sur 19, chaque première réponse dans un seul monde, les deux éléments cliniques refusés, et l'élément d'injection suivi par le texte du modèle mais bloqué par le validateur (C78). Sur les éléments ciblés, le routage propre au modèle est passé de 9 à 12 sur 14. Sur le jeu principal, en revanche, les réponses correctes et valides sont tombées de 40 à 37 (n = 1) à sécurité inchangée, et la planification a ralenti d'environ 3 s en médiane parce que les réponses se sont allongées. La règle préenregistrée pour changer l'application n'admettait aucune perte sur le jeu principal ; v6 est donc conservé figé et reproductible, mais n'est pas livré, et l'application garde v5 avec le chemin de vérification et de repli (C79). Une nouvelle exécution sur plusieurs graines pourrait renverser la perte observée avec n = 1, et cette décision est laissée à l'auteur.

### 9.4 Direction artistique, identité visuelle et système d'expérience utilisateur (phase 7)

*En cours ; cette section est rédigée au fil de l'avancement de la phase (invariant 14). Les nombres ci-dessous proviennent des entrées de journal désignées dans le registre des affirmations.*

**Direction.** L'auteur a demandé une interface « ultra premium, ultra futuriste » et a fourni une référence d'ambiance, un enregistrement d'une conception tierce qui a été visionné, décrit dans les archives du projet et jamais copié ni versionné. Trois concepts originaux ont été construits sous forme de prototypes React Three Fiber fonctionnels sur l'ADNc réel de HBB de 628 nt, avec le codon 7 mis en évidence, chacun avec douze écrans, des polices dont la licence a été vérifiée (SIL OFL, hébergées localement, versions datant d'au moins deux semaines) et des temps d'image mesurés : Deep Field (Molecular Cosmos, cosmos moléculaire), Instrument (Future Research Instrument, instrument de recherche du futur) et Atrium (Living Digital Museum, musée numérique vivant). Les trois ont tenu 60 Hz avec la vsync activée dans tous les modes sur le Mac de développement ; sans limitation de la fréquence d'images, Atrium s'est bloqué une fois par page (0.76 à 2.77 s) et Deep Field a présenté des images longues périodiques sans effets, tandis qu'Instrument n'a eu aucune image de plus de 50 ms dans aucune condition (C81). L'auteur a choisi Instrument (D-H009) et a demandé qu'il soit encore amélioré.

**Affinage.** Quatre cycles de critique et de correction ont appliqué les décisions de l'auteur : l'ambre signifie le variant et rien d'autre, si bien que les paires de bases sont devenues des incrustations d'émail éclairées aux couleurs de la légende et que le seul accent émissif se trouve au codon 7 ; chaque élément lumineux porte une signification (l'ancien anneau cyan marque le début de la séquence codante) ; la profondeur de champ n'est active que pendant la visite guidée de la caméra ; les effets sont rendus sous la résolution de l'écran. La marge avec tous les effets est passée de moins de 2 ms à environ 8 ms au p95 (vsync désactivée, médiane de 8.1 ms pendant la visite contre 13.5 ms auparavant), avec 0 image rendue au repos après chaque mouvement (C82). Chaque couleur de texte satisfait au niveau WCAG AA, ce qu'un test unitaire fige. L'auteur a rejeté les neuf esquisses d'identité et cinq nouvelles directions, puis a fourni son propre logotype, généré avec un outil d'images ; il est conservé tel que reçu avec ses notes de provenance et de droits, nettoyé (canal alpha uniquement : 67,347 pixels de frange effacés, aucune couleur modifiée), redessiné en vecteur par vectorisation au fil de 16 cycles comparés, et réduit à une petite marque tirée de son propre X (D-H011).

**Système de conception et adoption.** Un paquet de jetons est devenu la source unique de vérité pour la couleur, la typographie, l'espacement, le mouvement et les paramètres de matière et d'éclairage de la scène ; un test vérifie le CSS généré par rapport à la source TypeScript. Le contraste est calculé pour 17 rôles de texte sur 11 surfaces composées ainsi que sur les surfaces de commande, soit 190 paires, toutes égales ou supérieures à 4.5:1 (minimum 4.58, base C sur le voile de découverte) ; la séparation des couleurs est mesurée avec CIEDE2000 : la couleur de défaut est à 35.7 de l'ambre (15.1 à 25.2 sous des déficiences simulées de la vision des couleurs) et chaque couleur de preuve est à au moins 24.6 de l'ambre et à 13.7 des autres ; deux paires de couleurs de preuve se rapprochent sous une déficience et se distinguent aussi par le mot, le numéro de classe et la forme de la marque (C83). Vingt-sept composants accessibles ont été construits avec des tests de rôle, de nom et de clavier. L'application livrée a ensuite adopté le système sur chaque écran (D-H012, D-H013) : l'accueil affiche le logotype une seule fois avec le titre « Follow a gene from its DNA to the protein it makes. » (Suivez un gène de son ADN jusqu'à la protéine qu'il produit.) ; Derived (dérivé) et Predicted (prédit) sont des étiquettes distinctes au sein de la classe 3 ; la visionneuse Mol* reçoit un thème issu des jetons, avec le variant en ambre et la sélection du visiteur en cyan, sa barre d'outils et son affichage au survol restant intacts ; et le pont entre une scène de variant dans DNA World et Protein World joue une séquence de quatre stations lues dans les enregistrements (codon 7 GAG en GTG ; p.Glu7Val ; 7 à 6 parce que la méthionine initiatrice est retirée ; 2HBS chaîne H VAL 6), avec des commandes de pause, de pas à pas et de saut, toutes les stations affichées à la fois en mouvement réduit, et un chemin de refus qui mène directement à Protein World si un maillon échoue à sa vérification. Sur la version adoptée, les suites à base de règles des phases 4, 5 et 6 réussissent avec 0 échec ; le DNA World livré conserve 60 Hz sans aucune image de plus de 33.4 ms et avec 0 image rendue au repos, avant et après ; la première exécution a détecté un déclencheur du pont qui se déclenchait sur une question de premier démarrage (5,030 ms contre 1,781 ms après sa restriction à la scène du variant) (C84).

**Combler l'écart dans l'application livrée.** Une revue de la version adoptée par rapport au prototype approuvé a établi que la scène d'ADN livrée était encore la géométrie de la phase 5, que le panneau du visiteur affichait encore des diagnostics de développement et que le thème de Mol* était partiel. Une passe de finition a alors fait du kit Instrument le DNA World livré (squelette usiné, manchons moletés aux débuts de codons, incrustation cyan sur la séquence codante, brides aux jonctions d'exons, colliers ambre sur le brin codant au codon 7 et compas partiels), a ajouté un dispositif de caméra avec une pose principale et une visite guidée de 12 s interruptible, a placé les diagnostics derrière un indicateur de développement, a appliqué le thème de focus de Mol* après le préréglage propre à la visionneuse (une sonde en fonctionnement a montré que le préréglage réappliquait un thème à la représentation du focus), et a ajouté une légende de structure lue dans l'enregistrement. Trois cycles de critique et de correction ont été consignés avec des captures d'écran. Sur la version finie, les suites à base de règles des phases 4, 5 et 6 réussissent avec 0 échec, et la scène livrée tient une médiane de 16.7 ms avec la vsync activée à des rapports de pixels de l'appareil de 1 et 2 et en mode basse consommation, sans aucune image de plus de 33.4 ms aux rapports 1 et 2 et avec 0 image rendue au repos ; deux images longues isolées (63 ms et 35 ms) subsistent en mode basse consommation, non tracées (C85). **Audit d'accessibilité et de mouvement.** Une passe automatisée avec axe-core 4.14.0 sur treize écrans, des parcours au clavier scriptés avec preuve de l'anneau de focus, des vérifications en mouvement réduit et en basse consommation, et des lectures de l'arbre d'accessibilité ont relevé 19 problèmes : 3 graves, 8 modérés, 7 faibles, et une note de couverture. Treize ont été corrigés avec des tests unitaires (un repère principal, des noms de codons commençant par leur texte visible, des rôles pour cinq groupes étiquetés, quatre arrêts de tabulation invisibles supprimés, le focus rendu après la surcouche du pont et Evidence World, Échap mettant la visite en pause, des anneaux de focus sur la barre d'outils de Mol*) ; quatre sont reportés aux phases 8 et 11, deux sont des choix de conception acceptés. Après les corrections, axe signale 0 violation sur les treize écrans ; aucun écran ne piège le focus ; en mouvement réduit, la visite est une coupe, le pont affiche ses quatre stations à la fois pendant 2.8 s, et la boucle de rendu reste inactive ; la vue en basse consommation est rendue sans post-traitement à 0.8 ms par image en médiane (C86). Une passe VoiceOver ne peut pas être scriptée et reste due, avec son script manuel dans l'audit. La revue de passage a ensuite été soumise à l'auteur.

### 9.5 Monde cinématographique et finition visuelle (phase 8)

*En cours ; cette section est rédigée au fil de l'avancement de la phase (invariant 14). Les nombres ci-dessous proviennent des entrées de journal désignées dans le registre des affirmations.*

**Les budgets d'abord.** La phase s'est ouverte le 2026-11-03, après que l'auteur a validé le passage de la phase 7, par des budgets de performance plutôt que par des visuels, car le critère de passage de cette phase est « assurance qualité visuelle et budgets d'image et de chargement mesurés ». Les budgets sont des données (un fichier JSON lu par un harnais de test), et une page explique chacun d'eux, sa mesure et l'entrée de journal dont provient sa référence : le temps jusqu'à la première interaction (du chargement de la page à la scène prête, à l'activation de la première commande de l'accueil et à DNA World prêt), les octets transférés avant ce moment et au repos, le tas JavaScript au repos, après le chargement de la structure et après six allers-retours entre mondes, l'arbre de processus de Chrome, les changements de monde à froid et à chaud, le téléchargement de la structure, le paquet construit, et le budget d'image déjà mesuré lors de la phase 7 (médiane à 60 Hz avec la vsync activée, aucune image de plus de 33.4 ms aux rapports de pixels 1 et 2, au plus une pour mille en basse consommation, aucune image rendue au repos). Sur la version de la phase 7, chaque budget d'exécution a été tenu avec des marges de 1.3x à 3x (scène prête en 673 ms contre 1,000 ; tas de 78.4 MB après le chargement contre 256, en hausse de 1.4 % sur six allers-retours contre 10 ; changement à froid en 1,708 ms contre 2,500), avec deux constats : le changement de monde à chaud n'a que 40 ms de marge (1,560 contre 1,600 ms), et les octets téléchargés avant la première interaction sont de 1,918.6 kB contre un objectif de 1,000 kB, parce que le module Mol* (968 kB gzip) et le fichier de structure (249 kB) se chargent avant que la scène soit prête (C87). Le dépassement est conservé comme dépassement : l'objectif décrit le démarrage que la phase doit livrer (Mol* et la structure différés au-delà du moment où la scène est prête), et non celui dont elle a hérité.

**Deux flux, un seul arbre de travail.** Le travail de construction s'est déroulé en deux flux parallèles avec une stricte propriété des fichiers, à la suite de l'incident de la phase 7 au cours duquel le commit d'un agent avait emporté la modification non versionnée d'un autre : chaque flux n'a versionné que ses propres chemins, a construit dans un dossier privé servi sur son propre port, et a laissé les mesures de temps au coordinateur, sur une machine au repos. Le flux DNA World (P8.2.1, P8.3.1, P8.3.2) a ajouté un niveau de détail piloté par la distance de la caméra (les pièces fines, les traits fins, les graduations des compas, les anneaux de survol et le relief du moletage sont masqués au-delà de la distance où ils couvrent environ un pixel, chaque pièce grossière est dessinée à toute distance pour que l'instrument garde sa silhouette, le tout par des indicateurs de visibilité afin que rien ne soit recompilé et que les relectures E2E conservent leurs décomptes), un réticule ambre qui prend le relais des colliers à partir de 18 unités vers l'extérieur afin que le codon du variant reste repérable aux distances de vue d'ensemble et du transcrit, un brouillard dont la densité suit la distance de la caméra, et des échelles nommées (transcrit, vue d'ensemble, codon, paire de bases) avec des vols adoucis dans l'espace scalaire que toute saisie interrompt depuis la position courante de la caméra : un événement de molette en plein vol a fixé son objectif par rapport à la distance de cette image et le déplacement d'une image à l'autre est resté continu, un glissement a arrêté le vol dès son premier mouvement, Échap a maintenu la caméra en place, et aucune image n'a été rendue une fois le dispositif stabilisé. Une couche d'étiquettes DOM écrit du texte réel à des ancres projetées, avec un contenu propre à chaque échelle (étendues des exons et extrémités de la CDS ; numéros de codons espacés et jonctions ; le codon, son acide aminé et ses bases ; la paire de bases), résout les chevauchements par priorité en plaçant les résultats d'actions au-dessus des lettres statiques, se masque pendant que la caméra bouge et se stabilise 160 ms après son arrêt, et reproduit son texte dans le panneau latéral pour les technologies d'assistance. Le flux Protein World (P8.2.2) a éclairé Mol* depuis le même studio que la scène d'ADN au moyen de ses propriétés publiques (une lumière principale chaude et un contre-jour froid au lieu d'une seule lumière blanche, une ambiance plus basse et plus froide, une occlusion ambiante élargie, le bloom désactivé, le brouillard harmonisé), a restylé l'étiquette de mise en évidence, a nommé le modèle prédit dans la légende de structure avec le libellé Predicted, class 3 (prédit, de la classe indiquée), avec son pLDDT et « listed, not loaded » (répertorié, non chargé), a établi et documenté pourquoi l'environnement du focus ne peut pas recevoir un thème une fois pour toutes (chaque préréglage intégré de Mol* 5.13.1 réécrit le thème de couleur du comportement de focus, si bien que la réapplication après chaque préréglage est la seule voie), et a différé le module Mol* et le fichier de structure au-delà du moment où la scène est prête grâce à un préchargement en période d'inactivité, de sorte que la première interaction n'attend que le module d'index, l'enveloppe, les polices, le logotype et les enregistrements curés. Il a aussi réglé les trois constats reportés de l'audit d'accessibilité : les étiquettes de surtitre exposent désormais des noms en casse de phrase tandis que l'affichage reste en majuscules, Échap ferme Evidence World et rend le focus à son bouton bascule, et la colonne de représentation du pont ne chevauche plus une station à 1400 px. Sur l'arbre fusionné, 322 tests unitaires réussissent (293 avant la phase), et les suites à base de règles des phases 4, 5 et 6, la nouvelle suite d'interruption du zoom sémantique, les deux passes de captures de la phase 8, la passe de captures de la phase 7 et la suite d'accessibilité (0 violation axe) réussissent avec 0 échec (C88).

**Le son, sur adhésion.** Le prompt maître n'autorise un audio original que s'il est sur adhésion, muet au départ et non essentiel. Le troisième flux a construit un langage sonore de six signaux synthétisés (oscillateurs Web Audio, un tampon de bruit généré, des filtres et des enveloppes de gain ; aucun fichier audio, aucune dépendance), chacun lié à une action que l'application signale déjà : un tic sur une sélection, un balayage filtré dont la hauteur suit l'échelle nommée d'un vol, deux intervalles pour le début et la fin de la visite, un carillon par station du pont, le quatrième étant différent, et une houle grave pendant le fondu entre mondes. Le gain principal est de -24 dBFS, chaque enveloppe s'ouvre en 60 à 120 ms, aucun signal ne se répète en moins de 120 ms, rien ne tourne en boucle, et un onglet masqué suspend le contexte. Aucun AudioContext n'existe tant que le visiteur n'a pas appuyé sur un bouton nommé « Sound » (son) doté d'un état enfoncé ; la préférence est mémorisée par navigateur, derrière un try/catch ; désactiver le son coupe, suspend et ferme le contexte. En mouvement réduit, les signaux sont toujours joués lorsque l'utilisateur y a adhéré (le son n'est pas du mouvement), sauf le balayage, remplacé par le tic parce que les vols sont des coupes. La suite de navigateur a mesuré 0 contexte audio sur une page neuve après la visite, un clic sur un codon et un changement de monde, un contexte actif après la bascule, les signaux enregistrés pour chaque action, le contexte fermé après la désactivation, et la préférence conservée après un rechargement (C89).

**Mesures de référence.** Sur la version finale (helix-app 5edeae4), une séquence sérielle unique sur une machine par ailleurs inactive a exécuté les neuf suites à base de règles, les scénarios avec modèle des phases 4, 5 et 6, les temps d'image et les budgets. Chaque suite a réussi avec 0 échec et 0 violation axe ; la question de référence s'est exécutée 5 fois sur 5 avec le modèle et sans repli (fournisseur en 17.6 s en médiane, du clic à la fin en 19.7 s), les annulations ont abouti en 12 à 16 ms, les scénarios de plan périmé et de rafale rapide ont tenu, et la question portant sur le nom de la molécule a toujours emprunté le chemin de vérification et de repli, en 24.3 s, comme consigné lors de la phase 7 (C90). Les budgets d'image ont été tenus avec les mêmes marges que lors de la phase 7 : une médiane de 16.7 ms avec la vsync activée pour chaque mouvement aux rapports de pixels 1 et 2 et en basse consommation, 0 image de plus de 33.4 ms sur 13,829 images, un p95 de la visite sans limitation de 3.8 ms au rapport 1 et de 6.1 ms au rapport 2, si bien que le niveau de détail, les étiquettes, le brouillard et l'abonné sonore n'ont ajouté aucun coût mesurable par image ; les deux images longues en basse consommation de la phase 7 ne se sont pas reproduites (la plus longue à 25.0 ms). L'objectif de démarrage a été atteint : 677.7 kB téléchargés avant la première interaction contre 1,918.6 kB, la scène prête en 165 ms contre 673 ms, le module Mol* et le fichier de structure arrivant à 171 ms par préchargement en période d'inactivité, et le changement de monde à froid en 1,614 ms bien qu'il inclue désormais la création du plugin Mol* ; les changements à chaud sont passés d'environ 1,500 à environ 1,290 ms parce que les nouveaux vols se stabilisent plus tôt (C91). Un budget est dépassé sur la version finale et est rapporté comme tel : une seule image rendue pendant les deux secondes de repos dans Protein World sur chaque page au rapport de pixels 1 avec la vsync activée et sur une page en basse consommation, aucune au rapport 2 ni sans limitation, aucune dans DNA World ; il s'agit d'une invalidation différée autour de la fin du dernier changement de monde plutôt que d'un travail continu, et son traçage est porté à la revue de passage comme point ouvert (C91).

**Les réponses de l'auteur.** La revue de passage a soumis quatorze questions de conception à l'auteur (le début du pont, la taille du réticule et la numérotation des codons en vue d'ensemble, les deux étiquettes du codon du variant, les mouvements courbes, Échap en mode guidé, les styles en majuscules restants, la formulation de la légende du modèle prédit, la cible du focus de Mol*, le préchargement pendant la visite, les lumières en basse consommation, ainsi que l'emplacement de la commande du son, son tic et les signaux du parcours). Toutes ont reçu une réponse le 2026-11-03 (helix D-H016) : treize conservent ce qui a été construit et une l'a modifié, les noms accessibles en casse de phrase étant étendus aux quatre styles en majuscules restants (la ligne de monde de la station du pont, la tête de la bande des codons, l'étiquette de la visite et le titre des limites connues) ; la suite d'accessibilité sur cette version (helix-app cad8356) a signalé 0 échec et 0 violation axe, la région dynamique de l'étiquette de la visite n'annonçant que le texte en casse de phrase (HX-P8-2026-11-03-question-56). Le verdict de passage lui-même était encore ouvert au moment de la rédaction.

**Le verdict de passage et la finition de l'habillage.** L'auteur a validé le passage le même jour avec une condition : l'habillage de l'interface, les cartes et les menus, devait paraître plus haut de gamme (helix D-H017). La finition qui a suivi n'a modifié que les jetons et le CSS, rien dans la scène, les étiquettes ou la caméra. Elle a ajouté une règle à la grammaire Instrument, une carte est un objet surélevé et une commande est une touche usinée : une surface de carte d'un cran au-dessus du panneau, avec un bord supérieur plus lumineux et une ligne d'ombre en dessous, des commandes avec une face supérieure éclairée qui se soulèvent au survol et s'enfoncent à l'appui, le sélecteur de monde et la commande du son sous forme d'un rail en creux portant des touches surélevées, les pastilles de suggestion sous forme de touches de même hauteur, et la barre d'outils de la zone d'affichage de Mol*, son affichage au survol et son panneau restylés dans la même grammaire au moyen de ses noms de classes publics. Le registre de contraste est passé de 190 à 241 paires de texte et d'arrière-plan, chaque paire étant égale ou supérieure à 4.5:1, la suite d'accessibilité a signalé 0 échec et 0 violation axe sur la version finie, et les suites à base de règles des phases 4, 5 et 6 ainsi que les deux jeux de captures ont réussi (helix-app 6cebe35 ; HX-P8-2026-11-03-chrome-polish ; C92). La finition a aussi réglé un défaut que montrait chaque capture de revue depuis la phase 7 : le champ de question apparaissait comme une boîte blanche. Huit sondes ont établi que l'application ne l'a jamais peint en blanc (son arrière-plan calculé était le puits sombre dans chaque état et dans chaque capture rognée) et que le blanc n'apparaissait que de façon intermittente, dans les captures de la fenêtre d'affichage entière, pour le champ de saisie translucide placé dans une carte à filtre d'arrière-plan ; la cause racine dans Chrome sans interface n'a pas été prouvée. Rendre opaque le puits du champ de saisie l'a fait disparaître des 24 captures de la fenêtre d'affichage entière de la version finie. L'auteur a approuvé la finition à partir d'une page avant-après (D-H018), ce qui a clos la phase 8.

### 9.6 Personnalisation multi-gènes (phase 9)

*En cours ; cette section est rédigée au fil de l'avancement de la phase (invariant 14).*

**Le plan d'abord.** La phase 9 s'est ouverte le 2026-11-03, lorsque l'auteur a clos la phase 8 (helix D-H018). Son plan (`docs/phase-9-generalisation.md`) fixe ce qui doit être vrai à la fin avant l'ajout de tout gène : un constructeur unique produit un jeu curé pour tout gène humain codant pour une protéine reconnu, à partir d'une courte spécification de gène, HBB n'en étant qu'une instance ; cinq jeux existent (HBB, CFTR, BRCA1, SLC6A3 et un gène à structure limitée choisi par une vérification de capacités exécutée sur des candidats échantillonnés, et non à la main) ; chaque monde et chaque chapitre est choisi à partir du fichier de capacités du jeu, et aucun chemin de code ne teste un symbole de gène ; un gène reconnu sans jeu curé reçoit un parcours issu d'une récupération en ligne par le même constructeur ; une mesure de variation (distance de Jaccard moyenne par paires sur l'inventaire de scène, le parcours et le vecteur de capacités) donne des nombres à l'affirmation selon laquelle les parcours diffèrent ; et aucun élément ni aucune affirmation fictifs n'apparaissent (une structure de domaine indique sa couverture, un modèle prédit ses bandes de confiance, une voie métabolique une appartenance, un enregistrement Open Targets une association). L'ordre des travaux place tôt le repli honnête : l'extension de confiance AlphaFold, le constructeur générique avec une vérification de HBB identique à l'octet près, le gène à structure limitée, puis CFTR avec sa délétion, Reactome et un Pathway World, BRCA1, Open Targets, SLC6A3, le mode dynamique et la mesure.

**Confiance AlphaFold (P9.1.1).** L'adaptateur AlphaFold lit désormais le pLDDT par résidu dans la table de qualité propre au fichier du modèle (une ligne contiguë par résidu, répartie en bandes selon les seuils d'AlphaFold DB), la matrice d'erreur d'alignement prédite dans le fichier que désigne l'enregistrement de prédiction, ainsi que les fractions par bande et l'indicateur de revue de l'enregistrement. Sur P68871, la moyenne par résidu se situe à 0.012 près du pLDDT global de l'enregistrement, 97.19, et les parts par bande égalent les fractions de l'enregistrement à trois décimales près ; la matrice PAE est de 147 par 147, avec une diagonale inférieure à 1.5 Å et aucune valeur supérieure au maximum déclaré par le fichier (HX-P9-2026-11-03-alphafold-confidence ; C93). Une requête en ligne unique a enregistré le fichier PAE comme donnée de test, avec ses en-têtes et son empreinte ; chaque test s'exécute hors ligne sur celle-ci.

**Un seul constructeur, HBB n'en étant qu'une instance.** Le noyau scientifique était déjà piloté par un objet de configuration ; l'étape 2 du plan a déplacé les choix propres à HBB dans un fichier de spécification de gène (`data/specs/hbb.json` : l'identifiant du jeu de données, les identifiants Ensembl, HGNC et UniProt, l'entrée expérimentale choisie, l'allèle variant choisi avec son enregistrement ClinVar, la région génomique flanquante, le seuil de contact et l'inclusion ou non d'AlphaFold), a ajouté un chargeur strict qui rejette les clés inconnues et toute clé désignant un monde, un chapitre, une caméra ou une couleur, a rendu facultatifs l'entrée expérimentale et le variant de référence, et a fait passer les deux points d'entrée par un exécuteur unique. La preuve est une comparaison octet par octet : une construction de HBB sur données de test avec l'ancien script avant la modification, comparée à une construction avec le nouveau script après celle-ci, ne diffère que par le nom de script du générateur et son indicateur d'état modifié (158 différences d'horodatage autorisées, 14 fichiers ; HX-P9-2026-11-03-generic-builder ; C94). Une spécification sans structure et sans variant, construite à partir des mêmes données de test dans un test, écrit sept fichiers et aucun enregistrement de structure, de contact, de variant, de ClinVar ou de correspondance, et son rapport de capacités indique en toutes lettres ce que la spécification n'a pas sélectionné. Une vérification des identifiants échoue désormais si un identifiant de HBB apparaît dans le code de la bibliothèque en dehors du miroir de la spécification dans le code et d'un fichier du planificateur de repli de la phase 7 inscrit sur une liste d'exceptions.

**Le gène à structure limitée, choisi par une règle.** Le plan exige un gène dont le parcours est honnête sur l'absence de structure expérimentale, et interdit de le choisir à la main. Un outil de recherche parcourt les identifiants HGNC dans un ordre déterminé par une graine (graine 20261103, un petit générateur déterministe sur les identifiants 1 à 60000) et applique trois filtres mécaniques : un gène codant pour une protéine approuvé, avec un seul identifiant UniProt et un transcrit MANE Select ; une entrée UniProt revue sans référence croisée vers la PDB ; un gène Ensembl codant pour une protéine avec un transcrit MANE Select. Il s'arrête lorsque trois candidats ont satisfait aux filtres et retient le premier. Le 2026-11-03, il a visité 22 identifiants, en a écarté 19 (identifiants inutilisés, pseudogènes, ARN non codants, entrées retirées, et une protéine revue dotée de neuf structures) et a choisi FAAH2 (fatty acid amide hydrolase 2, UniProt Q6GMR7, 532 résidus, aucune structure, un modèle AlphaFold), le neuvième identifiant visité ; TMTC4 et WSB2 ont satisfait aux filtres après lui et sont consignés comme suppléants (HX-P9-2026-11-03-structure-limited-gene ; C95). Le constructeur générique a ensuite produit son jeu à partir d'une spécification ne désignant ni structure ni variant : sept fichiers, 21 vérifications réussies, et un fichier de capacités qui indique en toutes lettres pourquoi il n'y a pas de Protein World à montrer. Les onze entrées brutes du jeu ont été enregistrées comme données de test avec la même expurgation que celle appliquée à research/raw, et le jeu se reconstruit à partir d'elles octet pour octet, à l'exception des horodatages et du mode du générateur. Une vérification a dû être généralisée en chemin : la vérification de la méthionine initiatrice supposait l'annotation de HBB d'une Met retirée, que FAAH2 ne porte pas ; la vérification accepte désormais une entrée qui conserve sa Met, et la sortie de HBB est inchangée.

**Le repli de bout en bout.** L'application a ensuite appris à exécuter tout jeu curé. Les enregistrements sont trouvés par leur type dans le manifeste plutôt que par les noms de fichiers de HBB, le champ de gène de l'accueil résout un symbole, un alias ou un identifiant par rapport à un index des jeux curés, et chaque disponibilité affichée provient du rapport de capacités du jeu. Sur FAAH2, le visiteur obtient DNA World avec le transcrit réel, un Protein World désactivé dont le titre et la note portent la raison donnée par le rapport, une carte du panneau latéral qui dit en une phrase pourquoi il n'y a pas de Protein World et répertorie le modèle AlphaFold comme une prédiction non chargée, un parcours en deux chapitres, aucun élément relatif à un variant nulle part, et un refus motivé pour toute question sur la protéine, sans qu'aucune requête de structure soit émise ; les questions prises en charge nomment désormais les capacités dont elles ont besoin, si bien qu'un jeu sans variant n'en propose aucune de celles de HBB. Le contexte du planificateur pour HBB est figé champ par champ par rapport à la sortie du constructeur de la phase 8, et les suites des phases 4, 5 et 6 et d'accessibilité réussissent sans changement aux côtés de la nouvelle suite de la phase 9 (helix-app 649bc26, helix-research 57d7f8e ; HX-P9-2026-11-03-faah2-app ; C96).

**CFTR et la délétion.** Le deuxième gène réel a apporté le premier variant qui n'est pas une substitution. F508del supprime trois bases à cheval sur deux codons : le codon 507 ATC devient ATT et code toujours l'isoleucine, le codon 508 TTT disparaît, et le changement protéique est p.Phe508del, avec conservation du cadre de lecture. Le constructeur modélise désormais une délétion à partir des seules réponses (le recodeur confirme la notation HGVS sur le transcrit MANE Select, VEP nomme la conséquence et le changement protéique, la carte de la CDS et la fenêtre génomique couvrent l'étendue) et calcule le changement protéique par traduction avant de le vérifier par rapport à VEP ; les allèles d'indels ancrés, le placement HGVS en 3' par rapport au placement aligné à gauche de ClinVar, et le SPDI contextuel par rapport à la délétion nette sont énoncés comme des équivalences explicites dans les vérifications. La structure expérimentale est choisie par une règle, et la règle a refusé le candidat le mieux résolu : 6MSM (3.2 Å) porte une mutation E1371Q introduite par ingénierie et n'est pas de type sauvage sur le segment mis en correspondance, si bien que l'entrée retenue est 5UAK (3.87 Å), où le résidu 508 est observé, ce qu'énonce une nouvelle vérification (T40). Le jeu réussit 57 vérifications ; ses onze entrées sont enregistrées comme données de test expurgées et il se reconstruit à partir d'elles octet pour octet. Les questions curées ont été déplacées dans les jeux (les quatre de HBB et les quatre de CFTR, chacune avec les capacités dont elle a besoin), et le jeu HBB, reconstruit hors ligne à partir de son instantané du 2026-11-02, n'a changé que par ce seul fichier (helix-research 95f8511 et le commit de données qui le suit ; HX-P9-2026-11-03-cftr-deletion ; C97).

**La délétion à l'écran.** L'application a ensuite appris la délétion. Le site du variant est devenu une union d'une substitution et d'une délétion, et chaque surface compose son texte à partir des enregistrements : DNA World pose des colliers sur les trois bases supprimées et les entoure d'un anneau en tant que région, avec les compas et le marqueur sur le codon 508 et l'annotation « codons 507 to 508, CTT deleted » (qui signale la suppression de CTT sur ces deux codons) ; la bande des codons marque 507 avec sa troisième base soulignée et 508 barré ; la carte du variant et la comparaison montrent les deux codons avec leurs bases et leurs acides aminés avant et après, et un vide à 508, avec des vérifications qui reproduisent l'enregistrement à partir de la CDS ; les quatre stations du pont présentent la délétion, la traduction, la numérotation et le résidu de la structure, et Protein World aboutit au résidu 508 de 5UAK, avec la mise en évidence ambre ainsi que la méthode et la résolution de la structure ; la question sur les contacts répertorie les sept partenaires de l'enregistrement. Les questions curées sont désormais lues dans l'enregistrement de chaque jeu, si bien que les textes de HBB ont quitté le code. La suite de la phase 9 s'est enrichie de scénarios CFTR à côté de ceux de FAAH2 et de HBB, et les suites des phases 4, 5 et 6 et d'accessibilité réussissent sans changement (helix-app c1a6537, helix-research 10dacfc ; HX-P9-2026-11-03-cftr-app ; C98).

**Les voies métaboliques comme appartenance, et une règle corrigée par son premier résultat.** Le Content Service de Reactome (version 98, données CC0) fournit désormais à chaque jeu un enregistrement d'appartenance aux voies : les voies qui répertorient la protéine, chacune avec sa voie de plus haut niveau, et, pour chaque voie candidate, ses participants tels que Reactome les renvoie, la protéine du jeu étant signalée (HBB 10 appartenances, CFTR 11, FAAH2 1). Le plan avait désigné une « voie principale », choisie comme la plus petite voie non pathologique dotée d'un diagramme et décrite comme la plus spécifique à laquelle appartient la protéine ; la première exécution en ligne a révélé le caractère approximatif de ce critère, en choisissant pour l'hémoglobine une voie de microautophagie dans laquelle elle est un substrat parmi seize, plutôt qu'une voie érythrocytaire. La règle a été conservée comme choix mécanique de la voie sur laquelle s'ouvre le monde, énoncée dans l'enregistrement et dans la raison de capacité comme le choix de la règle et jamais comme une importance ; l'enregistrement conserve les participants de chaque candidate afin qu'un visiteur puisse ouvrir n'importe quelle appartenance, et aucun texte ne qualifie une voie de principale (helix D-H019). Six vérifications protègent l'enregistrement (espèce, classes d'appartenance, présence de la protéine parmi les participants de la voie d'ouverture, participants de chaque candidate) ; les réponses de Reactome ont été enregistrées une fois par jeu avec un nouveau mode mixte du constructeur (l'instantané pour toutes les autres sources), et les trois jeux ont été reconstruits sur des arbres propres avec le nouvel enregistrement pour seul changement (helix-research 40655bc à d2cc2d2 ; HX-P9-2026-11-03-reactome-pathways ; C99). Le monde a suivi le même jour : un quatrième monde après Protein, une couche bidimensionnelle sans 3D, qui répertorie chaque appartenance, ouvre d'abord le choix de la règle et le dit, montre les participants de la voie ouverte tels que Reactome les donne, avec la protéine du jeu dans la couleur de découverte, porte l'étiquette de classe 2 sur chaque surface ainsi qu'une note précisant qu'il s'agit seulement d'appartenance, charge son enregistrement au premier besoin plutôt qu'au démarrage, et donne à chaque jeu un chapitre et une question (« Which pathways list HBB? », quelles voies répertorient HBB ?) à laquelle le planificateur à base de règles répond en entrant dans le monde et en révélant les preuves de l'enregistrement. La suite de la phase 9 est passée à seize scénarios, et chaque suite antérieure réussit sans changement (helix-app 0045af2, helix-research c2cf6a0 ; HX-P9-2026-11-03-pathway-world-app ; C100).

**BRCA1, un domaine et rien de plus.** BRCA1 n'a pas de structure expérimentale de pleine longueur, si bien que son jeu devait dire ce que couvre une structure. Le variant est C61G dans le domaine RING (dbSNP rs28897672, ClinVar VCV000017661, revu par un panel d'experts) ; la vérification des candidats a choisi 1JM7, un ensemble RMN en solution du domaine RING lié à BARD1, plutôt qu'une construction de fusion qu'elle a refusée et deux complexes de cryo-EM qu'elle aurait retenus ensuite. La couverture est devenue un fait de premier rang pour chaque jeu : l'enregistrement de structure indique l'étendue observée, les décomptes, la longueur de la protéine et la fraction en toutes lettres, que le rapport de capacités reprend (1JM7 couvre les résidus 1 à 103 sur 1,863, soit 5.5 % ; selon la même règle, 2HBS couvre 146 des 147 de HBB et 5UAK 1,139 des 1,480 de CFTR), une entrée RMN porte son nombre de modèles et le modèle affiché, l'entité partenaire est nommée à partir des références croisées propres à l'entrée, et le modèle prédit porte ses bandes de confiance (80 % du modèle AlphaFold de BRCA1 en confiance très faible). Deux vérifications protègent la méthode et l'arithmétique de la couverture ; les quatre jeux ont été reconstruits sur des arbres propres avec ces champs pour seul changement (helix-research bd8531f à f3fb6bf ; HX-P9-2026-11-03-brca1-domain-structure ; C101).

**À l'écran.** L'application a ensuite placé ces faits là où un visiteur les lit : pour chaque jeu, la légende de Protein World énonce en toutes lettres la méthode, la résolution ou son absence, le nombre de modèles et celui qui est affiché, la couverture sous forme d'étendue et de part, et l'entité partenaire avec laquelle la structure a été résolue ; en dessous de 90 % de couverture, la légende, une carte du panneau latéral et les limites connues reprennent la phrase propre à l'enregistrement selon laquelle le reste n'a pas de coordonnées expérimentales et qu'un modèle prédit ne s'y substitue jamais ; la ligne du modèle prédit indique sa part de confiance lorsqu'une bande atteint 5 %. BRCA1 fonctionne de bout en bout (DNA World sur le codon 61, le pont vers CYS 61 du modèle 1 de 1JM7, les contacts incluant le zinc, Pathway World), CFTR gagne sa ligne et sa note de couverture, et HBB est inchangé (helix-app 5db4a7c, helix-research 61e6935 ; HX-P9-2026-11-03-brca1-app ; C102). Quatre jeux curés fonctionnent désormais sur quatre mondes.

**Des associations, jamais des causes.** Open Targets a fourni à chaque jeu un enregistrement d'associations à des maladies : une requête par gène, enregistrée une fois, accompagnée de la version de la plateforme, les 25 associations au score le plus élevé conservées avec leurs scores par type de données et par source de données, et les sources de données dont le projet ne peut pas reprendre les licences écartées lors de l'analyse (Europe PMC, le Cancer Gene Census, et les preuves cliniques de la plateforme dérivées de ChEMBL, cette identification étant consignée comme une décision). Evidence World affiche le tableau sous une pastille de classe 2, avec la phrase précisant qu'une association n'est jamais causale ; le planificateur peut en citer une avec son score sous la même phrase, et les jeux n'ont pas changé par ailleurs (helix-research 8845ce9 à 1efe223 ; HX-P9-2026-11-04-opentargets-associations ; C103).

**Le test de généralisation.** Le cinquième gène, SLC6A3, a été conçu comme un test de l'affirmation selon laquelle rien n'est codé en dur par gène : le jeu devait sortir du constructeur existant sans nouveau type d'enregistrement, et l'application devait l'exécuter sans nouveau code. Les deux conditions ont été tenues. Son variant a été choisi par une règle appliquée à ClinVar, et la passe propre à la règle n'a rien trouvé : SLC6A3 n'a aucun enregistrement faux-sens à deux étoiles ou plus, si bien que le repli que la règle autorise a retenu R85W à une étoile, ce que disent le jeu, la carte et Evidence World. Sa structure, le transporteur humain de la dopamine 8Y2C (cryo-EM, 3.16 Å), provient de la vérification des candidats, après le refus d'une entrée portant une mutation introduite par ingénierie. L'exécution a aussi révélé deux vérifications qui supposaient implicitement la forme de HBB, un site multi-allélique et un variant naturel UniProt à la position ; toutes deux ont été généralisées sans modifier les résultats des quatre premiers jeux. Cinq jeux curés fonctionnent désormais sur quatre mondes par un seul chemin de code (helix-research af21d47 et b630bee ; HX-P9-2026-11-04-slc6a3-generalisation ; C104).

**Le mode dynamique.** Un gène reconnu sans jeu curé peut désormais être récupéré en ligne, dans le navigateur du visiteur, par le même constructeur et le même chargeur : un worker résout le symbole par HGNC, récupère le transcrit, les séquences, l'entrée UniProt et l'enregistrement de prédiction AlphaFold auprès des quatre sources que le registre a mesurées comme ouvertes aux navigateurs, exécute les vérifications inchangées, et remet les fichiers au chargeur avec la vérification d'empreinte sur le manifeste qu'il vient d'écrire. Le jeu a la forme honnête du gène à structure limitée : aucune structure n'est sélectionnée parce qu'il n'y a ni sélection revue ni vérification des candidats au moment de la requête, aucun variant, aucune récupération de voies ni d'associations (ces services découragent les requêtes entité par entité émanant de chaque visiteur), et un bandeau, une limite et chaque explication indiquent « retrieved live, not curated » (récupéré en ligne, non curé) avec les versions utilisées ; rien n'est conservé d'une visite à l'autre. Cinq gènes ont été enregistrés une fois pour les tests hors ligne, et une exécution en ligne sur PTEN a coûté douze requêtes et moins de trois secondes. L'étape a révélé trois autres hypothèses dans la bibliothèque (une entrée sans caractéristique Chain, une entrée UniProt partagée par deux gènes, les corps de réponse décompressés par un navigateur) et les a généralisées sans modifier les jeux curés (helix-research 920f70b, helix-app 796b0f3 ; HX-P9-2026-11-04-dynamic-mode ; C105).

**Les nombres sous l'affirmation, et le passage.** La mesure de variation du plan a été calculée avec le chargeur, le contexte, l'inventaire, le planificateur et le module d'appariement des chapitres propres à l'application sur les cinq jeux : la distance de Jaccard moyenne par paires est de 0.525 sur l'inventaire de scène, de 0.218 sur le vecteur de capacités et de 1.000 sur le parcours tel que le plan l'avait défini, une valeur qui ne dit rien parce que le chapitre du transcrit nomme le gène et que la cible de chaque autre chapitre est propre au jeu ; un axe supplémentaire de forme du parcours (identifiant du chapitre, monde, type de focus) donne 0.267 et montre le tableau honnête, quatre jeux partageant une forme et le gène à structure limitée une autre (HX-P9-2026-11-04-variation-metric ; C106). La phase 9 a clos sa construction le 2026-11-04 avec cinq jeux curés sur quatre mondes, le mode dynamique, 447 et 450 tests unitaires, une suite de la phase 9 de 40 scénarios et chaque suite antérieure au vert, ainsi que cinq questions pour l'auteur consignées dans sa revue de passage ; le verdict de l'auteur décide de ce que le rapport dira ensuite.

### 9.7 Explorateur d'IA contextuel avancé (phase 10)

*Rédigée au fil de l'avancement de la phase (invariant 14) ; le verdict de passage appartient à l'auteur.*

**Le plan d'abord.** La phase 10 s'est ouverte le 2026-11-04, lorsque l'auteur a validé le passage de la phase 9 (helix D-H021). Son plan (`docs/phase-10-ai-explorer.md`) demande six nouvelles actions dotées de contrats complets, des questions liées à ce qui est sélectionné à l'écran, un profil de session visible et jamais conservé, une nouvelle version du prompt rédigée sans accès à l'évaluation, une défaillance maîtrisée dans l'application en fonctionnement, et un banc d'essai figé couvrant les cinq gènes, avec des séquences de suivi et des éléments d'injection, exécuté sur le modèle local livré par rapport au planificateur à base de règles.

**Six actions, d'abord sur le chemin à base de règles.** Le registre s'est enrichi de `selectTranscript`, `showProteinDomains`, `showPathway`, `setRepresentation`, `beginTransition` et `returnToOverview`, chacune avec ses prérequis, ses refus et son comportement d'annulation, et le planificateur à base de règles a appris à les planifier. Le prompt v5 est resté identique à l'octet près : un plan du modèle sous v5 qui nomme une nouvelle action est rejeté comme non enseigné par sa version de prompt, si bien que le comportement mesuré lors des phases 3 à 9 n'a pas bougé (HX-P10-2026-11-04-extended-registry ; C107).

**Ce qui est sélectionné, et qui pose la question.** Une question telle que « Why is this residue important? » (pourquoi ce résidu est-il important ?) est désormais liée à la sélection : la réponse cite les enregistrements de ce résidu ou de ce codon et rien d'autre, si bien qu'un résidu sans caractéristique ni contact enregistrés le dit et renvoie à l'élément enregistré le plus proche, sans jamais emprunter les preuves du variant. Un profil de session, construit uniquement à partir de ce que le visiteur a fait à l'écran, modifie la profondeur des explications et l'ordre des propositions ; il est affiché sur une carte, se réinitialise au clavier et n'est jamais conservé (HX-P10-2026-11-04-context-and-session ; C108).

**Le prompt v7 et les défaillances provoquées.** Le prompt v7 enseigne les six actions, le bloc de sélection et le bloc de session. Il a été rédigé par un agent à qui il était interdit d'ouvrir le dossier du banc d'essai, les versions v1 à v6 restant identiques à l'octet près et figées. Cinq types de défaillance ont ensuite été provoqués dans l'application en fonctionnement : un plan invalide, un dépassement de délai, un plan rendu périmé par un changement de gène, une annulation en cours de plan, et une instruction injectée dans un texte récupéré ; chacun aboutit à un état énoncé, et un nouveau filtre rejette tout plan qui reprend quatre mots consécutifs d'un texte récupéré (HX-P10-2026-11-04-prompt-v7-and-failures ; C109). L'auteur a ensuite figé ensemble le jeu du banc d'essai et v7 (D-H023).

**L'exécution mesurée.** Le jeu figé compte 112 unités : 85 questions sur les cinq gènes, cinq séquences de suivi de trois tours, et 12 éléments avec une instruction injectée dans un champ d'enregistrement. Chacune a été planifiée trois fois par le planificateur à base de règles et par ministral-3:8b à température 0, et la politique du directeur (le plan du modèle lorsqu'il est valide, sinon le plan à base de règles) a été rejouée à partir des sorties conservées. Le résultat est globalement négatif : la politique a été correcte et valide sur 273 des 336 sorties, le planificateur à base de règles seul sur 276 et le modèle seul sur 252. Le partage est net. Le modèle a été meilleur là où les listes de règles ne couvrent pas la formulation : les six nouvelles actions (96 contre 66 sur 102) et les tours de suivi ultérieurs (24 contre 12 sur 30). Il a été moins bon sur les types de questions des phases 3 à 9 : il a refusé toutes les questions d'association, a répondu aux questions de contact avec le variant, et a perdu les premiers tours de suivi ; ces plans erronés sont valides, si bien que le repli ne peut pas les rattraper. Chaque unité a donné le même verdict lors des trois répétitions, il s'agit donc de comportements systématiques plutôt que de bruit. Le temps de planification médian a été de 14.2 s (HX-P10-2026-11-04-benchmark ; C110).

**L'injection et les explications.** Chaque élément d'injection a tenu sous la politique. Le modèle seul a échoué trois fois sur un élément, en nommant l'identifiant injecté dans sa justification ; la validation l'a rejeté. Les explications ont été vérifiées par une liste de règles, puis chaque texte signalé a été lu en entier : aucun des textes à base de règles et quatre des unités du modèle ont formulé une affirmation interdite, deux décrivant une structure de référence comme montrant le variant, une énonçant un lien avec une maladie qu'aucun enregistrement ne contient, une suggérant un domaine pour un résidu qui n'en a pas. Trois de ces plans étaient valides, si bien que la politique a conservé leur texte : la validation vérifie les actions et les identifiants, pas la prose (C111).

**Des plans à l'écran.** Le banc d'essai a noté des plans ; le passage exige un comportement visuel, si bien que les 112 plans de la politique ont été rejoués par la validation et l'interpréteur propres à l'application, sur les états énoncés des unités. 109 se sont exécutés proprement et chaque étape que le harnais pouvait relire montrait ce qu'elle nommait ; chaque refus a laissé la scène en l'état. Les trois échecs ont une cause commune : le validateur accepte l'ouverture de toute voie que l'enregistrement répertorie, mais l'enregistrement ne conserve les participants que pour les candidates de la règle d'ouverture, si bien que l'application ne peut pas dessiner les autres. L'un de ces plans avait été noté correct, si bien que le score au niveau des plans surestime l'écran d'une unité. La séquence d'images due depuis la phase 8 a aussi été exécutée : 24 des 29 budgets sont tenus ; les images rendues au repos dans Protein World subsistent, une image longue est apparue sous une charge système en arrière-plan, et les ressources ont dépassé leur budget, principalement à cause du worker du mode dynamique (HX-P10-2026-11-04-gate-evidence ; C112, C113).

**Ce que les nombres indiquent.** Le projet de laisser le modèle tout décider après validation n'est pas étayé par ce jeu. Un partage qui confierait au modèle les actions de l'explorateur et les tours de suivi ultérieurs et garderait les règles ailleurs obtiendrait ici un score plus élevé, mais cette estimation est interne à l'échantillon et non testée. Le résultat sur les associations pourrait venir de ce que le prompt v7 n'affiche aucune ligne d'association ; le vérifier exige une nouvelle version du prompt, ce qui constitue une nouvelle étude. Ce sont des constats destinés à la revue de passage de l'auteur.

**Les réponses de l'auteur, et une correction.** L'auteur a choisi le partage : le modèle pour les six actions de l'explorateur et les tours de suivi ultérieurs, les règles ailleurs, avec un nouveau prompt v8 qui affiche les lignes d'association et indique quelles voies peuvent être ouvertes, un validateur qui refuse les autres, un filtre côté application sur la prose du modèle, et la correction de la structure chargée (D-H024). Sur les sorties conservées, le partage atteindrait 309 sur 336, mais la règle a été rédigée après leur lecture, si bien qu'il s'agit d'une estimation ; la mesure est un jeu réservé rédigé avant qu'aucun modèle ne le voie. L'application du nouveau filtre aux sorties conservées a aussi révélé 18 sorties du modèle que la liste de règles avait manquées (dont 15 modifiant le décompte), chacune décrivant une structure de référence comme montrant le variant ; le décompte sûr du modèle tombe à 294 et celui de la politique à 300 (HX-P10-2026-11-04-dh024-build ; C111 corrigée, C114).

**La mesure sur le jeu réservé.** Après que l'auteur a figé le jeu réservé et v8 (D-H025), le partage a été mesuré sur 58 nouvelles unités, avec 3 répétitions chacune. Il a répondu correctement à 120 sur 174, contre 96 pour les règles seules, a été au moins aussi sûr (165 contre 162 après lecture de chaque explication) et a tenu les 18 sorties d'injection, si bien que l'hypothèse énoncée avant l'exécution est confirmée. Ce n'est pas le meilleur planificateur ici : laisser le modèle répondre en premier, avec les règles comme repli, obtient 144, au prix de 3 sorties d'injection et d'un énoncé faux affiché à l'écran (un résidu supprimé décrit comme montré sur une structure qui le porte). L'estimation interne à l'échantillon de 92% pour le partage est tombée à 69% sur les nouvelles lignes. Le filtre des affirmations n'a pas aidé sur des textes nouveaux : ses 7 détections étaient toutes des faux positifs, dont l'un a coûté 3 réponses correctes, et il a manqué le seul énoncé faux qui a atteint l'écran (HX-P10-2026-11-09-heldout-run ; C115, C116).

**Un audit final.** Avant le passage, l'auteur a demandé une vérification supplémentaire (D-H026). Un audit indépendant a recompté chaque nombre de la phase 10 à partir des sorties brutes et les a tous confirmés, a relu un échantillon des verdicts sur les explications et en a contesté un : un élément d'injection dans lequel le modèle a écrit que le variant « is shown on the structure where it is experimentally resolved » (est montré sur la structure là où il est résolu expérimentalement), à propos d'une structure qui porte le résidu de référence. C'est la même affirmation fausse que dans les cas corrigés, si bien que les décomptes sûrs de la phase 10 baissent de nouveau, à 291 sur 336 pour le modèle et 297 pour la politique (C111). L'audit a aussi établi que les scores conservés de la phase 10 sont antérieurs à la modification du validateur de D-H024 ; avec le validateur actuel, les mêmes sorties obtiennent 273 pour les règles, 249 pour le modèle et 270 pour la politique, et l'estimation interne à l'échantillon pour le partage est d'au plus 306 sous un même validateur (HX-P10-2026-11-09-final-audit).

**La clôture de la phase.** La vérification finale à l'exécution a relevé deux lacunes sur le chemin livré. Premièrement, après une visite dans Protein World, DNA World indiquait encore au planificateur qu'une structure était chargée. Deuxièmement, sous le partage, les anciennes questions de test n'atteignaient jamais le modèle, si bien que l'annulation d'une réponse du modèle et le rejet d'une réponse périmée n'étaient plus testés là où se trouvent les visiteurs. L'auteur a demandé que les deux soient corrigées et que les chemins locaux soient retirés de l'historique public (D-H027). La structure n'est désormais nommée que dans Protein World, ce que fige un test rédigé avant la modification. De nouveaux scénarios de navigateur atteignent le modèle sur la page par défaut et exercent l'annulation, les plans périmés, un dépassement de délai et une séquence rapide, avec un substitut et avec le modèle local. L'historique a été réécrit, avec une table publiée des anciens identifiants de commit vers les nouveaux. Ces points vérifiés, la condition de l'auteur était remplie et la phase 10 a franchi son passage le 2026-11-09. Un coût du partage est apparu ici : une question de suivi attend un plan du modèle que le partage écarte ensuite lorsqu'il ne contient aucune action de l'explorateur (helix-app docs/reviews/phase-10-close.md).

**Nouvelle notation avec le code propre à l'application.** À l'ouverture de la phase 11, l'auteur a demandé que le code du banc d'essai cesse de réénoncer des fonctions de l'application et que les deux exécutions soient notées de nouveau (D-H029, réponse 87). Une fois construite avec le pont de sélection et les sujets de session propres à l'application, l'entrée du modèle a changé sur 2 des 112 unités de la phase 10 et sur 3 des 58 unités du jeu réservé, et le modèle n'a été réexécuté que sur celles-ci. Aucun verdict n'a changé dans l'une ou l'autre exécution (C117, C118). Le seul mouvement dans le tableau de la phase 10, les règles passant de 276 à 273, provient de la modification de D-H024 dans la façon dont les règles répondent à une voie qui ne peut pas être dessinée, et non du harnais. Le score de la politique avec le validateur actuel dépend d'une base énoncée : 270 si les choix de la phase 10 sont conservés et revérifiés, 276 si le validateur actuel décide aussi du repli (HX-P10-2026-11-09-rescore, HX-P10-2026-11-09-heldout-rescore).

### 9.8 Assurance qualité, performance et accessibilité de niveau publication (phase 11)

**Les premières décisions de l'auteur, mises en œuvre.** La phase s'est ouverte avec les réponses de l'auteur aux questions 81 à 90 (D-H029) : la suite complète de contrôles de passage proposée, chaque budget maintenu, une liste d'autorisations pour la relecture, les images au repos maintenues à zéro, une commande « Answer with the rules now » (répondre maintenant avec les règles), des explications rédigées par l'application, et des messages de clarification formulés avec les noms propres à chaque jeu. Chaque changement de comportement a été figé par un test avant d'être effectué. Les images rendues au repos dans Protein World, en suspens depuis la phase 8, provenaient du canevas masqué de DNA World, qui effectuait encore un rendu chaque fois qu'une image était demandée, par exemple après la sélection d'un résidu liée à un codon. Ce canevas étant arrêté lorsqu'il est masqué, les images au repos ont été nulles dans chaque mesure d'images de la passe. Les exécutions des budgets échouaient encore sur des images longues isolées lorsque DNA World était visible (71.7 ms et 76.3 ms contre 33.4 ms, une page sur trois) ; une comparaison entrelacée avec la version précédente n'a montré d'image longue ni sur l'une ni sur l'autre, si bien qu'elles sont interprétées comme une charge de la machine en attendant les mesures de référence sur machine au repos (C119). Les messages de clarification nomment désormais la protéine du jeu, et les scores des règles n'ont pas bougé : 273 sur 336 sur le jeu de la phase 10 et 96 sur 174 sur le jeu réservé, avant et après (C120). Le visiteur ne lit plus aucun texte rédigé par le modèle : l'application écrit une phrase à partir des actions du plan, et les suggestions de suite du modèle ne sont pas proposées. Pendant l'attente du modèle, le visiteur peut faire répondre les règles ; avec le modèle local, la réponse des règles s'est achevée 5.2 à 6.8 s après l'appui (C121). Une suite de mise en page, rédigée après que l'auteur a signalé des panneaux qui débordaient et une page qui défilait hors de la fenêtre, a relevé des défauts sur la totalité des 185 écrans de bureau qu'elle vérifie ; après la correction, il n'en reste aucun, et les écrans de moins de 1024 px reçoivent une page sans les mondes 3D qui montre encore la séquence, les preuves et les limites (C122). Sur une machine au repos, la version a tenu 27 des 29 budgets et chaque budget de basse consommation ; les deux dépassements, une image de 141.8 ms et une image au repos, sont tous deux survenus sur la première page d'une exécution et ne se sont pas reproduits sur cinq pages supplémentaires observées avec les enregistrements long-animation-frame de Chrome, si bien que leur cause n'est pas attribuée (C123).

**Points reportés, première passe.** L'analyse d'accessibilité de chaque écran de mise en page a relevé 56 violations d'une seule règle, toutes sur la bande des codons : un bouton de codon sorti de la bande par défilement et coupé par le bord de la zone d'affichage ne montrait qu'une partie de ses lettres, qui ne correspondaient plus à son nom accessible. Les boutons étant nommés d'après leur contenu visible, l'analyse n'en a relevé aucune sur 245 écrans (C124). Les règles donnaient une réponse de domaine sur une structure qui ne contient aucun des domaines (résidu 61 de BRCA1 sur 1JM7) ; la version 3 des règles refuse dans ce cas et nomme les étendues. Sur les jeux figés, cela modifie une unité, qui devient sûre mais reste notée comme non correcte (C125). La relecture du jeu réservé répertorie désormais cette unité comme une différence voulue (décision de l'auteur D-H035) ; les lignes figées sont inchangées. La correction ne couvre que les règles : un plan du modèle du même type passerait encore la validation, et le harnais de recherche ne l'applique pas. La suite de mise en page couvre désormais les gènes récupérés en ligne, où deux notes chevauchaient la plaque de la visite (C126), et localise l'étiquette de résidu de Mol* dans la scène à partir des objets propres à Mol* ; l'étiquette est désormais plus petite, placée à côté du résidu, et masquée sous l'accueil et sur les écrans de moins de 1160 px (C127).

**Points reportés, deuxième passe.** L'image rendue au repos observée une fois lors des mesures de référence ne s'est pas reproduite sur 60 pages, chacune ouverte dans un navigateur neuf, et rien ne s'est chargé tardivement ni n'a demandé d'image pendant que la scène était au repos ; sa cause reste inconnue (C128). Une tache lumineuse dans la vue d'ensemble de l'ADN, consignée lors de la phase 8 comme un reflet satiné, s'est avérée provenir des tubes en métal brossé ; plafonner la luminosité de chaque surface non ambre sous le seuil du bloom l'a supprimée sans coûter aucun budget d'image (C129). La commande Sound a été intégrée au système de conception sans changement de comportement. Une nouvelle suite vérifie que l'application est complète sans aucun modèle de langage : chaque question prise en charge des cinq gènes reçoit une réponse des règles, sur un serveur proche de la production et sur une page de développement où le modèle local est injoignable, et aucune requête n'atteint le modèle (C130). La recherche de gènes accepte les symboles et les alias, mais pas les noms complets des gènes.

**Niveaux d'appareil et test d'endurance de la mémoire.** L'application choisit désormais l'un de quatre niveaux de rendu à partir de ce qu'expose le navigateur et d'un court test d'images effectué pendant que l'accueil est ouvert : la scène complète, une scène équilibrée sans profondeur de champ, la scène en basse consommation, ou une page sans 3D. Rien n'est conservé ni envoyé, et le visiteur peut passer outre ce choix. Des machines plus lentes ont été émulées sur l'unique Mac de développement plutôt que mesurées sur de vrais appareils. Dans chaque condition émulée, le niveau attendu a été choisi, les budgets de référence ont tenu, et la page sans 3D a conservé chaque ligne de preuve et chaque limite (C131). Sa construction a révélé deux défauts, tous deux corrigés : cette page, ainsi que la page étroite, n'avaient pas la carte des associations à des maladies, et un glissement qui se terminait à son point de départ sélectionnait une base. Avec le processeur ralenti de quatre à six fois, l'image médiane est restée à 16.7 ms, mais un clic produisait quelques images longues qu'aucun niveau ne supprime, parce qu'elles proviennent de la mise à jour de l'interface plutôt que du dessin de la scène (C132). Sur vingt questions et changements de monde sur une même page, la mémoire et les ressources graphiques n'ont pas crû au-delà des budgets convenus (C133), et le code livré ne contient aucun paquet serveur (C134).

**Des budgets pour les machines plus lentes, et les noms de gènes.** L'auteur a ensuite fixé des budgets pour les machines plus lentes émulées : des temps de démarrage par facteur de ralentissement, et au plus une image de plus de 33.4 ms, chacune de moins de 150 ms, lorsqu'un clic lance un mouvement. Ce coût du clic est désormais une limite énoncée plutôt qu'un défaut à corriger. Le niveau complet a tenu chacun de ces budgets avec un ralentissement de quatre et de six fois (C135). Le rendu logiciel mettait plus de 22 s pour atteindre la page sans 3D. L'application demande désormais au navigateur si son moteur de rendu est logiciel, n'en conservant que le oui ou le non, et envoie un tel moteur directement vers cette page en environ 1.3 s. Cela renverse une règle antérieure selon laquelle la sélection du niveau ne lit rien qui puisse identifier la machine du visiteur, et l'auteur a choisi de le conserver. Lorsque le navigateur masque le nom du moteur de rendu, un test d'images antérieur prend encore environ 19 s (C136). Enfin, la recherche ouvre désormais un gène à partir de son nom complet aussi bien que de son symbole, en n'utilisant que les enregistrements fournis avec l'application, et les réponses des règles sur les deux jeux de questions figés n'ont pas changé (C137).

**L'accessibilité dans trois navigateurs.** L'audit d'accessibilité automatisé a été étendu à chaque gène curé, à chaque monde, à un gène dynamique enregistré et aux commandes ajoutées depuis la phase 7, et exécuté dans Chrome, Firefox et Safari. Les trois moteurs n'ont montré aucune violation axe, et chaque commande avait un nom dans l'arbre d'accessibilité de chaque navigateur (C138). L'audit a relevé six défauts, tous corrigés. Les couches des voies et des preuves recouvraient le sélecteur de monde. Des commandes masquées restaient accessibles par Tab sous elles. Un bouton de monde laissait la couche des preuves ouverte. Firefox comptait deux fois la bande des codons dans l'ordre de tabulation, et Safari accolait deux mots d'un titre. Les suites plus anciennes se sont exécutées entièrement dans Firefox mais seulement en partie dans Safari, qui ne peut ni intercepter les requêtes réseau ni émuler le réglage système de mouvement réduit, et deux échecs dans Safari restent inexpliqués (C139). Deux constats sont laissés à l'auteur : rien n'annonce une réponse lorsqu'elle apparaît, et une base isolée ne peut toujours pas être atteinte au clavier. Personne n'a écouté avec un lecteur d'écran, si bien que ce qui est annoncé à voix haute n'est pas vérifié. La réexécution du budget d'image a montré qu'il n'a aucune marge : la même version a donné 17.0 ms sur une machine chargée et 16.8 ms, la limite, sur une machine au repos (C140).

L'auteur a ensuite réglé les points ouverts. Lorsqu'une réponse, une clarification ou un refus apparaît, une courte ligne l'annonce désormais, en reprenant la première phrase propre aux règles, jamais un texte du modèle. Les touches fléchées à l'intérieur d'un codon parcourent ses trois bases. Les notes des mondes restent visibles au-dessus d'une couche ouverte. Choisir un monde pendant que les preuves sont ouvertes change le monde situé derrière elles et le dit. Les listes déroulantes affichent le même anneau de focus dans chaque navigateur. Les trois navigateurs ne montrent toujours aucune violation axe (C141). Pour tenir dans le budget de taille, deux éléments de style ont été simplifiés. La page au repos est désormais 23 octets sous son budget de 2,000 kB, si bien que toute modification livrée supplémentaire exige d'abord de libérer de la place (C142).

**L'audit scientifique de chaque affirmation affichée.** Helix n'a aucun relecteur indépendant de sa science (D-H031), si bien que l'audit a été rendu aussi mécanique que possible et exécuté par l'IA. Un script a recueilli chaque texte que l'application affiche sur le chemin des règles : 9,215 textes distincts provenant de 80 écrans et les réponses à 31 questions à trois profondeurs. Un deuxième script a rattaché chaque texte au champ d'enregistrement ou à l'élément de code nommé qui l'écrit. Aucun n'est resté sans source (C143). Les faits ont ensuite été vérifiés par rapport à leurs enregistrements, les codons et les lignes de sélection étant recalculés à partir des séquences et chaque phrase de réponse étant vérifiée selon son type. Un troisième script a comparé 159 champs d'enregistrement affichés avec les réponses brutes à partir desquelles ils ont été construits. Rien ne différait (C144). L'audit a toutefois relevé deux lignes de limites qui décrivaient le code ou un enregistrement de façon erronée, et elles ont été corrigées. Il a aussi relevé un refus qui indique qu'UniProt ne répertorie aucune caractéristique de type domaine alors que seule la copie réduite de Helix en est dépourvue ; celui-ci est laissé à l'auteur (C145). Une lacune de provenance subsiste : le jeu HBB ne peut plus être reconstruit à l'identique à partir des entrées consignées publiques (P11-S-01). Les affirmations ont été vérifiées par rapport à leurs enregistrements uniquement par un audit assisté par l'IA, sans expert indépendant du domaine.


**La revue de sécurité, de vie privée et de chaîne d'approvisionnement (partie web).** La revue a suivi les huit points du plan de la phase ; l'enveloppe de bureau n'est pas encore construite, si bien que ses permissions et ses dépendances Rust attendent les tests de bureau. L'audit des dépendances n'a relevé aucune vulnérabilité connue dans l'un ou l'autre dépôt ni dans les quatre expériences, et l'unique avis reporté de la phase 10 est clos (C146). Rien de ce que tape le visiteur ou de ce que renvoient les bases de données publiques n'est transformé en balisage ou en code de la page : une question contenant du balisage est affichée en texte brut, le modèle ne peut que choisir dans une liste fixe d'actions typées portant sur des cibles nommées, et il n'est pas consulté du tout lorsqu'un texte récupéré est présent (C147). Seule la visionneuse moléculaire écrit du balisage, pour son étiquette au survol, à partir de fichiers de structure curés dont l'intégrité est vérifiée. Helix n'avait pas de Content Security Policy. Une telle politique a été rédigée ; elle interdit les scripts en ligne et évalués ainsi que les styles en ligne, et limite les connexions à l'application et aux quatre bases de données publiques du mode dynamique. Avec cette politique appliquée, les principales suites de tests ont réussi sans changement, et les seules violations étaient la vérification inoffensive, propre à zod, du code évalué (C148). Elle doit être envoyée comme en-tête de réponse par l'hébergeur que choisira la phase 12 : écrite dans la page, elle ajouterait 367 octets et dépasserait le budget de taille de 340, alors qu'en en-tête elle ne modifie en rien la taille mesurée. Aucune requête d'une session enregistrée ne portait de cookie, d'adresse électronique ni quoi que ce soit au-delà des en-têtes propres au navigateur, et rien n'est resté ensuite dans le stockage du navigateur (C149). Deux constats moins importants sont allés à l'auteur. Le champ de question n'a pas de limite de longueur, bien qu'une question de 100,000 caractères ait reçu une réponse en environ deux secondes. Le paquet contient aussi deux copies de la même bibliothèque de validation, et en retirer une libérerait environ 24.6 kB du budget de taille, où il reste maintenant 27 octets (C150).

**Les réponses de l'auteur sur la sécurité et l'audit.** L'auteur a réglé les trois questions de sécurité et le point ouvert de l'audit concernant un texte de refus (D-H039). La deuxième copie de la bibliothèque de validation provenait des paquets de recherche, qui sont liés à l'application par chemin et résolvaient donc leur propre copie de la même version. La construction résout désormais une seule copie. Cela libère 24,597 octets du budget de taille, qui dispose maintenant d'environ 25.8 kB de marge, et réduit de moitié les rapports attendus de la politique de sécurité, à un par page ; les suites ont ensuite été exécutées de nouveau (C151). Ce rapport restant est conservé comme attendu jusqu'à l'hébergeur de la phase 12. Le champ de question accepte désormais au plus 500 caractères, et l'application tronque à la même longueur tout texte plus long qui lui est transmis avant que les règles ou un modèle ne le voient (C152). Le refus pour une protéine sans domaines indiquait qu'UniProt ne répertorie aucune caractéristique de cinq types, alors qu'UniProt en répertorie certaines pour ces protéines ; seule la copie de l'enregistrement propre à Helix en est dépourvue. Il indique désormais que la copie de Helix ne conserve que les caractéristiques Domain. C'est la version 4 des règles : sur les deux jeux figés, chaque score est inchangé, et seule la formulation de deux refus diffère (C153). L'audit des textes vérifie désormais la nouvelle formulation par rapport à l'enregistrement et à la réponse brute d'UniProt, et l'ancienne formulation y échouerait de nouveau (C154). Le budget d'image de 16.8 ms a été manqué de 0.1 ms sur une mesure sur trois, y compris après la réexécution automatique ; la version antérieure à ces modifications l'a manqué de 0.2 ms lors de la même vérification, si bien que la cause est l'absence de marge du budget sur cette machine, et non ces modifications (C155).

**Licences, attribution et coût (partie web).** L'audit des licences a été achevé pour la version web ; la partie de bureau attend le paquet de bureau. La liste du code tiers a été tirée de la construction elle-même, et non du fichier de verrouillage des dépendances : la construction consigne désormais chaque module de chaque script qu'elle écrit, y compris les scripts chargés ultérieurement et le worker d'arrière-plan, et attribue chacun à son paquet. La construction contient 89 paquets tiers, contre 229 entrées d'exécution dans le fichier de verrouillage : 86 sous licence MIT, un sous chacune des licences ISC, Apache-2.0 et 0BSD, et aucun paquet côté serveur (C156). Jusqu'à cette passe, la construction ne portait aucun texte de licence, parce que le minificateur supprime chaque commentaire et qu'il n'existait aucun fichier de mentions. La construction en écrit désormais un, avec le texte complet de la licence de chaque paquet lu dans le paquet installé, 53 mentions de droits d'auteur que des fichiers intégrés portent à partir de code repris d'autres projets (Mol* en porte la plupart, dont une sous une licence de partage à l'identique), les licences des polices et les conditions des sources de données. Les visiteurs l'ouvrent depuis Evidence World ; la page ne le télécharge jamais, si bien que le seul coût au repos est celui des 233 octets du lien (C157). Chaque source de données des jeux livrés a son attribution à l'écran dans Evidence World. Les deux licences qui demandent davantage qu'un nom ne sont que partiellement servies dans les cartes elles-mêmes : le lien vers la licence Creative Commons pour UniProt et AlphaFold DB, et la mention du NCBI pour ClinVar, sont atteints par les mentions (C158). Les 15 fichiers de polices correspondent tous à leur origine consignée et relèvent de la SIL Open Font License ; le paquet React Three Fiber ne fournit aucun fichier de licence, si bien que sa ligne de droits d'auteur en amont n'a pas pu être vérifiée sans requête réseau (C159). Le projet n'a toujours rien dépensé : chaque entrée de journal consigne un coût nul, les outils sont gratuits et installés dans l'espace utilisateur, les données et les services du mode en ligne ne nécessitent aucune clé, et le modèle s'exécute localement (C160). Deux points restent entre les mains de l'auteur : l'établissement des droits sur le logotype avant toute publication, et une vérification manuelle de la page d'utilisation des données propre à ClinVar, qui bloque l'accès scripté.

**Le document des limites.** Les limites de la phase ont été rassemblées dans un document unique, par domaine, chacune avec ce qu'elle signifie pour un visiteur, ses preuves et son état ; la section 10 le résume. La liste propre à l'application a gagné deux lignes. La ligne sur l'IA énonce désormais la limite de 500 caractères sur les questions, que le champ applique sinon sans un mot. Une dernière ligne indique que les faits affichés ont été vérifiés par des scripts et un audit assisté par l'IA, sans expert indépendant du domaine, et qu'aucun test d'utilisabilité avec de vrais utilisateurs n'a été mené. Les deux lignes ajoutent 99 octets à la page au repos, qui reste 25,482 octets sous son budget [C161]. Chaque texte affiché, désormais au nombre de 9,219, se rattache encore à un champ d'enregistrement ou à un élément de code nommé sans aucune discordance, et l'analyse d'accessibilité ne relève toujours aucune violation [C162]. Sur les seize points reportés dans la phase, douze sont corrigés, au moins dans la partie que l'auteur a décidée, et deux sont acceptés comme limites par une décision (l'image longue rare et le bilan du filtre des affirmations). Les deux autres sont consignés comme limites ainsi que le plan le proposait, sans décision explicite de l'auteur : un variant dbSNP pour un gène récupéré en ligne, et la dénomination et la recherche des participants d'une voie, dont les deux autres parties ont été corrigées [C163]. Après les réponses de l'auteur sur les licences (D-H040), le texte de licence de React Three Fiber dans les mentions provient de son dépôt à la version intégrée, récupéré une seule fois [C164].

**Les réponses de l'auteur sur les limites (D-H041).** L'auteur a confirmé comme limites les deux derniers points reportés : un visiteur ne peut pas nommer un variant dbSNP pour un gène récupéré en ligne, et un partenaire d'une voie conserve le nom que sa base de données a déposé, sans recherche dans les longues listes de participants. Chaque point reporté a désormais une décision [C165]. Une ligne de la liste des limites de l'application qui était livrée mais jamais affichée, une ancienne phrase relative à un seul gène, a été supprimée après qu'un test a figé le fait que chaque ligne livrée est affichée ; le code est plus petit de 171 octets et la page au repos de 26 octets une fois compressée, chaque texte affiché restant rattaché à sa source et sans aucune violation d'accessibilité [C166]. Les entrées consignées propres au jeu HBB sont désormais publiques, si bien qu'il se reconstruit hors ligne aux mêmes valeurs que le jeu versionné. Ses empreintes de provenance ne concordent pas toutes : quatre réponses qu'il cite portent des identifiants de bases de données propriétaires et ne peuvent être publiées qu'expurgées, et une réponse d'Ensembl n'est consignée nulle part [C167]. L'auteur a autorisé deux requêtes gratuites à Ensembl pour les deux réponses manquantes. Les deux ont reçu une réponse, mais Ensembl ordonne les champs de ses réponses différemment à chaque fois, si bien qu'aucune n'avait les octets consignés ; l'une a été retrouvée en réordonnant une copie publique, et l'autre a été perdue lorsque l'exécution d'enregistrement s'est arrêtée avant l'écriture [C168]. Les données curées n'ont pas été modifiées. L'auteur a accepté les différences d'empreintes restantes comme une limite énoncée plutôt que de reconstruire HBB par l'enregistreur (D-H042) : les valeurs sont reconstructibles, les empreintes ne le sont pas.

**L'inspection d'utilisabilité (P11.2.2).** En l'absence de participants disponibles (D-H031), l'utilisabilité a été inspectée par l'IA plutôt que testée avec des personnes : une inspection par l'IA (Claude Opus 5.5), et non un test utilisateur. L'inspection a appliqué deux méthodes standard à la version candidate, ouverte telle qu'un visiteur public la voit, les règles répondant à chaque question. Une évaluation heuristique a appliqué les dix heuristiques de Nielsen à 64 états d'écran : chaque monde des cinq gènes curés, un gène récupéré en ligne à partir de réponses enregistrées, la page sans 3D, la page étroite, la largeur prise en charge la plus étroite, le mouvement réduit et la basse consommation. Un parcours cognitif a suivi huit tâches de l'ancien script de session en 30 étapes ; la neuvième, le questionnaire, a été abandonnée, puisqu'un questionnaire rempli par celui qui a construit l'application ne serait qu'une opinion présentée comme une mesure auprès d'utilisateurs. L'inspection a relevé 28 problèmes, dont aucun n'a été classé comme catastrophique : 3 majeurs, 14 mineurs et 11 cosmétiques [C169]. La tâche la plus faible est le changement de gène. Une fois l'accueil fermé, rien sur la page ne permet de choisir un autre gène, et en demander un dans le champ de question donne un faux refus : il indique que CFTR n'est pas curé et « only HBB is » (seul HBB l'est), alors que CFTR est l'un des cinq jeux. Cette phrase a passé l'audit scientifique parce qu'elle a une source nommée, les règles ; l'audit vérifie qu'une phrase a une source, et non que l'énoncé d'une règle sur la version est vrai [C170]. Le troisième problème majeur se situe à la largeur prise en charge la plus étroite, où la légende de la structure recouvre le résidu dont parle la réponse. Les problèmes moins importants comprennent un écran de démarrage dont le logo déborde de la fenêtre, le focus clavier perdu à la fermeture de l'accueil (le sélecteur de monde est alors à 31 appuis de touche), des numéros de référence qui ne sont pas des liens, et une marque « AI » (IA) sur des suggestions rédigées par les règles [C171]. Chaque constat a une disposition proposée pour l'auteur : 8 à corriger dans cette phase, 10 pour la phase 12 et 10 à consigner comme limites. Rien n'a été modifié lors de cette passe. Comme l'inspecteur a aussi construit l'application, les problèmes qu'un nouveau venu rencontrerait en premier sont ceux qu'il est le moins à même de voir, si bien que ces 28 constituent une borne inférieure, et rien ici ne montre que de vraies personnes peuvent utiliser l'application.

**Les réponses de l'auteur sur l'utilisabilité (D-H043).** L'auteur a retenu chaque réponse recommandée, et les huit problèmes proposés pour cette phase ont été corrigés, chacun d'abord figé par un test qui échouait sur l'application livrée. Le faux refus indique désormais à un visiteur qui demande un autre gène curé qu'il s'agit de l'un des jeux de cette version et comment l'ouvrir, et un gène hors de la version reçoit la phrase qu'il recevait auparavant. Il s'agit d'une nouvelle version des règles, si bien que les deux jeux de questions figés ont été notés de nouveau : chaque score et chaque réponse sont identiques à ceux d'avant, puisqu'aucune de leurs questions ne nomme un autre gène de la version [C172]. Un lien « Choose another gene » (choisir un autre gène) se trouve désormais à côté du symbole du gène et rouvre l'accueil. À la largeur prise en charge la plus étroite, la légende de la structure n'affiche que sa première ligne jusqu'à ce qu'un bouton l'ouvre, si bien qu'elle ne recouvre plus le résidu dont parle la réponse. Le logo de l'écran de démarrage est dessiné à sa taille prévue, le focus clavier va au sélecteur de monde lorsque l'accueil est ignoré, les suggestions rédigées par les règles ne portent plus de marque « AI », l'indication du champ de gène ne ressemble plus à une valeur, et un nom de maladie qui y est tapé obtient la liste des gènes curés [C173]. Ensemble, les corrections ajoutent 728 octets à la page au repos, qui reste 24,780 octets sous son budget, et chaque texte affiché se rattache encore à sa source, sans défaut d'accessibilité ni de mise en page [C174]. Le registre spécialisé des explications est voulu pour ce projet et est énoncé comme une limite ; un glossaire est envisagé pour la phase 12. Les dix problèmes prévus pour la phase 12 et les dix autres limites demeurent tels que relevés.

**Les suites données par l'auteur sur les règles (D-H044).** Les règles ne reconnaissaient un nom de gène qu'à partir d'une courte liste de gènes bien connus et d'un motif de lettres et de chiffres, auxquels deux des gènes propres à la version ne correspondent pas : interrogées avec « Show SLC6A3 » sur le jeu HBB, elles donnaient la réponse générique selon laquelle la demande n'est pas prise en charge, et interrogées avec « Show HBB » sur le jeu CFTR, elles ouvraient la protéine de CFTR. Les règles reconnaissent désormais aussi les symboles des jeux curés de la version, si bien qu'un autre gène curé reçoit toujours la phrase qui le nomme comme l'un des jeux de la version ; le symbole du gène ouvert n'est jamais refusé, et un gène hors de la version conserve la phrase que l'auteur a choisi de conserver. La reconnaissance est limitée à ces symboles, en majuscules comme le motif existant : un symbole tapé en minuscules ou le nom complet d'un gène n'est pas reconnu comme un autre jeu, une limite que l'auteur a prévue pour la phase 12 (D-H045). Pour une entrée, la réponse elle-même change, et pas seulement sa formulation : « Show HBB » sur le jeu CFTR ouvrait auparavant la protéine de CFTR et est désormais refusé avec cette phrase ; aucune question figée n'est de ce type. Les deux jeux de questions figés ont été notés de nouveau sous cette nouvelle version des règles : chaque score et chaque réponse sont identiques, puisque chaque symbole qu'ils nomment est celui du jeu sur lequel la question est posée [C175]. La modification ajoute 18 octets à la page au repos, et chaque texte affiché se rattache encore à sa source, sans défaut d'accessibilité [C176].

**L'enveloppe de bureau et son IA locale (P11.5.1, P11.5.2).** L'application de bureau enveloppe la même construction web dans une fenêtre macOS native réalisée avec Tauri ; les fichiers qu'elle sert sont identiques à ceux de la construction web, et aucun fichier web n'a changé. Un point d'accroche que l'application portait déjà lui indique qu'elle s'exécute sur le bureau, si bien qu'elle propose l'Ollama propre à l'utilisateur à côté des règles. L'application ne peut atteindre que trois adresses de ce serveur local ; toute autre adresse, un autre port et toute navigation hors de l'application ont été refusés lorsqu'ils ont été tentés. L'automatisation de navigateur de Tauri ne prend pas en charge macOS, si bien qu'un script à l'intérieur de l'application joue le rôle du visiteur et rend compte. Chaque requête de la fenêtre est passée par un mandataire local qui l'a refusée et consignée. Sur le parcours curé de HBB, de l'accueil à travers les cinq chapitres, les deux mondes 3D et les preuves, aucune requête n'a quitté la fenêtre, à l'exception d'un contrôle délibéré, qui a été bloqué ; l'application elle-même n'a atteint que le modèle local [C177]. La scène d'ADN et Mol* sont rendus dans la vue web de macOS comme dans Chrome : les rendus concordent à quelques niveaux de luminosité près, à l'exception du texte de l'étiquette de résidu de Mol* [C178]. Avec Ollama en fonctionnement, le modèle local a transformé une question en une action exécutée. Avec le modèle rendu injoignable, les règles ont répondu, et la carte d'état a indiqué pourquoi ainsi que comment installer Ollama et récupérer le modèle ; l'application ne télécharge jamais elle-même de modèle [C179]. L'audit des dépendances Rust de la version de bureau n'a relevé aucune vulnérabilité connue. Les images, la mémoire et le paquet sont les tâches suivantes ; les temps de lancement mesurés ne sont pas encore des budgets.

**Assurance qualité de la version de bureau et paquet (P11.5.3, P11.5.4).** Les liens vers les sources de données citées s'ouvrent désormais dans le navigateur du système : l'application ne remet un lien au navigateur que lorsqu'il s'agit d'une adresse sécurisée sur l'un des dix sites que citent ses enregistrements, une liste qu'un test dérive des enregistrements eux-mêmes ; toute autre adresse a été refusée, et la page elle-même n'a aucun moyen de demander un navigateur [C180]. Les règles de sécurité ont été vérifiées dans l'application en fonctionnement : un script provenant d'ailleurs, un script écrit dans la page, du code construit à partir de texte, une image extérieure, un cadre extérieur et une requête vers un site non répertorié ont chacun été refusés, et aucun n'a atteint le réseau [C181]. Le même scénario de performance que sur le web a été exécuté dans la vue web de macOS, sur une machine qui n'était pas au repos. La vue web conserve la fréquence de l'écran, mais son horloge compte des millisecondes entières, si bien que la règle de la médiane du web (16.8 ms) ne peut pas y être tenue telle qu'elle est écrite ; la première image d'un mouvement de caméra a pris 36 à 64 ms, là où Chrome est resté sous 33.4 ms lors de sa réexécution. Après le démarrage, la scène a été dessinée environ 0.4 s plus longtemps que dans Chrome, pour une raison encore non trouvée. L'application a atteint son accueil en environ 0.5 s à partir d'un démarrage à chaud et en environ 0.9 à 1.2 s lors du premier lancement après une construction ; après six allers-retours entre les mondes, elle utilisait environ 454 MB, contre environ 1 GB pour Chrome [C182]. Des budgets de bureau sont proposés à l'auteur, non convenus. L'application est empaquetée sous forme d'image disque avec une note d'installation et chaque texte de licence. Les vérifications de signature réussissent ; avec la marque que laisse un téléchargement, la vérification propre à macOS rejette la copie parce qu'elle n'est pas notarisée, ce que la note explique. Le lancement depuis un compte utilisateur neuf est laissé à l'auteur [C183]. Les quinze paquets Rust qui ne publient aucun fichier de licence portent désormais leurs textes en amont, et les cinq relevant de la Mozilla Public License sont nommés avec l'endroit où se trouve leur source [C184]. La ligne de limites propre à l'application indique désormais ce qu'a montré l'exécution sur le bureau, pour un coût de 73 octets [C185]. L'auteur a ensuite convenu des budgets de bureau (D-H047). Sur l'horloge d'images de la vue web, la médiane peut atteindre 17 ms ; une image de plus de 33.4 ms n'est permise que comme première image d'un mouvement, jusqu'à 70 ms ; aucune image ne peut être dessinée après un mouvement ni dans Protein World. Le dessin supplémentaire après le démarrage et la longue première image de la visite sont laissés à la phase 12. Le lancement, la mémoire, les changements de monde et les tailles de paquet ont reçu des plafonds fixes. La première exécution jugée par rapport à eux les a tous tenus, sans réexécution, bien que la première image de la visite soit arrivée à 3 ms de son plafond [C186]. L'auteur a aussi accepté comme limite la connexion anticipée à l'hôte d'un lien cliqué, et a choisi de ne pas effectuer le lancement depuis un compte neuf.

**La revue de passage (P11.4.1).** La revue de passage a exécuté toute la suite convenue et chaque budget depuis un seul script sur une seule construction de référence, en lisant chaque vérification par son code de sortie. La première exécution complète a trouvé une régression qu'aucune vérification fonctionnelle ni d'accessibilité n'avait détectée. Avec le processeur ralenti six fois, les gestes de glisser et de molette, qui commencent 20 s ou plus après l'ouverture de la page, ont produit cinq images de plus de 33.4 ms sur trois pages, là où le budget en permet une. Alternés avec la construction précédente, les comptes ont été de 5, 4 et 6 contre 0, 0 et 0 : la charge de la machine ne les expliquait donc pas. Une bissection a désigné la correction d'utilisabilité qui déplace le focus clavier lorsque l'accueil est passé. Des constructions variantes ont ensuite séparé ses deux parties. Le déplacement du focus était sans effet : la cause était le rendu synchrone forcé qui fermait l'accueil avant que le focus ne se déplace. L'auteur a choisi de le corriger et de relancer la revue (D-H049). Le rendu étant laissé à React et le focus déplacé à l'image suivante, les gestes ralentis n'ont montré aucune image longue, et le comportement au clavier est inchangé [C189]. Pourquoi ce rendu alourdit des gestes survenant 20 s plus tard n'est pas établi. Sur la construction corrigée, chaque vérification est sortie avec 0, sauf celles qui étaient attendues. Les jeux de gènes reconstruits ne diffèrent des jeux validés que par les champs du générateur et, pour HBB, par les empreintes de provenance déjà acceptées (D-H042). macOS rejette une copie mise en quarantaine de l'image disque parce qu'elle n'est pas notariée. 643 tests de l'application et 564 tests de la recherche ont réussi. Chaque texte affiché correspond toujours à sa source, et aucun écran ne présente de violation axe [C187]. Chaque budget a été respecté sans relance automatique, mais deux marges restent minces. La médiane des images du geste le plus lourd a été de 16.8, 16.7 et 16.8 ms pour 16.8 ms. La page au repos pèse 1,975,305 octets, soit 24,695 de moins que son budget. Sur le bureau, la plus longue première image d'un geste a pris 57 ms pour 70 [C188]. Exécutée une fois sur la même construction, la récupération en direct a obtenu, construit et affiché PTEN depuis les services publics en 17.1 s, et les quatre tests en direct de la bibliothèque ont réussi [C190]. Firefox et Safari ont redonné leurs résultats antérieurs, à une exception près : une vérification de la caméra dans Firefox, réussie une fois auparavant, a échoué dans 5 exécutions sur 8, et la construction sur laquelle ces navigateurs avaient d'abord été testés échoue aussi souvent ; le défaut est donc antérieur aux changements de cette phase, et sa cause n'est pas établie [C191]. Le document des limites est définitif sur cette construction. Le verdict appartient à l'auteur.

**Jalon :** rapport figé, source de l'article.

### 9.9 Vitrine de portfolio et lancement (phase 12)

**Le plan et l'hébergeur.** La phase s'est ouverte sur la décision de l'auteur (D-H050) avec un plan dont les critères de fin placent la publication en dernier : tout est construit et vérifié localement, et l'auteur décide à la revue de passage si la démonstration devient publique. L'auteur a retenu chaque recommandation (D-H051) : le code source du produit reste privé, l'étude de cas et l'enregistrement vont dans le dépôt de recherche public, dix petits constats d'utilisabilité sont corrigés, et la version publiée est la 1.0.0. Parmi les hébergeurs statiques gratuits examinés au regard de la revue de sécurité, trois ne peuvent envoyer aucun en-tête de politique, dont cette application a besoin, puisque la politique sous forme d'élément de page dépasserait le budget de taille. L'auteur a choisi Cloudflare (D-H052).

**La construction de publication (P12.1.1).** La construction de publication exclut les prototypes de concept et leurs polices, comme l'exigeait la décision sur les licences, et sa page au repos transfère 1,970,226 octets, soit 5,079 de moins qu'à la revue de passage de la phase 11, ou 1,786,664 avec brotli. La sonde de fonctionnalité de zod étant désactivée, la politique servie ne signale plus rien de la part de l'application [C192]. Un seul fichier d'en-têtes généré, au format de Cloudflare, porte chaque en-tête qu'exige la revue de sécurité. Sur un serveur local qui applique les règles d'en-têtes de Cloudflare, la vérification de l'hébergement a satisfait chaque exigence pouvant tenir sur une adresse locale, alors qu'un serveur n'envoyant aucun en-tête en a manqué onze ; le produit sans modèle y a aussi réussi [C193]. Ce que Cloudflare envoie lui-même ne peut être montré que sur une adresse réelle.

**Noms de gènes (règles, version 7).** Les règles reconnaissent désormais un autre gène curé saisi en minuscules, sous un alias ou par son nom complet, chaque terme étant lu dans les enregistrements de gènes de la construction, jamais dans une liste écrite à la main. Les deux jeux de référence figés obtiennent exactement les mêmes scores qu'avant, unité par unité : le changement ne touche donc que des questions extérieures à ces jeux [C194]. Un ancien symbole comme DAT1, ou un nom de protéine comme « dopamine transporter » (transporteur de la dopamine), n'est toujours pas reconnu : aucun des deux ne figure dans les enregistrements.

---

## 10. Limites et menaces à la validité

Le document des limites de la phase 11 (helix-app `docs/known-limitations.md`) constitue la liste complète des limites, chacune avec ce qu'elle signifie pour un visiteur, ses preuves et son état. L'application montre à un visiteur les lignes qui s'appliquent à ce qu'il voit [C161, C162]. La présente section le résume. Un domaine reste en attente : la version de bureau (P11.5).

**Périmètre.**
- Cinq gènes curés, chacun avec au plus un variant curé et une structure expérimentale. Chaque vérification scientifique n'est démontrée que pour ces jeux. Le décalage de numérotation d'une position et la coïncidence label/auth sont des propriétés de 2HBS, et non des règles générales (sections 4.3, 4.4) ; sur SLC6A3, l'affichage propre à la visionneuse moléculaire présente d'abord la numérotation label, à côté de la numérotation auteur de Helix, un point laissé à l'auteur (P11-S-04).
- Un gène hors des cinq peut être construit en ligne dans le navigateur du visiteur, sans curation, et s'arrête au transcrit, aux séquences et à l'enregistrement de la protéine ; un visiteur ne peut pas nommer de variant dbSNP pour celui-ci, une limite que l'auteur a acceptée (D-H041) [C165].
- Dans Pathway World, un partenaire est nommé par la description que sa base de données a déposée, et une longue liste de participants n'a pas de recherche ; l'auteur a accepté les deux comme limites (D-H041) [C165].
- L'analyse des contacts de Val6 est limitée à l'unité asymétrique, avec un seuil unique. Son interprétation comme contact latéral de la fibre est une inférence (section 4.5) [C10].
- Helix est non clinique. L'appartenance aux voies et les associations à des maladies sont des annotations de bases de données, jamais des mécanismes ni des causes.

**Temps et données.**
- Les enregistrements sont présentés comme un instantané, avec leurs dates de récupération et leurs versions. Les classifications ClinVar, les caractéristiques UniProt et les versions des transcrits Ensembl peuvent changer. La construction consigne la dérive au lieu d'échouer, mais une future version pourrait tout de même modifier une valeur affichée.
- La transition de la plateforme Ensembl rend incertain l'avenir de l'API REST (section 3.1).
- Le jeu HBB peut être reconstruit à partir des entrées consignées publiques aux mêmes valeurs, mais pas octet pour octet : 14 empreintes de provenance de cinq sources diffèrent, parce que quatre réponses qu'il cite doivent être publiées expurgées et qu'une réponse d'Ensembl n'a été consignée nulle part (P11-S-01 ; acceptée par l'auteur comme limite, D-H042) [C167, C168]. Chaque champ d'enregistrement affiché concorde encore avec sa réponse brute en amont [C144].

**Mesure.**
- Chaque budget est mesuré sur un seul ordinateur portable rapide (Apple M1 Pro), dans Chrome sans interface sur localhost. Les performances de Firefox et de Safari n'ont pas été mesurées ; celles de la vue web de bureau l'ont été, et sont jugées selon une lecture de bureau de la règle d'image convenue par l'auteur, parce que son horloge compte des millisecondes entières (section 9.8) [C182, C186]. Des machines plus lentes ont été émulées en ralentissant le processeur et par rendu logiciel, et non testées sur de vrais appareils [C131, C135].
- Les chiffres sont des intervalles entre images sur le fil principal, et non des minuteries GPU ; avec la vsync activée, ils montrent seulement qu'aucune image n'a été manquée. La mémoire GPU est comptée en ressources, et non mesurée en octets.
- Le budget d'image n'a aucune marge sur cette machine : la même version donne 16.8 ms, la limite, sur une machine au repos et 17.0 ms sur une machine chargée, et la version antérieure aux modifications de D-H039 l'a aussi manqué [C140, C155].
- Une image longue isolée apparaît sur quelques pages et une image au repos est apparue une fois ; aucun des deux déclencheurs n'est expliqué [C19, C48, C56, C123, C128].
- Sur un processeur plus lent, un clic qui lance un mouvement de caméra peut retenir la scène pendant une image longue, qu'aucun niveau de rendu ne supprime [C132, C135].
- Lors de la revue de passage, un rendu synchrone forcé au moment de « Skip » (passer) alourdissait, sous un processeur ralenti, des mouvements lancés 20 s plus tard ; le retirer a supprimé l'effet, mais le mécanisme n'est pas établi, si bien qu'un changement semblable ailleurs pourrait passer inaperçu hors des parcours que pilote la suite des niveaux [C189].
- CORS a été mesuré hors d'un navigateur, une fois par source, et non sur des réponses d'erreur [C12].

**Navigateurs et accessibilité.**
- Firefox a exécuté chaque suite plus ancienne, sauf deux qui nécessitent le protocole propre à Chrome ou échouaient de façon intermittente, et Safari n'en a exécuté qu'une partie ; les échecs dans Safari des suites de caméra et de son (le zoom à la molette, le réglage du son mémorisé) et l'échec intermittent dans Firefox ne sont pas expliqués [C139].
- L'accessibilité a été vérifiée uniquement par script, sans écoute d'un lecteur d'écran (D-H032) [C138, C141]. Le contraste du texte sur la scène 3D ne peut pas être calculé par l'outil de vérification et a été examiné sur des captures d'écran par l'IA uniquement.
- Les mondes 3D nécessitent une fenêtre d'au moins 1,024 pixels de large ; les téléphones et les tablettes reçoivent une page de lecture sans 3D et sans questions [C122].

**IA.**
- Une page web publique n'a pas de modèle de langage : les règles répondent à un ensemble limité de questions [C130]. Une question est limitée à 500 caractères [C152].
- Sur une page de développement, et plus tard sur la version de bureau, un modèle local choisit les actions. Sa précision sur le jeu réservé est rapportée à la section 9.7 [C115, C116], et il met plusieurs secondes à planifier ; le visiteur ne lit jamais sa formulation. Le filtre des affirmations n'a détecté aucune nouvelle violation sur les textes du jeu réservé (D-H026), et les prompts utilisent encore des noms de HBB comme exemples d'aiguillage (D-H029).
- L'expérience de bureau de la phase 1 a effectué un seul appel à un seul modèle, et son prompt n'a pas été conservé mot pour mot [C23]. La phase 3 a mesuré la fréquence de telles erreurs sur un petit banc d'essai portant sur un seul gène ; ses propres limites figurent à la section 8.8.

**Sécurité et licences.**
- Aucune Content Security Policy n'est servie tant qu'un hébergeur n'existe pas ; elle est rédigée et testée, et doit être envoyée comme en-tête de réponse [C148]. L'intégrité face à un hébergeur hostile repose sur HTTPS, et les commutateurs de développement `?dev` et `?diagnostics` fonctionnent sur n'importe quel hébergeur. La revue a été automatisée et exécutée par l'IA, sans test d'intrusion.
- La page d'utilisation des données propre à ClinVar n'a pas pu être lue par un script, et les droits sur le logotype fourni par l'auteur ne sont pas encore établis ; il revient à l'auteur de régler les deux avant toute publication [C158].

**Distribution de la version de bureau.** La version de bureau de la phase 11 est empaquetée mais non distribuée :
- La version n'est pas notarisée ; avec la marque de quarantaine que pose un téléchargement, la vérification propre à macOS la rejette, et un utilisateur doit l'ouvrir manuellement comme l'explique la note d'installation [C183].
- Le lancement depuis un compte utilisateur neuf n'a pas été effectué, et aucun test n'a fait réellement ouvrir un lien dans le navigateur ; les deux restent non testés (D-H047).
- Lorsqu'un lien est cliqué, la vue web ouvre une connexion vers ce site avant que le navigateur ne prenne le relais ; aucune requête n'est envoyée (acceptée, D-H047).
- La version est limitée à arm64 et a été testée sur un seul Mac.
- La première image d'un mouvement de caméra peut prendre jusqu'à environ 0.07 s dans la vue web, près du plafond convenu, et la scène est dessinée un peu plus longtemps après le démarrage que dans Chrome ; les deux sont des points de la phase 12 [C182, C186].

**Processus.**
- Les entrées de journal des phases 0 à 2 sont rétrospectives, rédigées le même jour à partir des preuves consignées ; elles n'ont pas été rédigées pendant les exécutions.
- Plusieurs champs sont consignés comme « not recorded » (non consigné) : les durées, l'empreinte exacte du modèle Ollama, le prompt exact.
- Le manifeste du jeu de données de la phase 2 désignait son commit générateur par une empreinte antérieure à la réécriture d'historique du 2026-11-01 (équivalent sur la branche publique : 3b89a9a). La reconstruction de la phase 6 consigne 4b30c60, qui figure sur la branche publique (section 9.3).
- Le travail a été mené avec une assistance substantielle de l'IA (chapitre 12). L'auto-vérification par l'IA ne constitue pas une revue indépendante. Aucune revue externe des affirmations scientifiques n'a eu lieu et aucune n'est prévue : chaque affirmation a été vérifiée par rapport à ses enregistrements uniquement par un audit assisté par l'IA, sans expert indépendant du domaine (D-H031) [C143, C154]. De même, aucune session d'utilisabilité avec de vrais utilisateurs n'a été menée et aucun score de questionnaire n'existe. L'utilisabilité a été inspectée par l'IA uniquement, au moyen d'une évaluation heuristique et d'un parcours cognitif ; cela ne constitue pas un test utilisateur. Comme l'inspecteur a aussi construit l'application, ses 28 constats constituent une borne inférieure [C169, C170, C171]. L'auteur les a tranchés (D-H043) : huit ont été corrigés, dix sont prévus pour la phase 12, et dix demeurent comme limites, parmi lesquelles le registre spécialisé des explications, rédigé pour un lecteur ayant une formation en biologie, sans glossaire pour l'instant [C172, C173].
- Sur les seize points reportés dans la phase 11, douze sont corrigés et quatre sont acceptés comme limites par une décision de l'auteur ; les deux derniers ont été confirmés par D-H041 [C163, C165].

**Nouveauté.** La différenciation de la section 3.5 est une inférence tirée des sources lues, et non un bénéfice mesuré pour les utilisateurs. Savoir si un parcours continu entre les échelles aide la compréhension nécessite une étude auprès d'utilisateurs, qui n'est pas encore planifiée.

---

## 11. Éthique, licences, vie privée et coût

**Usage non clinique.** Helix n'interprète pas les variants pour des personnes. Il refuse les demandes d'avis médical (testé lors de la phase 3) et rapporte les enregistrements cliniques en tant qu'enregistrements.

**Licences des données et attribution.**
- Chaque source utilisée autorise la redistribution des champs que Helix conserve, sous des conditions consignées dans `docs/data-source-registry.md` et `docs/license-attribution-cost-audit.md` :
  - attribution pour UniProt, AlphaFold DB et Gene Ontology ;
  - l'avertissement du NCBI ;
  - l'avertissement intégré aux fichiers AlphaFold, conservé intact.
- Les identifiants de ressources propriétaires (OMIM, HGMD) sont retirés et bloqués par la construction [C03].
- Un résumé Europe PMC utilisé pour vérifier une citation n'est pas stocké, car le texte des résumés relève du droit d'auteur de l'éditeur.

**Licences du code.**
- Le dépôt de recherche est à code source consultable pour la recherche non commerciale, avec un accord de licence de contributeur. Son tout premier commit a été publié sous MIT et cette licence n'est pas révoquée (`LICENSE_HISTORY.md`).
- Le dépôt produit est propriétaire.

**Incident de confidentialité.**
- Le 2026-11-01, un agent de recherche a transmis une adresse électronique comme paramètre `email` du NCBI, et cette adresse est entrée dans les manifestes publics de données brutes.
- Elle a été expurgée et, avec l'approbation de l'auteur, l'historique public concerné a été réécrit.
- D'anciens commits peuvent rester accessibles sur le service d'hébergement par leur empreinte jusqu'à ce que celui-ci les supprime lors de son nettoyage.
- La règle depuis lors : aucune adresse électronique ni aucun identifiant personnel dans une requête, une URL, un en-tête ou un fichier versionné. Les adaptateurs de données n'envoient au NCBI qu'un nom `tool`. L'incident est rapporté ici parce qu'il constitue une défaillance du processus, et pas seulement d'un script (`journal/2026-11-01-raw-snapshot.md`).

**Coût.** Au 2026-11-01, Helix a dépensé $0 [C02] : aucune API payante, aucune clé, aucune donnée, aucune police, aucun modèle ni aucun hébergement payants. Les API publiques gratuites et l'inférence dans le navigateur coûtent néanmoins aux utilisateurs finaux de la bande passante et des ressources de leur appareil ; ce coût est divulgué, sans être compté comme une dépense du projet. La notarisation nécessiterait un compte Apple Developer payant, ce qui relève de la décision de l'auteur.

**Chaîne d'approvisionnement.**
- Les dépendances sont figées à une version exacte.
- Elles ont été résolues vers des publications datant d'au moins deux semaines.
- Les outils sont installés en espace utilisateur avec vérification de la somme de contrôle.

---

## 12. Déclaration d'utilisation de l'IA

L'implémentation, l'exécution des expériences, la tenue du journal et la rédaction de ce rapport ont été réalisées avec l'assistance substantielle d'un agent de programmation d'IA (Claude Code, Anthropic), opérant selon la méthodologie à points de contrôle documentée dans le fichier `docs/methodology.md` de l'espace de recherche.

L'auteur a pris ou vérifié chaque décision scientifique, chaque engagement et chaque affirmation, et assume l'entière responsabilité des résultats. Les décisions réservées à l'auteur comprennent :
- les licences des dépôts ;
- le retrait des identifiants propriétaires ;
- l'amendement relatif à l'application de bureau ;
- la réécriture de l'historique après l'incident de confidentialité ;
- chaque publication.

La formulation exacte de cette déclaration suivra les règles de chaque lieu de publication au moment de toute diffusion.

Les modèles d'IA évalués au sein de Helix (chapitre 8) sont des objets d'étude. Ils sont distincts de l'assistant utilisé pour le construire.

---

## 13. Reproduction

Toutes les commandes supposent la chaîne d'outils Node en espace utilisateur (`helix/.tools/node`, Node 22.23.3) et, pour les scripts de la phase 1, l'environnement Python verrouillé (`uv.lock` : Python 3.12.1, Biopython 1.88).

| Quoi | Commande ou emplacement |
|---|---|
| Instantané brut (phase 1) | `scripts/research/fetch_raw.py` ; manifestes dans `research/raw/*/MANIFEST.tsv` |
| Correspondance HbS et contacts (hors ligne) | `scripts/research/inspect_hbs_mapping.py`, `scripts/research/val6_contacts.py` |
| Expériences de rendu | `research/experiments/molstar-embed/`, `molstar-r3f-bridge/` : `npm ci && npm run build`, puis `node scripts/measure.mjs` (et `--uncapped`) |
| Expérience de bureau | `research/experiments/tauri-shell/README.md` (commandes de construction et d'exécution) |
| Jeu de données curé | `scripts/data-preparation/build-hbb.ts` (en ligne, hors ligne depuis le cache, ou à partir des données de test) ; `compare-builds.ts` pour la vérification de régénération |
| Tests | `npm test` ; `npm run test:live` pour les tests de fumée en ligne facultatifs |

---

## 14. Bibliographie

Toutes les URL ont été consultées le 2026-11-01. Les listes de références complètes figurent dans `docs/competitor-analysis.md`, `docs/scientific-research.md` et `docs/data-source-registry.md`. Tous les liens ont été vérifiés le 2026-11-02 avec `scripts/report/check_links.py` (29 liens, 0 en échec ; DOI confirmés auprès de Crossref ; résultats dans `journal/results/link-check-2026-11-02.tsv`). La vérification est relancée juste avant publication.

**Littérature scientifique primaire**

- Harrington, D. J., Adachi, K. et Royer, W. E. (1997). The high resolution crystal structure of deoxyhemoglobin S. *Journal of Molecular Biology*, 272, 398-407. [doi:10.1006/jmbi.1997.1253](https://doi.org/10.1006/jmbi.1997.1253). PubMed [9325099](https://pubmed.ncbi.nlm.nih.gov/9325099/).
- Sehnal, D. et al. (2021). Mol* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures. *Nucleic Acids Research*. [doi:10.1093/nar/gkab314](https://doi.org/10.1093/nar/gkab314).
- Midlik, A. et al. (2025). MolViewSpec: a Mol* extension for describing and sharing molecular visualizations. *Nucleic Acids Research*. [doi:10.1093/nar/gkaf370](https://doi.org/10.1093/nar/gkaf370).
- Slanináková, T. et al. (2026). MolViewStories: Interactive molecular storytelling. *Protein Science*. [doi:10.1002/pro.70540](https://doi.org/10.1002/pro.70540).
- Varadi, M. et al. (2024). AlphaFold Protein Structure Database in 2024. *Nucleic Acids Research*. [doi:10.1093/nar/gkad1011](https://doi.org/10.1093/nar/gkad1011).

**Ressources et enregistrements de données**

- API REST Ensembl, version 116. [rest.ensembl.org](https://rest.ensembl.org/)
- Enregistrement du gène HBB ENSG00000244734. [Requête lookup d'Ensembl](https://rest.ensembl.org/lookup/id/ENSG00000244734?expand=1;mane=1;content-type=application/json)
- UniProt P68871 (HBB_HUMAN), version 2026_03. [uniprot.org/uniprotkb/P68871](https://www.uniprot.org/uniprotkb/P68871/entry)
- Entrée PDB 2HBS. [rcsb.org/structure/2HBS](https://www.rcsb.org/structure/2HBS)
- Correspondance SIFTS au niveau du résidu, PDBe. [ebi.ac.uk/pdbe/docs/sifts](https://www.ebi.ac.uk/pdbe/docs/sifts/)
- ClinVar VCV000015333. [ncbi.nlm.nih.gov/clinvar/variation/15333](https://www.ncbi.nlm.nih.gov/clinvar/variation/15333/)
- Entrée AlphaFold DB AF-P68871-F1. [alphafold.ebi.ac.uk/entry/P68871](https://alphafold.ebi.ac.uk/entry/P68871)
- HGNC, HBB. [genenames.org](https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:4827)

**Normes et conventions**

- Nomenclature HGVS, numérotation. [hgvs-nomenclature.org/stable/background/numbering](https://hgvs-nomenclature.org/stable/background/numbering/)
- Nomenclature HGVS, séquences de référence (recommandation MANE). [hgvs-nomenclature.org/stable/background/refseq](https://hgvs-nomenclature.org/stable/background/refseq/)
- Notation SPDI du NCBI. [ncbi.nlm.nih.gov/variation/notation](https://www.ncbi.nlm.nih.gov/variation/notation/)
- Transcrits canoniques et MANE Select d'Ensembl. [ensembl.org/info/genome/genebuild/canonical.html](https://www.ensembl.org/info/genome/genebuild/canonical.html)

**Outils et travaux connexes**

- Dépôt de Mol* (MIT). [github.com/molstar/molstar](https://github.com/molstar/molstar)
- Documentation de Mol* v5, création d'une instance. [molstar.org/docs/v5/plugin/instance](https://molstar.org/docs/v5/plugin/instance/)
- Mol* `packages/ai`, branche master (non publiée). [github.com/molstar/molstar/tree/master/packages/ai](https://github.com/molstar/molstar/tree/master/packages/ai)
- Spécification de l'agent de visionneuse Mol* Prism, branche master (non publiée). [agent.md](https://github.com/molstar/molstar/blob/master/packages/prism/viewer/_spec/agent.md)
- MolViewStories, Making of MOTM 01. [molstar.org/mol-view-stories](https://molstar.org/mol-view-stories/docs/example-stories/making-of-mom1.html)
- PDB-101 Molecule of the Month: Hemoglobin (mai 2003). [pdb101.rcsb.org/motm/41](https://pdb101.rcsb.org/motm/41)
- NCBI iCn3D. [ncbi.nlm.nih.gov/Structure/icn3d](https://www.ncbi.nlm.nih.gov/Structure/icn3d/icn3d.html)
- Actualités EMBL-EBI, Ensembl 116 released (11 juin 2026). [ebi.ac.uk](https://www.ebi.ac.uk/about/news/updates-from-data-resources/ensembl-116-release/)
- Actualités EMBL-EBI, Ensembl rolls out new website (25 août 2026). [ebi.ac.uk](https://www.ebi.ac.uk/about/news/updates-from-data-resources/ensembl-new-website/)
- Tauri 2. [v2.tauri.app](https://v2.tauri.app/)
- React Three Fiber. [r3f.docs.pmnd.rs](https://r3f.docs.pmnd.rs/)

---

## Annexe A. Carte des phases et index des preuves

| Phase | Chapitre du rapport | Entrées de journal | Statut (2026-11-01) |
|---|---|---|---|
| 0 Dépôt, continuité, environnement | 1.4 | aucune (pas d'expérience) | vérifiée |
| 1 Recherche : science, concurrents, données, rendu, bureau | 2 à 6 | raw-snapshot, hbs-mapping, val6-contacts, cors, molstar-embed, molstar-r3f-bridge, tauri-shell | vérifiée |
| 2 Acquisition des données et noyau de domaine validé | 4, 7 | hbb-dataset-build | vérifiée |
| 3 IA locale et dans le navigateur | 8 | ai-benchmark-ollama, webllm-browser | vérifiée |
| 4 Preuve AI-to-World | 9.1 | ai-to-world-e2e, cancellation, long-frame | vérifiée |
| 5 Moteur de parcours, deux mondes | 9.2 | dna-world-bridge, transitions, modes-rapid, long-frame-reprobe | vérifiée |
| 6 Tranche verticale HBB complète | 9.3 | hbb-rebuild, clinvar-live-smoke, vertical-slice-e2e | construite ; relecture de l'auteur en attente |
| 7 à 12 | 9.4 à 9.9 | à rédiger au fil des exécutions | non commencée |
