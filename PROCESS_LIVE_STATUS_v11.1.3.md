# LEYTON RADAR — Process live status v11.1.3

Date: 2026-09-22

## Synthèse

- Registre: 145 sources, 110 sources d'ingestion, 35 sources de contrôle.
- Couverture registre: 18/18 régions; 143 sources marquées officielles.
- Corpus historique livré: 676 fiches actives; 0 fiche non-bootstrap; 0 fiche strictement vérifiée.
- Tests unitaires: 24/24 PASS.
- Règle temporelle métier: échéance >= J+1 ou permanent vérifié.
- GO PRODUCTION: NON.

## Gates

1. GitHub/versionnement — BLOCKED: aucun dépôt visible via la connexion GitHub actuelle.
2. URL permanente — BLOCKED: aucun déploiement confirmé.
3. Collecte réelle — READY: connecteurs durcis, 0/110 sources d'ingestion exécutées dans le dernier cycle, 0 succès, 0 import non-bootstrap.
4. Bibliothèque vérifiée — FAIL: 0/676 strictement vérifiées; 86 avec CdC; 166 avec calendrier.
5. Noyau documentaire — PARTIAL: 51/676 avec noyau documentaire critique.
6. Déduplication/fraîcheur — PASS_TECH: tests techniques OK, validation grandeur nature à faire sur corpus multi-sources.
7. SIREN/SIRET — READY: code présent, test réseau live restant.
8. Pertinence >=85% — PARTIAL: moteur présent, recette consultant non réalisée.
9. Cycle automatique 02:00 + rapport — PARTIAL: workflow présent, exécution distante non confirmée.
10. Recette production — NOT_STARTED: dépend des Gates 1 à 9.

## Corrections v11.1.3 influant directement le process

- Pagination catalogue durcie pour éviter les pertes de pages sur des sites régionaux.
- Seuils officiels de couverture ajoutés pour détecter les collectes incomplètes.
- Correction P0 de fusion: conservation des champs réglementaires extraits.
- Extraction de secours ajoutée pour sélection, versement, remboursement, aides d'État, candidature et contact.
- Cohérence de version réparée dans les artefacts générés.

## Prochaine validation indispensable

Exécuter un vrai cycle réseau sur les 110 sources d'ingestion, puis contrôler pour chaque source: volume découvert, volume importé, erreurs, déduplication, provenance, fraîcheur, preuve par champ et couverture des champs réglementaires. Le snapshot 676 ne doit pas être considéré comme exhaustif.
