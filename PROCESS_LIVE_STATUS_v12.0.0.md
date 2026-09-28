# LEYTON RADAR — Process Live Status v12.0.0

## État local de release

- Version : 12.0.0
- Sources configurées : 145
- Sources d’ingestion : 111
- Sources de contrôle : 34
- Régions couvertes : 18/18
- Snapshot historique : 676 fiches bootstrap Aides Entreprises
- Cycle live multi-source dans ce runtime : non exécuté
- UAT pertinence : 5/5 PASS
- Tests de release : 63/63 PASS

## Gates avant activation externe

1. GitHub : BLOCKED — aucun dépôt accessible dans la connexion actuelle.
2. URL permanente : BLOCKED — dépend du dépôt/Pages.
3. Collecte live : NOT_RUN — nécessite le runner réseau.
4. Vérification réglementaire : FAIL sur le snapshot historique C-tier.
5. Preuves critiques : PARTIAL sur le snapshot historique.
6. Déduplication/fraîcheur : PASS_TECH ; PASS après corpus multi-source réel.
7. SIREN/SIRET : READY ; smoke live automatisé dans GitHub Actions.
8. Pertinence >=85 % : PASS — 5/5 UAT.
9. Cycle 02:00 : PARTIAL — workflow prêt, exécution schedule réelle requise.
10. Recette production : NOT_STARTED tant que Gates 1–9 ne sont pas PASS.

## Principe de vérité

Aucun état PASS n’est déduit d’une configuration seule. Les Gates externes exigent des artefacts de preuve (`coverage.json`, `live-smoke.json`, `uat-results.json`, `production-readiness.json`).
