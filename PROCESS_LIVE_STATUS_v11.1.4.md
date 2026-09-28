# LEYTON RADAR — état live v11.1.4

Date : 2026-09-22

## État consolidé
- **Gate 1 — GitHub** : BLOCKED — la connexion disponible ne retourne aucun dépôt accessible.
- **Gate 2 — URL permanente** : BLOCKED — aucun déploiement permanent confirmé.
- **Gate 3 — Collecte réelle** : READY — 110 sources d'ingestion et 35 sources de contrôle ; dernier cycle réel : 0/110.
- **Gate 4 — Vérification réglementaire** : FAIL — 0/676 strictement vérifiées.
- **Gate 5 — Preuves/CdC** : PARTIAL — 86/676 avec CdC ; 51/676 avec noyau documentaire critique.
- **Gate 6 — Déduplication/fraîcheur** : PASS_TECH — tests locaux OK ; validation sur corpus multi-sources restant à faire.
- **Gate 7 — SIREN/SIRET** : READY — endpoint présent ; test live après déploiement.
- **Gate 8 — Pertinence ≥85 %** : PARTIAL — moteur présent ; recette consultant à exécuter.
- **Gate 9 — Exploitation quotidienne** : PARTIAL — rapport corrigé, baseline fiable ; exécution distante à confirmer.
- **Gate 10 — Recette production** : NOT_STARTED.

**GO PRODUCTION : NON.**

## Snapshot actuel
- Bibliothèque : **676** fiches.
- AAP/AMI : **60**.
- Vérifiées : **0**.
- Avec CdC : **86**.
- Avec calendrier : **166**.
- Origine : **676/676 bootstrap Aides Entreprises**, 0 fiche issue d'autres collecteurs dans le snapshot actuel.

## Corrections v11.1.4
- Métadonnées et versions publiques synchronisées.
- Compteur historique 756 supprimé au profit du volume réel 676.
- Rapport quotidien corrigé : aucun faux « 676 nouveaux » sans baseline.
- Snapshot précédent conservé automatiquement pour les futurs diffs.
- Baselines Web officielles actualisées : ADEME 71, DGE 64, Pays de la Loire 180.
