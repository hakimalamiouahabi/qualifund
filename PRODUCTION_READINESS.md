# LEYTON RADAR — Production Readiness v12.6.0

Généré : 2026-09-30T11:44:31.450Z

- **Gate 1 — Dépôt GitHub et versionnement** : PASS — hakimalamiouahabi/qualifund
- **Gate 2 — URL permanente** : BLOCKED — Déploiement permanent non confirmé.
- **Gate 3 — Collecte réelle des sources** : PARTIAL — Ingestion: 102/102 exécutées, 74 succès, 3255 imports bruts. Contrôles: 34/34. Corpus de sources directes: 2298. Préflight réseau: 4/4 accessibles/protégées.
- **Gate 4 — Bibliothèque réglementaire vérifiée** : PARTIAL — 1/2275 fiches J+1 strictement VÉRIFIÉES ; sources directes uniquement, sans quota de fiches, au 2026-10-01. Sont comptées les aides retrouvées ACTIVE sans échéance publiée, les aides permanentes et celles avec clôture documentée >= J+1 ; STALE et ARCHIVE sont exclues. Intégrité recalculée 1/1.
- **Gate 5 — Extraction CdC / preuves par champ** : WAIT_LIVE — Preuves A/B complètes sur les 8 champs critiques : 1/1 fiches VÉRIFIÉES. File de remédiation synchronisée : non. Couverture J+1 indicative : 889/2275 avec CdC/règlement.
- **Gate 6 — Déduplication et fraîcheur** : PASS_TECH — Scans vides non destructifs, ordre multi-source neutralisé, réactivation et J+1 couverts par tests. PASS final après corpus multi-sources réel.
- **Gate 7 — Enrichissement SIREN/SIRET** : PASS — API Recherche d’entreprises DINUM validée par smoke live.
- **Gate 8 — Qualification projet multi-financeurs** : PASS — Moteur partagé navigateur/recette avec profils Bpifrance/France 2030, ADEME, FEDER et régional. Cas UAT réussis : 5/5. Minimum : 5.
- **Gate 9 — Exploitation quotidienne 02:00 + rapport** : PARTIAL — Workflow, cron 02:00 Europe/Paris et rapport implémentés ; une exécution live de la chaîne reste requise.
- **Gate 10 — Recette production** : NOT_STARTED — GO uniquement quand les Gates 1–9 sont validées et sans anomalie P0.

**GO PRODUCTION : NON**