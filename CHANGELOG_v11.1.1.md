# CHANGELOG — LEYTON RADAR v11.1.1

Date : 22/09/2026

## Ingestion

- Aides Entreprises : lecture primaire du stock JSON Open Data complet (`https://data.aides-entreprises.fr/files/aides.json`), avec fallback API REST.
- Ajout d'un connecteur OpenDataSoft v2.1.
- Occitanie : ingestion directe du dataset officiel `aides-et-appels-a-projets-de-la-region-occitanie@occitanie`.
- Île-de-France : liaison explicite au dataset officiel `aides-appels-a-projets`.
- Pays de la Loire : stratégie hybride Web + Open Data.
- Ajout de `audit:ingestion` pour distinguer sources d'ingestion et sources de contrôle.

## Qualité / Gates

- Gate 3 réécrite : les sources `control-only` ne peuvent plus faire croire à une ingestion réussie.
- Gate 3 exige désormais une exécution réelle des sources d'ingestion et l'apparition de fiches hors bootstrap Aides Entreprises.
- `build-search-index.mjs` recréé (script référencé mais absent du ZIP v11.1).

## Règle calendrier

- Alignement sur le cahier des charges : une date fixe est recommandable si l'échéance est >= J+1.
- J0 est rejeté ; J+1 est accepté.
- Interface, statut public et documentation opérationnelle alignés.

## Tests

- Avant reprise : 15/15 tests PASS.
- Après durcissement : 20/20 tests PASS.
- Audit registre : 145 sources, 143 officielles, 18/18 régions, aucune anomalie de structure.

## État du corpus

- 676 fiches présentes dans le bootstrap fourni.
- 676 identifiants `ae_*` : corpus publié encore exclusivement issu d'Aides Entreprises.
- 0 fiche issue des autres sources dans le dernier état livré.
- Premier cycle live complet toujours requis sur un runner réseau.
