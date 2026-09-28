# CHANGELOG — LEYTON RADAR v11.1.5

Date : 2026-09-22

## Corrections process et sources
- Gate 3 : `0/110` source exécutée n’est plus affiché `READY` mais **`NOT_RUN`**.
- Gate 6 : `PASS_TECH` reste un état technique intermédiaire et **ne permet plus un GO PRODUCTION**. Le PASS final exige un corpus multi-sources réellement collecté.
- GO PRODUCTION : exige désormais **PASS sur toutes les Gates**, sans accepter `PASS_TECH`.
- Aides Entreprises : suppression du fallback API REST implicite, car l’API officielle requiert une authentification. Le stock JSON public complet reste la source primaire.
- Les preuves issues du stock Aides Entreprises pointent désormais vers la page Open Data publique, pas vers l’API protégée.
- Pays de la Loire : endpoint OpenDataSoft de contrôle normalisé (`api` racine + `datasetId`).
- Région Sud : la page « flux json » est requalifiée comme **page Web de contrôle**, car la ressource publique observée est rendue en HTML.
- Préflight : User-Agent dynamique sur la version courante et ventilation ingestion/contrôle dans le résumé de santé.
- Validation Web corrigée : ADEME 71, DGE 64, Pays de la Loire 180 au contrôle du 22/09/2026.
- Validation : `npm run validate` utilise AJV quand disponible et un fallback structurel critique lorsqu’AJV n’est pas installé localement ; la CI conserve AJV après `npm install`.
