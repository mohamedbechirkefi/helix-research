<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Helix : exploration dirigée par l'IA et liée aux preuves, du génome à la structure des protéines

**Mohamed Bechir Kefi**

| | |
|---|---|
| Version | Version 1, 2026-11-15, d'après la version 0.9 du rapport ; non publiée |
| Source | Rapport technique `paper/report.en.md` (version 0.9, figée le 2026-11-15) |
| Licence | Helix Source-Available Non-Commercial Research License v1.0 (voir `LICENSE`) |

**Avertissement non clinique.** Helix est un projet de recherche et d'enseignement. Rien dans cet article ne constitue un diagnostic, une interprétation de variant pour une personne ou un avis médical. Les classifications ClinVar sont rapportées en tant qu'enregistrements, et non en tant que recommandations.

**Comment lire les preuves.** Les identifiants tels que [C08] renvoient aux lignes du registre des affirmations, `paper/claims.md`. Chaque ligne nomme son entrée de journal, son fichier brut et sa limite. L'ensemble des preuves, avec chaque tableau et chaque mesure, figure dans le rapport technique.

---

## Résumé

Expliquer un seul variant génétique à travers les échelles exige de passer d'une ressource publique à une autre, chacune ayant ses propres coordonnées et sa propre numérotation. Les grands modèles de langage invitent à un raccourci, qui consiste à laisser un modèle piloter une visionneuse moléculaire, mais ils produisent des identifiants plausibles et faux. Helix est un environnement interactif construit sur une seule règle : la sortie d'un modèle n'est qu'un plan proposé d'actions typées, un exécuteur déterministe vérifie chaque identifiant par rapport à des enregistrements vérifiés avant que quoi que ce soit ne change à l'écran, et chaque fait affiché porte sa provenance. La première tranche suit HBB et l'allèle de la drépanocytose (HbS) depuis une coordonnée GRCh38 jusqu'à un résidu de l'entrée PDB 2HBS. La construction de cette correspondance a révélé une incohérence de numérotation à l'intérieur du fichier 2HBS et a montré que l'assemblage biologique par défaut ne contient pas le contact de la valine mutante. Un banc d'essai de modèles locaux gratuits utilisés comme planificateurs a montré que la validation détectait chaque identifiant non ancré, tandis qu'un repli déterministe obtenait un meilleur score que chaque modèle sur les éléments réservés. Le travail s'est ensuite étendu à cinq gènes curés et à un mode en direct, a ajouté un explorateur contextuel mesuré sur un jeu réservé figé, et s'est conclu par des vérifications de publication sur une seule construction de référence, une version de bureau avec un modèle local et une construction de publication vérifiée par rapport aux règles de l'hébergeur. Aucune étude auprès d'utilisateurs ni aucune revue par un expert indépendant n'a été menée.

---

## 1 Introduction

### 1.1 Problème

Le changement drépanocytaire se trouve à plusieurs endroits à la fois : une position sur le chromosome 11, un codon dans un transcrit, un acide aminé dans une protéine, et une valine à la surface d'un tétramère d'hémoglobine cristallisé. Les ressources qui contiennent ces faits sont excellentes, mais séparées. Ensembl fournit les génomes et les transcrits, UniProt les protéines, la Protein Data Bank les structures, et ClinVar les assertions cliniques. Chacune utilise son propre système de coordonnées et sa propre convention de numérotation, et passer correctement de l'une à l'autre relève du travail d'expert.

La numérotation est un piège concret. Pour l'entrée PDB 2HBS, la structure la plus souvent utilisée pour montrer l'hémoglobine drépanocytaire, la numérotation du fichier déposé diffère d'une position de la numérotation actuelle d'UniProt [C08].

Les modèles de langage rendent tentant de répondre à une question en langage naturel en laissant un modèle piloter la visionneuse. Lors d'une première expérience de bureau de ce projet, un modèle local sollicité pour planifier une vue de la structure de la drépanocytose a renvoyé un JSON conforme au schéma demandé, mais désignant l'entrée PDB 1BZO au lieu de 2HBS [C23]. La réponse était bien formée et fausse. Il s'agissait d'un seul appel à un seul modèle, et son prompt n'a pas été conservé mot pour mot ; cette observation a motivé la conception, mais ne mesure pas un taux d'erreur.

### 1.2 Règle de conception

Helix traite la sortie d'un modèle comme une proposition non fiable. Un modèle peut interpréter une question, mais il ne peut émettre qu'un plan d'actions typées. Un code déterministe valide chaque identifiant de ce plan par rapport aux enregistrements curés, n'exécute que les plans valides, confirme le résultat en lisant l'état propre du moteur de rendu, et attache une provenance à chaque énoncé affiché. Lorsqu'aucun modèle n'est disponible ou qu'un plan échoue, un planificateur à base de règles répond à sa place.

### 1.3 Contributions

Les contributions, tirées de la liste du rapport (section 1.5), sont les suivantes.

