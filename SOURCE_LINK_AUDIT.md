# Audit liaison sources / API — Qualifund v8.1

- Sources configurées : **32**
- Sources officielles : **30**
- Connecteurs régionaux : **18**
- Sources/API explicitement structurées : **9**
- `scripts/update-library.mjs` lit directement `config/sources.json` à chaque cycle.
- Chaque source est dispatchée vers son connecteur (`aides-entreprises`, `catalog-html`, `data-gouv-query`, `region-hybrid`, `control-only`).
- La publication GitHub Pages s'effectue uniquement après collecte, tests, validation et QA.
- En cas de source en échec ou de volume suspect, la dernière version valide est conservée.
- Le fichier `site/data/bootstrap.js` permet également d'afficher la bibliothèque lorsque l'aperçu est ouvert directement en `file://`.

## Sources avec API explicite

- `aides_entreprises`
- `aides_territoires`
- `bretagne`
- `cvl`
- `corse`
- `idf`
- `occitanie`
- `pdl`
- `reunion`
