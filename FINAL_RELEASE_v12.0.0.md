# LEYTON RADAR v12.0.0 — Release finale du code / Production Candidate

Date de consolidation : 22/09/2026

## Statut

**Code finalisé : OUI.**  
**Production certifiée par exécution live : NON, tant que le dépôt GitHub, l’URL publique et un cycle réseau réel ne sont pas disponibles.**

Cette distinction est volontaire : la release ne transforme jamais une absence de preuve externe en PASS.

## Ce que la release automatise désormais

1. Audit des 145 sources.
2. Préflight réseau.
3. Collecte complète des 111 sources d’ingestion et contrôle des 34 sources de benchmark.
4. Conservation du dernier corpus valide en cas de panne/scan vide/volume suspect.
5. Enrichissement des pages opérateur et PDF officiels.
6. Déduplication et provenance multi-source sans dépendance à l’ordre d’exécution.
7. Validation schéma, tests, QA et rapport de remédiation.
8. UAT pertinence (5 cas, seuil 85 %).
9. Smoke live SIREN via l’API publique Recherche d’entreprises.
10. Déploiement GitHub Pages, smoke de l’URL publique, recalcul des Gates et republication de la readiness finale.
11. Cycle quotidien à 02:00 Europe/Paris.

## Deux actions externes non réalisables dans ce chat

1. **Créer/rendre accessible un dépôt GitHub et y pousser ce dossier.** La connexion GitHub disponible dans le chat retourne actuellement 0 dépôt et n’expose aucune action de création de repository.
2. **Activer GitHub Pages avec “GitHub Actions” comme source** dans les paramètres du dépôt.

Dès le premier push, le workflow effectue automatiquement le premier cycle complet et le déploiement. La première exécution planifiée réussie à 02:00 apporte ensuite la preuve opérationnelle exigée par la Gate 9.

## Condition de GO final

Le fichier `site/data/production-readiness.json` est la source de vérité. `GO PRODUCTION` ne passe à OUI que si les Gates 1 à 10 sont toutes PASS.

Si Gates 4 ou 5 restent sous les seuils après le premier cycle live, `site/data/remediation.json` fournit la file de fiches/champs à compléter ; aucune validation artificielle n’est appliquée.