- Une correspondance vérifiée de HbS depuis une coordonnée GRCh38 jusqu'à un résidu de 2HBS, chaque étape étant confirmée par des enregistrements indépendants [C04, C05, C06, C07], et la documentation d'une incohérence de numérotation à l'intérieur du fichier 2HBS qui conduirait un analyseur naïf à mettre en évidence le mauvais résidu [C08].
- La preuve que la vue par défaut de 2HBS dans Mol* ne peut pas montrer le contact latéral de HbS, et l'explication de ce fait [C10, C11].
- Un jeu de données HBB curé et reproductible, construit par du code à partir des sources en ligne, avec 46 vérifications scientifiques qui échouent de manière sûre [C24, C25, C26].
- Un banc d'essai de modèles locaux et dans le navigateur gratuits utilisés comme planificateurs d'actions typées, avec des réponses attendues rédigées avant l'exécution de tout modèle [C31, C33, C34, C35].
- Une chaîne fonctionnelle qui va d'une question à un plan validé puis à un changement dans le monde rendu, relu depuis le moteur de rendu avant d'être rapporté [C42, C45].
- Un constructeur générique qui a produit quatre autres gènes curés, dont un cinquième gène exécuté sans aucune modification du code source de l'application, et un mode en direct pour les gènes sans jeu curé [C94, C104, C105].
- Un explorateur contextuel mesuré sur un jeu réservé figé avant son exécution, selon une politique qui ne montre jamais au visiteur la formulation propre du modèle [C115, C121].
- Une passe de qualité de niveau publication : un audit mécanique qui fait correspondre chaque texte affiché à sa source, des budgets mesurés sur une seule construction de référence, une version de bureau avec un modèle local, et une construction de publication vérifiée par rapport aux règles de l'hébergeur sur un serveur local [C143, C187, C177, C193].

---

## 2 Travaux connexes

**Ressources sur les génomes et les protéines.** Le UCSC Genome Browser et IGV sont des visionneuses à pistes de coordonnées dotées d'API documentées et sans vue de structure protéique. La visionneuse de caractéristiques d'UniProt relie les caractéristiques de séquence à un panneau de structure, et AlphaFold DB relie l'erreur d'alignement prédite à une vue 3D [Varadi et al. 2024]. Ces visionneuses sont reliées entre elles plutôt qu'unifiées à travers les échelles. La plateforme Ensembl est en transition : la version 116 a été annoncée comme la dernière sur les plateformes actuelles, ce qui constitue un risque consigné pour Helix [Ensembl 116 news].

**Visionneuses moléculaires et scènes déclaratives.** Mol* est la visionneuse de structures de RCSB PDB et de PDBe [Sehnal et al. 2021]. MolViewSpec est un format JSON déclaratif et validé pour les scènes moléculaires, implémenté comme extension de Mol* [Midlik et al. 2025]. Helix a constaté que MolViewSpec déclare une vue statique de HbS, mais ne peut exprimer ni l'état de sélection, ni la mise en évidence au survol, ni la représentation de focus, ni les événements [C15] ; il sert aux instantanés et de cible contrainte, tandis que l'interaction passe par l'API impérative. iCn3D synchronise des vues 1D, 2D et 3D et prend en charge des pistes d'annotation ClinVar [iCn3D].

**Narration moléculaire.** MolViewStories fournit déjà des récits moléculaires rédigés, narrés et multi-scènes, construits sur MolViewSpec [Slanináková et al. 2026], et PDB-101 raconte l'histoire de l'hémoglobine et de la drépanocytose avec 2HBS [PDB-101 Hemoglobin]. Helix ne revendique donc aucune nouveauté pour la narration, la mise en évidence de résidus ou les scènes déclaratives [C29].

**Visionneuses pilotées par l'IA.** Le voisin le plus proche se trouve sur la branche master non publiée de Mol* : un cadre d'agent et un agent de visionneuse dotés d'outils typés, d'une fonction d'annulation, de politiques d'approbation et d'un traitement du texte non fiable [Mol* packages/ai; Mol* Prism agent spec]. Il est généraliste. S'il est publié, les actions de Helix au niveau de la structure ressembleront à un sous-ensemble d'une fonctionnalité amont gratuite.

**Positionnement.** L'analyse concurrentielle n'a trouvé aucun voisin qui relie un même plan d'action validé aux coordonnées du génome, de la protéine et de la structure à la fois, avec un enregistrement de provenance par action [C28]. Il s'agit d'une inférence à partir des sources lues le 2026-11-01, et non d'une prétention à l'antériorité ni d'un bénéfice mesuré pour les utilisateurs.

---

## 3 Conception

### 3.1 Plans et validation

Un plan comporte une issue (`plan`, `unsupported` ou `clarify`), une intention, des entités, une liste d'actions, un niveau d'explication, des citations, des questions de suivi et une raison. Chaque objet est strict, si bien qu'un champ inconnu est une erreur. Le modèle ne nomme jamais une chaîne, un numéro de résidu ou un maillage. Il nomme une caractéristique curée, telle que `HbS_substitution`, et un code déterministe la résout. Les seuls identifiants qu'un plan peut utiliser proviennent des enregistrements curés du gène ouvert. Le texte récupéré est joint comme donnée non fiable et ne compte jamais comme ancrage.

La validation s'exécute dans un ordre fixe : analyse JSON, schéma strict, ancrage, capacités, prérequis et cohérence de l'issue [C30]. L'ancrage exige que chaque identifiant figure dans le contexte, y compris les identifiants écrits en texte libre, sauf si l'utilisateur les a saisis. Une vérification des prérequis n'autorise à cibler une caractéristique qu'une fois sa structure chargée dans un assemblage qui la contient.

### 3.2 Exécuteur et relecture

Dans l'application, un Scene Action Interpreter (interpréteur d'actions de scène) vérifie de nouveau chaque plan avant toute exécution : l'époque de session du plan, une seconde validation, et chaque action par rapport à un registre de contrats typés avec capacités, prérequis et vérifications scientifiques. Les cibles ne sont résolues qu'à partir de la correspondance curée des résidus et des enregistrements de contacts. Un plan établi avant que l'utilisateur ne change la sélection est rejeté comme périmé, et une question remplacée pendant l'inférence est abandonnée [C47].

