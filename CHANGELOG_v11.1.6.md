# CHANGELOG — LEYTON RADAR v11.1.6

## Collecte et provenance
- Aides Entreprises : stock Open Data complet comme voie primaire ; suppression du fallback automatique vers l’API authentifiée.
- Migration du snapshot : ajout/normalisation `sourceId`, suppression des `apiUrl` protégées et réparation des preuves/pages officielles concernées.
- Normalisation des échéances des nouveaux enregistrements.
- Baselines Web officielles documentées sans en faire des objectifs artificiels de volume.

## Process et déploiement
- Gate 3 reste `NOT_RUN` sans cycle live ; `PASS_TECH` ne vaut pas `PASS` production.
- Reconstruction systématique `sync:metadata` + `build:index` dans les workflows avant validation/déploiement.
- GitHub Pages : runtime statique sans endpoints `/api/*` ; SIREN via API Recherche d’entreprises ouverte.
- Vercel : rewrites explicites pour préserver les fonctions serverless.
- Cycle quotidien aligné à 02:00 Europe/Paris.
- `.env.example` complété avec `RADAR_ADMIN_TOKEN` et indicateurs de preuves live.

## Qualité
- Dépendances directes figées ; Node 22 déclaré.
- Schéma enrichi (`sourceId`, `sourceRecordId`, `apiUrl`, échéances objet/legacy).
- Validation locale avec fallback structurel si AJV absent.
- **41/41 tests PASS** lors de la consolidation du 22/09/2026.
