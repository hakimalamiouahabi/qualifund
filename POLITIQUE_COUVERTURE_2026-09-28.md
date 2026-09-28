# Politique de couverture et de qualification — 28 septembre 2026

## Périmètre
Entreprises : startups, PME, ETI et grandes entreprises. Dispositifs : appels à projets, appels à manifestation d'intérêt et aides nationales ou régionales en France, y compris FEDER et FEADER lorsque le dispositif vise effectivement les entreprises. Instruments : subventions, avances remboursables et prêts explicitement à taux zéro. Les prêts garantis et prêts classiques sont exclus.

## Collecte
1. Exploiter l'API publique officielle lorsqu'elle fournit les fiches et leurs conditions sans coût ni secret supplémentaire.
2. À défaut, exploiter les fichiers ouverts officiels, puis les pages et documents officiels de l'édition en vigueur. Le PDF/règlement fait foi pour les critères de sélection et les conditions qui ne figurent pas dans l'API.
3. Une source secondaire sert uniquement à détecter un manque de couverture ; elle ne valide jamais une condition.
4. Conserver pour chaque champ sensible une citation vérifiable : URL, niveau de preuve A/B/C, extrait, date de contrôle, édition.
5. Une source configurée, sondée ou accessible ne compte pas comme source collectée ; une fiche importée ne compte pas comme fiche vérifiée.

## Évaluation
Pour chaque entreprise et projet, présenter séparément les critères d'éligibilité et de sélection : règle publiée, donnée du dossier comparée, état CONFORME / NON CONFORME / À VÉRIFIER et preuve. Une incompatibilité ne devient bloquante que si la règle est explicite, actuelle et rattachée à une source officielle. Un texte libre, une date absente, une catégorie inférée ou l'absence d'exclusion ne permettent pas de conclure à la conformité. Les critères qualitatifs de sélection restent à examiner sur pièces ; le score de pertinence ne représente ni l'éligibilité ni une probabilité de financement.

## Audit initial
Le registre v12.2.0 comprend 145 entrées : 96 en lecture de catalogue HTML, 34 de contrôle, 9 hybrides régionaux, 2 pages officielles et 4 autres méthodes (stock Aides Entreprises, interrogation data.gouv.fr, API Aides Territoires, OpenDataSoft). Ce registre n'établit pas la réussite de la collecte. L'API REST Aides Entreprises exige une identification sur son site ; le stock officiel téléchargeable est une autre méthode ouverte. L'API Aides Territoires a répondu HTTP 401 dans le premier cycle et le service indique depuis mars 2026 se concentrer sur les collectivités et établissements publics. Ne pas compter cette source comme une couverture effective des entreprises sans nouvelle preuve.

## Critères de recette
- Rapport daté par source : méthode, URL, dernier succès, fiches brutes/importées, échecs et anomalies.
- Nombre de fiches actives et vérifiées, par instrument, taille d'entreprise, région et famille thématique.
- Pour chaque fiche recommandée : édition et calendrier actuels, bénéficiaires, territoire, assiette, dépenses, prérequis, sélection, conditions financières, règlement et preuve par champ critique.
- Échantillon de dossiers startup, PME, ETI et GE relu par un consultant ; correction des faux « conforme » et des exclusions injustifiées avant mise en production.

## Sources officielles consultées
- https://data.aides-entreprises.fr/documentation
- https://data.aides-entreprises.fr/stock
- https://www.data.gouv.fr/dataservices/api-aides-territoires
- https://aides-territoires.beta.gouv.fr/