Une mise en évidence ou un focus ne compte comme effectué que lorsque les gestionnaires de sélection et de focus propres à Mol* relisent les résidus résolus. Cette relecture a d'abord été montrée lors d'une expérience de faisabilité, où la page hôte a demandé à Mol* ce qui était sélectionné et a reçu chaîne H, label 6 = auth 6, VAL, entité 2 [C14]. Dans l'application en cours d'exécution, la question de référence « Show me where the sickle-cell mutation affects hemoglobin » (montre-moi où la mutation drépanocytaire affecte l'hémoglobine) a conduit dans 10 exécutions sur 10, avec le planificateur à base de règles et avec ministral-3:8b, à ce que Mol* relise VAL 6 sur les chaînes B, D, F et H de l'unité asymétrique de 2HBS [C42]. Helix vérifie ainsi le résidu à l'écran au lieu de se fier à ses propres variables.

### 3.3 Provenance

L'explication est rédigée par un code déterministe à partir des enregistrements curés. Chaque phrase qui formule une affirmation cite un identifiant de preuve avec sa provenance [C45], et chaque énoncé affiché porte l'une des six classes de preuve, de l'observation expérimentale dans une structure déposée jusqu'à l'inférence. Un modèle AlphaFold prédit est étiqueté comme prédit et n'est jamais utilisé pour placer un variant.

### 3.4 Repli déterministe

Le repli est une liste ordonnée de règles portant sur la requête de l'utilisateur. Il ne lit jamais le texte récupéré, si bien que des instructions injectées ne peuvent pas l'atteindre. Il refuse d'abord les demandes cliniques et les demandes de code, rejette ensuite les identifiants hors du contexte, demande une clarification pour les questions ambiguës, planifie les commandes prises en charge, et répond à tout le reste comme non pris en charge, sans deviner. Ses 69 plans du banc d'essai de la phase 3 ont tous réussi la validation, et ses erreurs sur le jeu réservé étaient sûres : une clarification ou un plan qui en fait moins que demandé [C40].

### 3.5 Un chemin public sans modèle

Une page web publique n'a pas de modèle de langage. Sans modèle, les règles répondent à chaque question prise en charge et à chaque question de pont des cinq jeux curés et les exécutent (30 sur 30), sur un hébergeur statique proche de la production et sur une page de développement où le modèle local est injoignable, et aucune requête n'atteint le modèle [C130]. Le modèle est un planificateur facultatif sur une page de développement et dans la version de bureau. Le visiteur ne lit jamais de texte rédigé par le modèle : l'application rédige une phrase à partir des actions du plan, et les suggestions de suivi du modèle ne sont pas proposées [C121]. Rien de ce que le visiteur saisit ou de ce que renvoient les bases de données n'est transformé en balisage de page ou en code [C147].

---

## 4 La correspondance scientifique et ce qu'elle a détecté

### 4.1 La correspondance

La correspondance de HbS a été calculée et vérifiée à partir d'enregistrements publics récupérés sans clé, sans compte et sans paiement [C01, C02]. Le tableau 1 la résume.

Tableau 1. HbS à travers les couches (tableau 4.2 du rapport).

| Couche | Valeur |
|---|---|
| Gène | HBB, ENSG00000244734.6, GRCh38, brin inverse ; MANE Select ENST00000335295.4 = NM_000518.5 [C04] |
| Allèle | rs334 a les allèles T/A/C/G ; HbS est l'allèle A : NC_000011.10:g.5227002T>A, c.20A>T, p.Glu7Val [C05] |
| Protéine | CDS traduite = UniProt P68871, 147 aa, md5 concordant [C06] |
| Structure | position UniProt 7 = position mature 6 = 2HBS label_seq_id 6 = auth_seq_id 6 (VAL), chaînes bêta B, D, F, H [C07] |

Chaque étape met en jeu un écueil connu. HBB est sur le brin inverse, si bien que le changement est T>A sur le brin direct et A>T sur le brin codant. Un identifiant dbSNP n'est pas un allèle : pour rs334, l'allèle C donne p.Glu7Gly et l'allèle G donne p.Glu7Ala, si bien que Helix associe le variant à l'allèle et à sa description HGVS, jamais à rs334 seul. La méthionine initiatrice est retirée dans la protéine mature, si bien que le « Glu6Val » de la littérature classique et le p.Glu7Val de la nomenclature HGVS désignent le même changement.

La correspondance a été reconstruite sous forme de code dans trois paquets TypeScript qui n'utilisent que des API de la plateforme web, si bien que le même code s'exécute dans un navigateur, dans l'enveloppe de bureau et sous Node [C27]. La construction en ligne du 2026-11-01 a réussi les 46 vérifications ; tout échec d'une vérification de niveau erreur interrompt la construction, et rien n'est écrit [C24]. Deux constructions en ligne consécutives n'ont différé que par les horodatages et les empreintes qui les intègrent [C25].

### 4.2 Une incohérence de numérotation à l'intérieur de 2HBS

Le mmCIF de 2HBS contient sa propre référence à UniProt P68871. Son `_struct_ref_seq` aligne les chaînes bêta sur les positions 1-146, et `_struct_ref_seq_dif` place le variant à la position 6 de P68871. UniProt numérote actuellement ce même glutamate 7. SIFTS, l'enregistrement d'alignement de RCSB et la référence croisée propre à UniProt font tous correspondre les positions UniProt 2-147 aux résidus 1-146. Ils concordent entre eux et divergent du fichier.

Un analyseur qui ferait confiance aux catégories de référence du fichier sélectionnerait le label 7 de la chaîne B, qui est un GLU, et non la VAL mutante [C08]. Helix adopte SIFTS comme correspondance de référence, la contre-vérifie avec son propre alignement global (décalage 1, identité 0.9932, un seul mésappariement, au niveau du variant), et consigne ce que `_struct_ref_seq` aurait sélectionné. Le décalage est une propriété de cette entrée ; Helix le calcule pour chaque entrée et ne le code jamais en dur. La fréquence de telles incohérences parmi les entrées de la PDB n'a pas été mesurée.

### 4.3 L'assemblage par défaut ne montre pas le contact

La publication principale associée à la structure décrit la fibre drépanocytaire comme stabilisée par des contacts latéraux dans lesquels la valine mutante rencontre une poche d'un autre tétramère [Harrington et al. 1997]. Dans l'unité asymétrique déposée (seuil de 4.5 A, sans copies symétriques), seule la valine de la chaîne H est en contact avec une autre chaîne, au niveau des résidus Ala70, Asp73, Thr84, Phe85 et Leu88 de la chaîne B ; les valines des chaînes B, D et F n'ont aucun contact inter-chaînes dans le fichier [C10]. Que le contact de H vers B soit le contact latéral que décrivent les auteurs est une inférence, et non un fait vérifié.

L'assemblage 1 (chaînes A à D), qu'une visionneuse affiche par défaut, ne contient aucun contact de ce type [C11]. La première exécution de rendu a échoué avec « target not found » (cible introuvable) pour cette raison, parce que le préréglage par défaut de Mol* construit l'assemblage 1, qui ne contient pas la chaîne H. Le chargement de l'unité asymétrique a corrigé ce défaut. Helix charge donc l'unité asymétrique pour cette vue et étiquette le contact comme un contact dans le cristal, et non comme une observation dans les cellules. Un réglage par défaut d'apparence anodine aurait montré la mauvaise scène.

---

## 5 Les modèles comme planificateurs

### 5.1 Le banc d'essai de la phase 3

Le banc d'essai principal compte 53 éléments répartis en six catégories : questions prises en charge, paraphrases, questions de suivi sur une sélection, demandes non prises en charge, questions ambiguës et injections, dont sept en français [C31]. Les éléments non pris en charge comprennent des questions médicales et une demande portant sur la mauvaise structure 1BZO ; les éléments d'injection placent des instructions dans le texte récupéré. Les réponses attendues ont été rédigées avant l'exécution de tout modèle. Un jeu réservé distinct de 16 éléments a été rédigé après l'achèvement du repli déterministe et n'a pas servi à le modifier.

Chaque modèle a reçu le même prompt système, le même schéma, le même contexte et le même nombre de tentatives : trois exécutions à la température 0 et une à la température 0.7, sans nouvelle tentative ni réparation. Un modèle simulé qui injectait des défauts connus a été exécuté en premier, et le banc a détecté chaque défaut [C32].

Tableau 2. Taux de plans corrects et valides, température 0 (tableau 8.1 du rapport) [C33, C34].

| Planificateur | Jeu principal (159 sorties) | Identifiants non ancrés (sorties) | Jeu réservé (16 éléments) |
|---|---|---|---|
| Repli déterministe | 100% (sur l'échantillon) | 0 | 75.0% |
| ministral-3:8b | 86.8% | 12 (9) | 56.3% |
| qwen3.5:4b | 57.9% | 20 (17) | 62.5% |
| llama3.1:8b | 47.2% | 6 (3) | 37.5% |
| phi4-mini:3.8b | 34.0% | 27 (18) | non exécuté |

Le score de 100% du repli est obtenu sur l'échantillon : ses règles ont été rédigées en ayant le jeu principal sous les yeux, si bien qu'il montre une couverture, et non une généralisation. Sur le jeu réservé, le classement change, et le meilleur modèle sur le jeu principal perd environ trente points [C34]. Avec 16 éléments, des écarts d'un ou deux éléments relèvent du bruit.

### 5.2 Ce que la validation a détecté

La validation a détecté chaque identifiant non ancré dans chaque exécution [C35] : des numéros d'accès inventés (P68881, P688871), des identifiants rappelés pour des gènes hors du contexte (TP53 et P04637), des identifiants injectés répétés en texte libre (1BZO, 4HHB), et un identifiant de variant inventé. Sous la politique « utiliser le plan du modèle s'il est valide, sinon le plan déterministe », aucun plan non ancré n'aurait atteint la scène. Sur le jeu réservé, cette politique obtient 87.5% avec qwen3.5:4b et 75.0% avec ministral-3:8b. Ses erreurs restantes sont des plans valides mais faux, que la validation ne peut pas détecter.

Restreindre les champs d'identifiant aux identifiants du contexte a supprimé toute violation dans les champs structurés, mais n'a rendu aucun modèle plus correct [C36]. Aucun modèle n'a traité correctement plus de la moitié des sorties d'injection. Dans le navigateur, Qwen3.5-2B via WebLLM a donné 4 plans corrects et valides sur 10 après un téléchargement de 1.08 GB [C38], et a figé la scène Mol* pendant 28.7 s sur le fil principal, contre une pire image de 133 ms dans un Web Worker [C39]. Le planificateur déterministe est devenu le planificateur par défaut partout, avec ministral-3:8b comme modèle de développement et de bureau, derrière la validation et le repli.

### 5.3 Le jeu réservé figé de l'explorateur

La phase 10 a ajouté six actions d'exploration, des questions liées à la sélection courante, et un nouveau prompt rédigé sans accès au banc d'essai [C107, C109]. Le jeu figé comptait 112 unités sur les cinq gènes, chacune planifiée trois fois. Le résultat a été globalement négatif : la politique du modèle s'il est valide a été correcte et valide sur 273 des 336 sorties, le planificateur à base de règles seul sur 276, et le modèle seul sur 252 [C110]. Le modèle a été meilleur sur les six nouvelles actions (96 contre 66 sur 102) et sur les tours de suivi ultérieurs (24 contre 12 sur 30), et moins bon sur les types de questions des phases antérieures, avec notamment 0 sur 15 aux questions d'association. Chaque unité a donné le même verdict lors des trois répétitions : il s'agit donc de comportements systématiques. Le temps médian de planification a été de 14.2 s.

La lecture de chaque explication signalée a montré que la validation vérifie les actions et les identifiants, et non la prose. Plusieurs plans valides du modèle portaient une affirmation interdite, le plus souvent en décrivant une structure de référence comme montrant le variant. Après deux corrections, la seconde issue d'un audit distinct par l'IA, le nombre de sorties sûres s'établit à 291 sur 336 pour le modèle et à 297 pour la politique [C111].

L'auteur a ensuite choisi un partage : le modèle pour les actions de l'explorateur et les tours de suivi ultérieurs, les règles ailleurs [C114]. Son estimation sur l'échantillon ayant été rédigée après la lecture des sorties, ce partage a été mesuré sur un nouveau jeu réservé de 58 unités, figé avec le prompt avant qu'aucun modèle ne le voie. Le partage a répondu correctement à 120 sur 174, contre 96 pour les règles seules, a été au moins aussi sûr (165 contre 162) et a tenu les 18 sorties d'injection [C115]. Laisser le modèle répondre en premier a obtenu un meilleur score, 144, au prix de 3 sorties d'injection et d'un énoncé faux à l'écran. L'estimation sur l'échantillon de 92% pour le partage est tombée à 69% sur les nouvelles lignes. Le filtre des affirmations de l'application appliqué à la prose du modèle n'a pas aidé sur un texte nouveau : ses 7 détections étaient toutes des faux positifs, et il a manqué le seul énoncé faux qui a atteint l'écran [C116].

### 5.4 Ne jamais montrer la formulation du modèle

Ces résultats ont conduit à la politique livrée. Le modèle peut choisir des actions, qui sont validées et exécutées, mais le visiteur ne lit que des phrases que l'application rédige à partir des actions du plan et des enregistrements [C121]. Pendant l'attente du modèle, le visiteur peut appuyer sur « Answer with the rules now » (répondre maintenant avec les règles) ; face au modèle local, la réponse des règles s'est achevée 5.2 à 6.8 s après l'appui [C121]. Cette politique supprime le mode de défaillance de la prose observé plus haut. Elle ne rend pas correct un plan valide mais faux.

---

## 6 Généralisation

### 6.1 Un seul constructeur, cinq gènes

Les sélections de HBB ont été déplacées dans un fichier de spécification de gène lu par un chargeur strict qui rejette toute clé nommant un monde, un chapitre, une caméra ou une couleur. La preuve que HBB est devenu une instance d'un constructeur générique est une comparaison octet par octet : une construction de HBB à partir des données de test, avant et après le changement, ne diffère que par le nom du script du générateur et l'indicateur d'arbre modifié (14 fichiers, 158 différences d'horodatage autorisées) [C94].

Les gènes suivants ont mis le constructeur à l'épreuve de formes nouvelles. Un gène à structure limitée, FAAH2, a été choisi par un parcours avec graine sur les identifiants HGNC avec des filtres mécaniques, plutôt qu'à la main [C95] ; l'application montre son transcrit et explique pourquoi il n'y a pas de Protein World [C96]. CFTR a apporté la première délétion, F508del, et sa structure a été choisie par une règle : 5UAK a été préférée à 6MSM, mieux résolue, parce que 6MSM porte une mutation introduite par ingénierie [C97]. BRCA1 a fait de la couverture un fait de premier plan : sa structure, 1JM7, couvre les résidus 1 à 103 sur 1,863, soit 5.5 % [C101].

### 6.2 Le cinquième gène, sans modification de l'application

SLC6A3 a été conçu comme un test de l'affirmation selon laquelle rien n'est codé en dur par gène. Son jeu devait sortir du constructeur existant sans nouveau type d'enregistrement, et l'application devait l'exécuter sans nouveau code. Les deux conditions ont été tenues [C104]. La règle des variants n'a trouvé aucun enregistrement faux-sens à deux étoiles ou plus, si bien que le repli autorisé a retenu R85W à une étoile, et le jeu le précise. L'exécution a aussi mis au jour deux vérifications du constructeur qui supposaient implicitement la forme de HBB ; les deux ont été généralisées sans changer les résultats des quatre premiers jeux.

### 6.3 Le mode en direct

Un gène reconnu sans jeu curé peut être récupéré en direct dans le navigateur du visiteur, par le même constructeur et le même chargeur, à partir d'Ensembl, de HGNC, d'UniProt et d'AlphaFold DB uniquement, et rien n'est conservé d'une visite à l'autre [C105]. Une exécution en direct sur PTEN a demandé 12 requêtes et 2,938 ms ; lors de la revue de passage de la phase 11, une seule exécution a récupéré, construit et affiché PTEN en 17.1 s [C190]. Il s'agit dans les deux cas d'exécutions uniques face à des services qui évoluent.

### 6.4 Limites de la généralisation

Chaque vérification scientifique n'est démontrée que pour les cinq jeux curés. Un gène en direct s'arrête au transcrit, aux séquences et à l'enregistrement de la protéine, et un visiteur ne peut pas nommer de variant dbSNP pour celui-ci, une limite que l'auteur a acceptée [C165]. Une mesure de variation sur les cinq jeux donne 0.525 sur l'inventaire des scènes et 0.218 sur le vecteur des capacités ; sur le parcours tel qu'il était défini à l'origine, elle donne 1.000 par construction et ne dit rien, et un axe supplémentaire de forme du parcours donne 0.267, quatre jeux partageant une même forme [C106]. La mesure montre que les jeux diffèrent ; elle ne montre pas que les parcours aident quiconque à les comprendre.

---

## 7 Ingénierie de la publication

### 7.1 Un audit mécanique du texte vers la source

Helix n'a pas de relecteur indépendant de sa science ; l'audit des affirmations affichées a donc été rendu aussi mécanique que possible et exécuté par l'IA. Un script a recueilli chaque texte que l'application affiche sur le chemin des règles, soit 9,215 textes distincts provenant de 80 écrans et de 31 questions à trois niveaux de profondeur, et un second script a rattaché chacun au champ d'enregistrement ou à l'élément de code nommé qui le rédige. Aucun n'est resté sans source [C143]. Un troisième script a comparé 159 champs d'enregistrement affichés avec les réponses brutes à partir desquelles ils ont été construits, et rien n'a différé [C144].

L'audit a un angle mort qu'une inspection ultérieure a mis au jour. Interrogées sur CFTR dans le jeu HBB, les règles ont répondu que CFTR n'est pas curé et que « only HBB is » (seul HBB l'est), alors que CFTR est l'un des cinq jeux. La phrase a passé l'audit parce qu'elle a une source nommée ; l'audit vérifie qu'une phrase a une source, et non que l'énoncé d'une règle sur la construction est vrai [C170]. La formulation a été corrigée par la suite, et les deux jeux de questions figés ont obtenu les mêmes scores [C172].

