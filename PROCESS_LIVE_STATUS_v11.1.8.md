# LEYTON RADAR — Process Live Status v11.1.8

Date : 22/09/2026

## Résumé
- Version : 11.1.8
- Tests : 51/51 PASS
- Registre : 145 sources, dont 143 officielles
- Couverture territoriale : 18/18 régions
- Sources d'ingestion : 111
- Sources de contrôle : 34
- Bibliothèque snapshot : 676 fiches actives
- Fiches strictement vérifiées : 0
- Fiches avec CdC : 86
- Fiches avec calendrier : 166
- Cycle live multi-sources : NON EXÉCUTÉ
- GO PRODUCTION : NON

## Corrections structurantes de cette version
1. Un scan d'ingestion vide n'est jamais destructif pour le dernier corpus valide.
2. Un scan sous le seuil `minExpected` est conservateur et ne déclenche pas de vieillissement des fiches.
3. Une fiche retrouvée dans une autre source est réactivée après déduplication.
4. Les rapports de santé distinguent correctement panne réseau, résultat concluant et cycle live.
5. Aides Territoires devient une source d'ingestion filtrée sur les entreprises privées et les instruments Qualifund ; son exécution live reste à réaliser.

## Gates
| Gate | État | Situation |
|---|---|---|
| 1 — GitHub | BLOCKED | Aucun dépôt accessible via la connexion courante |
| 2 — URL permanente | BLOCKED | Déploiement permanent non confirmé |
| 3 — Collecte réelle | NOT_RUN | 0/111 sources d'ingestion exécutées ; 0/34 contrôles exécutés |
| 4 — Vérification réglementaire | FAIL | 0/676 strictement VÉRIFIÉES |
| 5 — CdC / preuves | PARTIAL | 51/676 noyaux documentaires critiques |
| 6 — Déduplication / fraîcheur | PASS_TECH | Tests OK ; validation finale requise sur corpus multi-sources réel |
| 7 — SIREN/SIRET | READY | Mécanisme présent ; test live requis |
| 8 — Pertinence ≥85 % | PARTIAL | moteur présent ; recette consultant à réaliser |
| 9 — Exploitation quotidienne 02:00 | PARTIAL | workflow présent ; exécution distante non confirmée |
| 10 — Recette production | NOT_STARTED | dépend des Gates 1–9 |

## Règle métier temporelle
Échéance recommandable : **J+1 ou plus**, ou dispositif permanent explicitement documenté.

## Durcissement workflow v11.1.8
- Actions GitHub modernisées vers les majors Node 24 courantes : checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5.
- Aucun Gate métier n'est déclaré PASS par cette seule mise à niveau : un run distant réussi reste obligatoire.
