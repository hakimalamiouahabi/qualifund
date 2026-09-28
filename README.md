# QUALIFUND — bibliothèque indépendante des aides publiques

Bibliothèque des appels à projets (AAP), appels à manifestation d'intérêt (AMI) et aides nationales ou régionales en France pour les startups, PME, ETI et grandes entreprises. Périmètre : **subventions**, **avances remboursables** et **prêts explicitement à taux zéro**. Les prêts garantis et les prêts classiques sont hors périmètre.

## Objectif de couverture\n\nPlus de 2 000 dispositifs distincts, nationaux ou régionaux, réellement dans le périmètre entreprise et instruments retenus. Le seuil est une cible de recette et ne justifie jamais l'ajout de doublons, d'éditions closes, de bénéficiaires publics uniquement ou d'autres produits financiers.\n\n## Statut réel

Le corpus embarqué au démarrage contient 678 fiches, dont **60 classées AAP / AMI** datées du 22 septembre 2026, dont **0 fiche au statut vérifié**, 86 avec un lien de cahier des charges ou règlement, 166 avec une échéance renseignée et **1 seule avec un critère de sélection renseigné**. Les catégories instrumentales se recoupent : 665 fiches mentionnent une subvention, 58 une avance remboursable et 2 un prêt à taux zéro. Le registre comporte 145 entrées, dont 34 de contrôle uniquement. Le classement AAP / AMI peut contenir des erreurs et ne démontre pas une couverture exhaustive des appels à projets ni des aides nationales et régionales. Ces nombres ne démontrent ni l'actualité ni l'exhaustivité des dispositifs. Le cycle de collecte complète lancé le 28 septembre 2026 doit encore fournir ses résultats et son rapport d'anomalies.

Une source configurée ≠ une source collectée ; une fiche importée ≠ une fiche vérifiée ; une correspondance thématique ≠ une éligibilité. Les critères absents restent « À VÉRIFIER ».

Les programmes FEDER et FEADER mis en œuvre en France entrent dans ce périmètre lorsqu'un dispositif s'adresse effectivement aux entreprises et utilise l'un des instruments retenus. Le registre comprend notamment des sources Bpifrance, ANR, ADEME et des programmes régionaux européens ; leur configuration ne prouve pas leur collecte.\n\n## Collecte et preuves

1. Interroger les API publiques officielles gratuites lorsqu'elles exposent effectivement les fiches et conditions.
2. Compléter par les fichiers ouverts officiels, puis les pages et règlements officiels des éditions en vigueur.
3. Enregistrer par critère la règle explicite, son extrait, son URL, l'édition et la date de contrôle.
4. Écarter des résultats ouverts les éditions closes et signaler les sources inaccessibles ou incomplètes.
5. Produire un rapport par source : découvertes, importées, vérifiées, rejetées, dernier succès et anomalies.

Voir [la politique de couverture](POLITIQUE_COUVERTURE_2026-09-28.md) pour les limites et critères de recette.

## Évaluation

Le dossier entreprise décrit la taille et le périmètre du groupe, le territoire, le secteur, les comptes et le projet (budget, dépenses, calendrier, maturité). Chaque condition reçoit un verdict **CONFORME**, **NON CONFORME** ou **À VÉRIFIER**, avec la donnée comparée et la preuve officielle. Les critères qualitatifs de sélection sont examinés séparément ; le score de pertinence n'est jamais une probabilité d'obtention.

## Exécution locale

```bash
npm ci
npm test
npm run audit:sources
npm run preflight:sources
npm run update:full
npm run audit:ingestion
npm run validate
```

La collecte planifiée est définie dans `.github/workflows/update-and-deploy.yml`. L'interface statique est dans `site/` et les données générées dans `site/data/`. Le bouton de mise à jour côté navigateur ne remplace pas la collecte serveur complète. Les données projet restent dans le navigateur dans la version statique.

## Indépendance

Ce dépôt est consacré à QUALIFUND. Il n'est lié à aucune application tierce et ne constitue pas le code source d'une autre interface de qualification.