### 7.2 Des budgets sur une construction de référence

Les budgets de performance sont des données lues par un banc de mesure. Lors de la revue de passage de la phase 11, toute la suite convenue et chaque budget ont été exécutés depuis un seul script sur une seule construction de référence, chaque vérification étant lue par son code de sortie. Chaque vérification est sortie avec 0, sauf celles qui étaient attendues, et 643 tests de l'application et 564 tests de la recherche ont réussi [C187]. Chaque budget a été respecté sans relance automatique, mais deux marges n'ont aucune réserve : la médiane des images du geste le plus lourd a été de 16.8, 16.7 et 16.8 ms pour une limite de 16.8 ms, et la page au repos pesait 1,975,305 octets, soit 24,695 de moins que son budget [C188]. Plus tôt dans la phase, la même page était à 23 octets sous son budget [C142], et la même construction donnait 17.0 ms sur une machine chargée et 16.8 ms sur une machine au repos [C140].

### 7.3 Régressions détectées

Les vérifications ont détecté des défauts que les tests fonctionnels avaient manqués. Une suite de mise en page, rédigée après que l'auteur eut signalé des panneaux qui débordaient, a trouvé des défauts sur les 185 écrans de bureau qu'elle vérifie ; après la correction, il n'en restait aucun [C122]. À la fin de la phase 10, la séquence d'images respectait 24 des 29 budgets [C113].

