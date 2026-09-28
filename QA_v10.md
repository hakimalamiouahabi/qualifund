# QA LEYTON RADAR v10.0

## Tests locaux

- Tests Node : **12/12 réussis**.
- Vérification syntaxique : `site/app.js`, `update-library.mjs`, `extract.mjs`, `web-catalog.mjs`, endpoints serverless : **OK**.
- Audit registre : **145 sources**, **143 officielles**, aucune incohérence minimale signalée par `audit-sources.mjs`.

## Audit du bootstrap actuel

- 676 fiches actives.
- 60 AAP/AMI identifiés dans le bootstrap.
- 86 fiches avec CdC/règlement lié.
- 166 fiches avec date ou statut permanent exploitable.
- 0 fiche `VERIFIE` avec la nouvelle définition stricte A/B.
- 0 critère de sélection, versement ou remboursement structuré dans le bootstrap historique : ces champs seront remplis lors des nouveaux cycles v10 lorsque les sources les documentent.

## Limite de la recette locale

`npm run validate` requiert l'installation des dépendances npm (`ajv`). L'environnement de construction de cette session n'a pas terminé l'installation dans le délai disponible. Le workflow GitHub installe les dépendances avant validation ; les tests sans dépendance externe et les contrôles syntaxiques ont été exécutés localement.
