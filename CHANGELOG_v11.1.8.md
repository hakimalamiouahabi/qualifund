# Changelog v11.1.8 — Workflow Validation Hardening

Date : 22/09/2026

- Mise à niveau des GitHub Actions vers les versions majeures courantes compatibles Node 24.
- `actions/checkout`: v4 → v7.
- `actions/setup-node`: v4 → v7.
- `actions/configure-pages`: v5 → v6.
- `actions/upload-pages-artifact`: v3 → v5.
- `actions/deploy-pages`: v4 → v5.
- Le statut des Gates reste conservateur : aucun PASS de production sans exécution distante réelle.
- Correction P0 : Gate 10 ne peut plus passer indépendamment ; elle dépend désormais strictement du PASS des Gates 1–9.