La première exécution complète lors de la revue de passage de la phase 11 a trouvé une régression qu'aucune vérification fonctionnelle ni d'accessibilité n'avait détectée. Avec le processeur ralenti six fois, les gestes de glisser et de molette commençant 20 s ou plus après l'ouverture de la page ont produit cinq images de plus de 33.4 ms sur trois pages, là où le budget en permet une. Alternés avec la construction précédente, les comptes ont été de 5, 4 et 6 contre 0, 0 et 0 : la charge de la machine ne les expliquait donc pas. Une bissection a désigné une correction d'utilisabilité, et des constructions variantes ont montré que son rendu synchrone forcé, et non son déplacement du focus, causait les images longues. Le rendu étant laissé à React, la construction de référence a donné 0 sur les trois pages [C189]. Pourquoi ce rendu alourdit des gestes survenant 20 s plus tard n'est pas établi, si bien qu'un changement semblable ailleurs pourrait passer inaperçu hors des parcours que pilote la suite.

### 7.4 Version de bureau

L'application de bureau enveloppe la même construction web dans une fenêtre Tauri ; ses fichiers web sont identiques octet pour octet à ceux de la construction web. Le réseau de la fenêtre étant envoyé vers un proxy qui refuse et consigne chaque requête, le parcours HBB curé s'est déroulé sans qu'aucune requête ne quitte la fenêtre, à l'exception d'un contrôle délibéré, qui a été bloqué, et l'application n'a atteint que le modèle local [C177]. Le paquet est signé ad hoc et non notarisé, si bien que macOS rejette une copie mise en quarantaine [C183]. Face aux budgets de bureau convenus par l'auteur, la première exécution jugée les a tous respectés, bien que la première image de la visite ait atteint 67 ms pour un plafond de 70 ms [C186].

