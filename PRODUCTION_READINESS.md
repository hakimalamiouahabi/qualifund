# LEYTON RADAR — Production Readiness v12.2.0

Généré : 2026-09-28T10:45:13.363Z

- **Gate 1 — Dépôt GitHub et versionnement** : PASS — hakimalamiouahabi/qualifund
- **Gate 2 — URL permanente** : BLOCKED — Déploiement permanent non confirmé.
- **Gate 3 — Collecte réelle des sources** : PARTIAL — Ingestion: 111/111 exécutées, 74 succès, 4214 imports bruts. Contrôles: 34/34. Corpus hors bootstrap Aides Entreprises: 73. Préflight réseau: 136/145 accessibles/protégées.
- **Gate 4 — Bibliothèque réglementaire vérifiée** : PARTIAL — 5/749 fiches actives strictement VÉRIFIÉES ; intégrité recalculée 5/5. Les priorités fermes sont limitées aux fiches VÉRIFIÉES ; les autres restent en pistes à sécuriser.
- **Gate 5 — Extraction CdC / preuves par champ** : WAIT_LIVE — Preuves A/B complètes sur les 8 champs critiques : 5/5 fiches VÉRIFIÉES. File de remédiation synchronisée : oui. Couverture globale indicative : 103/749 avec CdC/règlement.
- **Gate 6 — Déduplication et fraîcheur** : PASS_TECH — Scans vides non destructifs, ordre multi-source neutralisé, réactivation et J+1 couverts par tests. PASS final après corpus multi-sources réel.
- **Gate 7 — Enrichissement SIREN/SIRET** : PASS — API Recherche d’entreprises DINUM validée par smoke live.
- **Gate 8 — Pertinence projet ≥85 %** : PASS — Moteur partagé navigateur/recette, pondération finale 25/15/20/15/10/10/5. Cas UAT réussis : 5/5. Minimum : 5.
- **Gate 9 — Exploitation quotidienne 02:00 + rapport** : PARTIAL — Workflow, cron 02:00 Europe/Paris et rapport implémentés ; une exécution live de la chaîne reste requise.
- **Gate 10 — Recette production** : NOT_STARTED — GO uniquement quand les Gates 1–9 sont validées et sans anomalie P0.

**GO PRODUCTION : NON**