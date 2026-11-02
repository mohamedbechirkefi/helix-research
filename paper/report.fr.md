<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Helix : exploration dirigée par l'IA et liée aux preuves, du génome à la structure des protéines

## Rapport technique, copie française de la version maîtresse anglaise

| | |
|---|---|
| Auteur | Mohamed Bechir Kefi |
| Version | Version de travail 0.6, 2026-11-02 |
| Statut | Chapitres 1 à 8, 9.1 à 9.3, 10 et 11 rédigés (phases 0 à 6). Les sections 9.4 à 9.9 sont des sections d'attente comportant uniquement leur titre. |
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

### 9.4 Direction artistique, identité visuelle et système d'expérience utilisateur (phase 7)

Le système visuel et sa justification. À rapporter : les décisions de conception avec les alternatives rejetées, et les contraintes d'accessibilité adoptées.

### 9.5 Monde cinématographique et finition visuelle (phase 8)

La couche cinématographique. À rapporter : les budgets de performance et les mesures, et l'étiquetage des contenus illustratifs.

### 9.6 Personnalisation multi-gènes (phase 9)

La généralisation au-delà de HBB. À rapporter : quels gènes, quelles vérifications se sont généralisées et lesquelles ont échoué, et la mesure de variation entre gènes.

### 9.7 Explorateur d'IA contextuel avancé (phase 10)

La couche d'IA étendue. À rapporter : le banc d'essai étendu (plusieurs gènes, questions de suivi, injection) et un rapport de fiabilité.

### 9.8 Assurance qualité, performance et accessibilité de niveau publication (phase 11)

À rapporter :
- l'audit d'accessibilité ;
- l'audit scientifique de chaque affirmation affichée par rapport à ses enregistrements ;
- la revue de sécurité, de vie privée et de chaîne d'approvisionnement ;
- l'assurance qualité de la version de bureau.

**Jalon :** rapport figé, source de l'article.

### 9.9 Vitrine de portfolio et lancement (phase 12)

La démonstration publique, si l'auteur décide de la publier. À rapporter : ce qui a été publié et où, et les limites éventuellement divulguées.

---

## 10. Limites et menaces à la validité

**Périmètre.**
- Un gène, un variant, une structure expérimentale. Chaque vérification scientifique n'est démontrée que pour cette tranche. Le décalage de numérotation d'une position et la coïncidence label/auth sont des propriétés de 2HBS, et non des règles générales (sections 4.3, 4.4).
- L'analyse des contacts de Val6 est limitée à l'unité asymétrique, avec un seuil unique. Son interprétation comme contact latéral de la fibre est une inférence (section 4.5) [C10].

**Temps.**
- Tous les enregistrements ont été récupérés le même jour. Les classifications ClinVar, la numérotation des caractéristiques dans UniProt et les versions des transcrits Ensembl peuvent changer. La construction consigne la dérive au lieu d'échouer, mais une future version pourrait tout de même modifier une valeur affichée.
- La transition de la plateforme Ensembl rend incertain l'avenir de l'API REST (section 3.1).

**Mesure.**
- Les chiffres de performance proviennent d'exécutions uniques sur un seul ordinateur portable rapide (Apple M1 Pro), dans Chrome sans interface et dans WKWebView.
- Ce sont des intervalles entre images sur le fil principal, et non des minuteries GPU.
- Avec la vsync activée, ils montrent seulement qu'aucune image n'a été manquée.
- Aucun matériel d'entrée de gamme n'a été testé. L'anomalie d'image longue est caractérisée, mais son déclencheur reste inexpliqué [C19, C48, C56].
- CORS a été mesuré hors d'un navigateur, une fois par source, et non sur des réponses d'erreur [C12].

**IA.** L'expérience de bureau de la phase 1 a effectué un seul appel à un seul modèle, et son prompt n'a pas été conservé mot pour mot [C23]. La phase 3 a mesuré la fréquence de telles erreurs sur un petit banc d'essai portant sur un seul gène ; ses propres limites figurent à la section 8.8.

**Distribution de la version de bureau.**
- La version n'est pas notarisée, et Gatekeeper la rejette.
- Le comportement d'une copie téléchargée et placée en quarantaine n'a pas été testé.
- La version est limitée à arm64.

**Processus.**
- Les entrées de journal des phases 0 à 2 sont rétrospectives, rédigées le même jour à partir des preuves consignées ; elles n'ont pas été rédigées pendant les exécutions.
- Plusieurs champs sont consignés comme « not recorded » (non consigné) : les durées, l'empreinte exacte du modèle Ollama, le prompt exact.
- Le manifeste du jeu de données de la phase 2 désignait son commit générateur par une empreinte antérieure à la réécriture d'historique du 2026-11-01 (équivalent sur la branche publique : 3b89a9a). La reconstruction de la phase 6 consigne 4b30c60, qui figure sur la branche publique (section 9.3).
- Le travail a été mené avec une assistance substantielle de l'IA (chapitre 12). L'auto-vérification par l'IA ne constitue pas une revue indépendante ; une revue externe des affirmations scientifiques est prévue pour la phase 11.

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