### 7.5 Construction de publication et vérification de l'hébergement

La construction de publication exclut les prototypes de concept et leurs polices, et transfère 1,970,226 octets au repos [C192]. Un seul fichier d'en-têtes généré, au format de l'hébergeur, porte chaque en-tête qu'exige la revue de sécurité. Sur un serveur local qui applique les règles d'en-têtes de cet hébergeur, la vérification de l'hébergement a satisfait chaque exigence pouvant tenir sur une adresse locale, alors qu'un serveur n'envoyant aucun en-tête en a manqué onze [C193]. Ce que l'hébergeur envoie lui-même ne peut être montré que sur une adresse réelle.

La suite de la phase 11 a été relancée sur une seule construction qui contient tous les changements de la phase 12. Tous les contrôles jugés passent [C197]. Quatre premiers échecs venaient des tests, non de l'application, et ont été corrigés sans toucher l'application. Deux résultats restent ouverts : Firefox crée parfois un second contexte graphique au démarrage, comme le fait la construction de la phase 11, et dans l'application de bureau, sur une machine chargée, une image au milieu d'un mouvement a atteint jusqu'à 40 ms sur quatre passes ; la reprise convenue a réussi, et il n'est pas établi si la charge ou la construction en était la cause. Un enregistrement de 93 secondes a été fait à partir de cette construction, chaque plan venant de l'application réelle [C198]. Chaque étape des README des dépôts a été exécutée sur des clones neufs et sort avec 0, une fois le dépôt de recherche installé en premier, un ordre qui n'était écrit nulle part auparavant [C199]. Le projet a dépensé $0 [C200].

