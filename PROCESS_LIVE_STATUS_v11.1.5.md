# LEYTON RADAR — état live v11.1.5

Date : 2026-09-22

## État consolidé
- **Gate 1 — GitHub** : BLOCKED — aucun dépôt accessible via la connexion disponible.
- **Gate 2 — URL permanente** : BLOCKED — aucun déploiement permanent confirmé.
- **Gate 3 — Collecte réelle** : **NOT_RUN** — 110 sources d’ingestion, 35 sources de contrôle ; 0/110 exécutée dans un cycle live.
- **Gate 4 — Vérification réglementaire** : FAIL — 0/676 strictement vérifiées.
- **Gate 5 — Preuves/CdC** : PARTIAL — 86/676 avec CdC ; 51/676 avec noyau documentaire critique.
- **Gate 6 — Déduplication/fraîcheur** : PASS_TECH — tests locaux OK, mais PASS final seulement après corpus multi-sources réel.
- **Gate 7 — SIREN/SIRET** : READY — endpoint présent ; test live requis.
- **Gate 8 — Pertinence ≥85 %** : PARTIAL — recette consultant non exécutée.
- **Gate 9 — Exploitation quotidienne** : PARTIAL — workflow/rapport présents ; exécution distante non confirmée.
- **Gate 10 — Recette production** : NOT_STARTED.

**GO PRODUCTION : NON.**

## Correction de lecture du process
Les états `READY` et `PASS_TECH` indiquent qu’un composant est prêt ou testé localement ; ils ne valent pas validation de production. Le GO n’est possible qu’avec des Gates en `PASS`.
