# Architecture finale Qualifund v8

```text
Sources officielles / Open Data
        ↓
Connecteurs isolés + retry + timeout
        ↓
API / HTML / Playwright / PDF
        ↓
Extraction structurée + preuves A/B/C/D
        ↓
Déduplication inter-sources + versionnement
        ↓
QA / garde-fous / source health
        ↓
site/data/library.json
        ↓
GitHub Pages HTTPS
        ↓
Qualification senior locale dans le navigateur
```

### Principes de résilience
- une panne source ne bloque jamais le cycle ;
- scan suspect = conservation de la dernière version valide ;
- disparition uniquement après scan jugé sain ;
- QA gate avant publication ;
- Git history + journal de changements ;
- le navigateur n’interroge jamais directement les financeurs.