---

## 8 Limites et menaces à la validité

**Aucun test auprès d'utilisateurs.** Aucune session d'utilisabilité avec de vrais utilisateurs n'a été menée et aucun score de questionnaire n'existe. L'utilisabilité a été inspectée par l'IA, au moyen d'une évaluation heuristique et d'un parcours cognitif. Comme l'inspecteur a aussi construit l'application, ses 28 constats constituent une borne inférieure [C169]. Savoir si un parcours continu entre les échelles aide la compréhension nécessite une étude auprès d'utilisateurs, qui n'est pas encore planifiée.

**Aucune revue par un expert indépendant.** Chaque affirmation a été vérifiée par rapport à ses enregistrements uniquement par un audit assisté par l'IA, sans expert indépendant du domaine [C143, C154]. L'auto-vérification par l'IA ne constitue pas une revue indépendante. La concordance avec un enregistrement amont ne dit rien de l'exactitude propre de la base de données amont.

**Des bancs d'essai petits, rédigés par un seul auteur.** Le banc d'essai de la phase 3 porte sur un seul gène, et certaines réponses attendues relèvent du jugement [C31]. Les jeux de l'explorateur ont été rédigés par le projet, exécutés sur un seul modèle à la température 0, et leurs verdicts sur les explications ont été lus par une session d'IA, et pas encore par l'auteur [C115]. Les pourcentages décrivent ces jeux, et non la capacité de planification en général.

**Une seule machine.** Chaque budget est mesuré sur un seul ordinateur portable rapide (Apple M1 Pro), dans Chrome sans interface sur localhost. Des machines plus lentes ont été émulées, et non testées sur de vrais appareils [C131, C135]. Les chiffres sont des intervalles entre images sur le fil principal, et non des minuteries GPU. Le budget d'image et le budget d'octets n'ont aucune réserve sur cette machine [C140, C188].

**Des effets inexpliqués.** Une image longue isolée apparaît sur quelques pages, et son déclencheur n'est pas expliqué [C19, C48, C123]. Le mécanisme de la régression de la revue de passage n'est pas établi [C189]. L'accessibilité a été vérifiée uniquement par script, sans écoute d'un lecteur d'écran [C138, C141]. Firefox et Safari n'ont exécuté qu'une partie des suites, et certains échecs y restent inexpliqués [C139, C191].

**Périmètre et données.** L'analyse des contacts de Val6 est limitée à l'unité asymétrique, avec un seuil unique, et son interprétation comme contact latéral de la fibre est une inférence [C10]. Le jeu HBB peut être reconstruit à partir des entrées consignées publiques aux mêmes valeurs, mais pas octet pour octet, parce que certaines réponses citées doivent être publiées expurgées et qu'une réponse d'Ensembl n'a été consignée nulle part [C167, C168]. Les enregistrements sont des instantanés que les versions amont peuvent modifier.

**Processus.** Les entrées de journal des phases 0 à 2 ont été rédigées rétrospectivement, le même jour, à partir des preuves consignées. La version de bureau est empaquetée, mais ni distribuée ni notarisée [C183].

---

## 9 Déclaration d'utilisation de l'IA et méthode

L'implémentation, l'exécution des expériences, la tenue du journal et la rédaction du rapport et de cet article ont été réalisées avec l'assistance substantielle d'un agent de programmation d'IA (Claude Code, Anthropic), opérant selon une méthodologie à points de contrôle documentée dans l'espace de recherche. L'auteur a pris ou vérifié chaque décision scientifique, chaque engagement et chaque affirmation, et assume l'entière responsabilité des résultats. Les décisions réservées à l'auteur comprennent les licences des dépôts, le retrait des identifiants propriétaires, l'amendement relatif à l'application de bureau, la réécriture de l'historique après un incident de confidentialité, et chaque publication. L'inspection d'utilisabilité et l'audit scientifique ont été réalisés par l'IA et sont rapportés comme tels, et non comme une revue indépendante [C143, C169]. Les modèles d'IA évalués au sein de Helix sont des objets d'étude, distincts de l'assistant utilisé pour le construire. La formulation exacte de cette déclaration suivra les règles de chaque lieu de publication au moment de toute diffusion.

**Méthode.** Trois règles se sont appliquées tout au long du travail. Chaque expérience a été consignée dans le journal, résultats négatifs compris ; le journal contient 96 entrées, chacune consignant un coût nul [C200]. Chaque nombre renvoie à une entrée de journal ou à un fichier brut. Chaque affirmation a une ligne dans le registre des affirmations, et cet article ne cite que des lignes qu'utilise le rapport. Chaque phase s'est close par une revue de passage tranchée par l'auteur, et les réponses attendues des jeux réservés ont été validées avant qu'aucun modèle ne les voie [C31, C115]. Tout ce qui quitte la machine, y compris le rapport, cet article et toute démonstration, relève d'une décision réservée à l'auteur.

