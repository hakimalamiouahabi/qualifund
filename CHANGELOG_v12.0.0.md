# CHANGELOG — LEYTON RADAR v12.0.0

## Production candidate définitive du moteur

Cette version consolide les corrections réalisées pendant la revue de production du 22/09/2026.

### Sécurité du cycle de collecte
- Un scan d’ingestion vide ou sous `minExpected` ne peut plus rendre des fiches obsolètes.
- Une fiche vue par n’importe quelle source valide pendant le cycle reste ACTIVE indépendamment de l’ordre des connecteurs.
- La provenance multi-source est conservée via `sourceId` et `sourceAliases`.
- La dernière bibliothèque valide est sauvegardée avant remplacement.

### Sources et preuves
- 145 sources configurées : 111 d’ingestion, 34 de contrôle.
- Aides Entreprises : stock Open Data complet prioritaire ; API REST protégée non utilisée comme fallback automatique.
- Aides Territoires : ingestion filtrée sur entreprises privées + SUBVENTION/PRET/AVANCE_REMBOURSABLE.
- Les pages catalogue Aides Entreprises génériques ne peuvent plus être promues en preuve B d’une fiche.
- L’enrichissement réglementaire inspecte pages officielles spécifiques, CdC, règlements et PDF officiels.

### Règles métier
- Calendrier : J0 exclu ; J+1 accepté.
- Un dispositif permanent n’est recommandable comme permanent que si le calendrier/permanence est appuyé par une preuve A/B.
- Éligibilité, pertinence projet et confiance documentaire restent séparées.
- Seuil d’affichage pertinence : >= 85 %.

### Qualification / UAT
- Le moteur de score navigateur est partagé avec la recette automatique.
- 5 cas représentatifs UAT sont exécutés automatiquement ; la Gate 8 exige 5/5 cas >= 85 %.

### Déploiement et validation
- Premier push : collecte complète + QA + UAT + déploiement, sans second déclenchement manuel.
- Workflow quotidien : 02:00 Europe/Paris.
- Smoke live : API Recherche d’entreprises DINUM + URL publique.
- Vérification post-déploiement puis second artefact Pages avec readiness finale.
- Les Gates utilisent des preuves d’exécution, pas des drapeaux manuels.
- Gate 10 exige le PASS des Gates 1 à 9.

### Remédiation
- `scripts/remediation-report.mjs` produit une file priorisée des preuves/champs manquants.
- `site/data/remediation.json` et `REMEDIATION_REPORT.md` rendent Gates 4–5 actionnables après le premier cycle live.

### Tests
- 63 tests unitaires/non-régression passent dans l’environnement local de release avant packaging.
