# LEYTON RADAR — état d’exécution du process v11.1.1

Date : 22/09/2026

## Travaux réalisés dans cette reprise

- ZIP v11.1 extrait et contrôlé.
- Tests initiaux : 15/15 PASS.
- Diagnostic confirmé : 676 fiches présentes, toutes issues du bootstrap Aides Entreprises ; aucun apport des autres sources dans le corpus publié.
- Connecteur Aides Entreprises durci : le stock JSON Open Data complet devient la voie primaire ; l'API REST reste en fallback.
- Nouveau connecteur OpenDataSoft v2.1 pour les jeux régionaux structurés.
- Occitanie basculée de `control-only` vers ingestion OpenDataSoft sur le dataset officiel des aides et appels à projets.
- Île-de-France reliée explicitement au dataset `aides-appels-a-projets`.
- Pays de la Loire basculé en mode hybride web + Open Data.
- Audit d'ingestion ajouté : séparation des sources d'ingestion et des sources de contrôle.
- Gate 3 durcie : un contrôle accessible ne peut plus masquer l'absence d'ingestion réelle ; présence de fiches hors bootstrap exigée pour PASS.
- Règle temporelle alignée sur le cahier des charges : échéance >= J+1 ou permanence vérifiée, côté moteur et interface.
- Script `build-search-index.mjs` manquant recréé.
- Tests après modifications : 20/20 PASS.

## État des sources après durcissement

- 145 sources configurées.
- 110 sources d'ingestion.
- 35 sources de contrôle.
- 9 API restent volontairement ou temporairement en `control-only` et doivent être qualifiées une par une avant conversion en ingestion.
- Dernier cycle live dans le ZIP : 0 source exécutée / 0 succès.

## Gates

1. Dépôt GitHub : BLOQUÉ — aucun dépôt accessible dans l'état fourni.
2. URL permanente : BLOQUÉE — dépend du dépôt/déploiement.
3. Collecte réelle : PRÊTE TECHNIQUEMENT, NON EXÉCUTÉE EN LIVE — 0/110 sources d'ingestion exécutées dans le dernier cycle ; corpus hors bootstrap = 0.
4. Bibliothèque vérifiée : FAIL — 0/676 strictement vérifiées.
5. CdC / preuves : PARTIEL — 51/676 noyau documentaire critique ; 86/676 avec CdC.
6. Déduplication / fraîcheur : PASS TECHNIQUE.
7. SIREN/SIRET : PRÊT, test live requis.
8. Pertinence >=85 % : PARTIEL — recette consultant non exécutée.
9. 02:00 + rapport : IMPLÉMENTÉ, NON EXÉCUTÉ EN LIVE.
10. Recette production : NON DÉMARRÉE.

## Prochaine étape technique

Exécuter le premier cycle complet sur un runner avec accès réseau, analyser les volumes par source et convertir progressivement les API `control-only` réellement exploitables en sources d'ingestion sans dupliquer les sources maîtres régionales.