---

## 10 Conclusion

Helix montre, pour un variant choisi avec soin puis pour cinq gènes curés, qu'une vue entre les échelles peut être calculée à partir d'enregistrements publics, avec un modèle cantonné à proposer des actions typées. Chaque changement à l'écran est relu depuis le moteur de rendu avant d'être rapporté. Le travail de correspondance a détecté une incohérence de numérotation dans un fichier de structure largement utilisé et un assemblage par défaut qui masque le contact étudié. Les évaluations des modèles ont donné des résultats mitigés : la validation a arrêté chaque identifiant non ancré, mais elle ne peut détecter ni un plan valide mais faux ni une phrase fausse, et sur les éléments réservés les règles ont souvent égalé ou battu le modèle. La réponse livrée est un partage dans lequel le modèle choisit certaines actions et ne rédige jamais ce que lit le visiteur. Les principales questions ouvertes ne relèvent pas de l'ingénierie. Savoir si le parcours aide les gens à comprendre, et si les affirmations scientifiques résistent à un expert indépendant, reste non testé.

---

## Disponibilité

Le dépôt de recherche, qui contient le noyau de données, les jeux de données curés, les bancs d'essai, le journal, le registre des affirmations et le rapport, est disponible en source sous une licence de recherche non commerciale. Le dépôt du produit est privé. L'étude de cas et l'enregistrement de démonstration sont conservés dans le dépôt privé du produit jusqu'au verdict de l'auteur. La publication d'une démonstration publique, et son emplacement, relèvent de la décision de l'auteur ; rien de ce que décrit cet article n'est présenté comme publié ou hébergé.

---

## Références

**Littérature scientifique primaire**

- Harrington, D. J., Adachi, K. et Royer, W. E. (1997). The high resolution crystal structure of deoxyhemoglobin S. *Journal of Molecular Biology*, 272, 398-407. [doi:10.1006/jmbi.1997.1253](https://doi.org/10.1006/jmbi.1997.1253). PubMed [9325099](https://pubmed.ncbi.nlm.nih.gov/9325099/).
- Sehnal, D. et al. (2021). Mol* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures. *Nucleic Acids Research*. [doi:10.1093/nar/gkab314](https://doi.org/10.1093/nar/gkab314).
- Midlik, A. et al. (2025). MolViewSpec: a Mol* extension for describing and sharing molecular visualizations. *Nucleic Acids Research*. [doi:10.1093/nar/gkaf370](https://doi.org/10.1093/nar/gkaf370).
- Slanináková, T. et al. (2026). MolViewStories: Interactive molecular storytelling. *Protein Science*. [doi:10.1002/pro.70540](https://doi.org/10.1002/pro.70540).
- Varadi, M. et al. (2024). AlphaFold Protein Structure Database in 2024. *Nucleic Acids Research*. [doi:10.1093/nar/gkad1011](https://doi.org/10.1093/nar/gkad1011).

**Ressources et enregistrements de données**

- API REST Ensembl, version 116. [rest.ensembl.org](https://rest.ensembl.org/)
- UniProt P68871 (HBB_HUMAN), version 2026_03. [uniprot.org/uniprotkb/P68871](https://www.uniprot.org/uniprotkb/P68871/entry)
- Entrée PDB 2HBS. [rcsb.org/structure/2HBS](https://www.rcsb.org/structure/2HBS)
- Correspondance SIFTS au niveau du résidu, PDBe. [ebi.ac.uk/pdbe/docs/sifts](https://www.ebi.ac.uk/pdbe/docs/sifts/)
- ClinVar VCV000015333. [ncbi.nlm.nih.gov/clinvar/variation/15333](https://www.ncbi.nlm.nih.gov/clinvar/variation/15333/)

**Normes et conventions**

- Nomenclature HGVS, numérotation. [hgvs-nomenclature.org/stable/background/numbering](https://hgvs-nomenclature.org/stable/background/numbering/)
- Transcrits canoniques et MANE Select d'Ensembl. [jun2026.archive.ensembl.org/info/genome/genebuild/canonical.html](https://jun2026.archive.ensembl.org/info/genome/genebuild/canonical.html) (l'archive de juin 2026)

**Outils et travaux connexes**

- Dépôt de Mol* (MIT). [github.com/molstar/molstar](https://github.com/molstar/molstar)
- Mol* `packages/ai`, branche master (non publiée). [github.com/molstar/molstar/tree/master/packages/ai](https://github.com/molstar/molstar/tree/master/packages/ai)
- Spécification de l'agent de visionneuse Mol* Prism, branche master (non publiée). [agent.md](https://github.com/molstar/molstar/blob/master/packages/prism/viewer/_spec/agent.md)
- PDB-101 Molecule of the Month: Hemoglobin (mai 2003). [pdb101.rcsb.org/motm/41](https://pdb101.rcsb.org/motm/41)
- NCBI iCn3D. [ncbi.nlm.nih.gov/Structure/icn3d](https://www.ncbi.nlm.nih.gov/Structure/icn3d/icn3d.html)
- Actualités EMBL-EBI, Ensembl 116 released (11 juin 2026). [ebi.ac.uk](https://www.ebi.ac.uk/about/news/updates-from-data-resources/ensembl-116-release/)
- Tauri 2. [v2.tauri.app](https://v2.tauri.app/)
