# LEYTON RADAR — Production Readiness v12.2.0

Généré : 2026-09-22T22:21:03.990Z

- **Gate 1 — Dépôt GitHub et versionnement** : BLOCKED — Aucun dépôt GitHub accessible/configuré.
- **Gate 2 — URL permanente** : BLOCKED — Déploiement permanent non confirmé.
- **Gate 3 — Collecte réelle des sources** : NOT_RUN — Ingestion: 0/111 exécutées, 0 succès, 0 imports bruts. Contrôles: 0/34. Corpus hors bootstrap Aides Entreprises: 2. Préflight local non concluant (réseau du runner indisponible).
- **Gate 4 — Bibliothèque réglementaire vérifiée** : WAIT_LIVE — 0/678 fiches actives strictement VÉRIFIÉES ; intégrité recalculée 0/0. Les priorités fermes sont limitées aux fiches VÉRIFIÉES ; les autres restent en pistes à sécuriser.
- **Gate 5 — Extraction CdC / preuves par champ** : WAIT_LIVE — Preuves A/B complètes sur les 8 champs critiques : 0/0 fiches VÉRIFIÉES. File de remédiation synchronisée : oui. Couverture globale indicative : 86/678 avec CdC/règlement.
- **Gate 6 — Déduplication et fraîcheur** : PASS_TECH — Scans vides non destructifs, ordre multi-source neutralisé, réactivation et J+1 couverts par tests. PASS final après corpus multi-sources réel.
- **Gate 7 — Enrichissement SIREN/SIRET** : READY — Fallback navigateur + endpoint /api/company disponibles ; smoke live non concluant ou non exécuté.
- **Gate 8 — Pertinence projet ≥85 %** : PASS — Moteur partagé navigateur/recette, pondération finale 25/15/20/15/10/10/5. Cas UAT réussis : 5/5. Minimum : 5.
- **Gate 9 — Exploitation quotidienne 02:00 + rapport** : PARTIAL — Workflow, cron 02:00 Europe/Paris et rapport implémentés ; une exécution live de la chaîne reste requise.
- **Gate 10 — Recette production** : NOT_STARTED — GO uniquement quand les Gates 1–9 sont validées et sans anomalie P0.

**GO PRODUCTION : NON**