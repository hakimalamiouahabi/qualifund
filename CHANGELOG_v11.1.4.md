# CHANGELOG — LEYTON RADAR v11.1.4

Date : 2026-09-22

## Corrections de cohérence
- Règle métier **J+1** conservée : J0 exclu, J+1 accepté, ou permanence officiellement vérifiée.
- Métadonnées publiques alignées sur la version du registre : `11.1.4`.
- Ancien compteur ambigu `count: 756` corrigé : le snapshot sérialisé contient réellement **676 fiches**.
- `site/data/sources.json`, `manifest.json`, `status.json`, les bibliothèques JSON publiques et le bootstrap navigateur sont synchronisés avec le registre maître.
- User-Agent HTTP débarrassé de la version historique `10.0`.

## Rapport quotidien
- Correction P0 : en absence de `library.previous.json`, les 676 fiches du snapshot ne sont plus déclarées artificiellement comme nouvelles.
- Au premier rapport, la baseline est initialisée sur le snapshot courant et les mouvements sont à zéro.
- `update-library.mjs` sauvegarde désormais le snapshot précédent avant remplacement afin de permettre un vrai diff quotidien au cycle suivant.

## Vérifications Web officielles du 2026-09-22
- ADEME : **71 dispositifs** affichés dans le catalogue entreprises.
- DGE : **64 résultats** sur la page AAP/AMI.
- Pays de la Loire : **180 résultats** dans le catalogue régional.
- Île-de-France : dataset officiel `aides-appels-a-projets` confirmé.
- Occitanie : dataset officiel `aides-et-appels-a-projets-de-la-region-occitanie@occitanie` confirmé.
- Région Sud : flux/publication « flux json » confirmé et mis à jour le 10 septembre 2026.
- Aides Entreprises : stock complet téléchargeable confirmé ; JSON observé à 51,48 Mo, mise à jour du stock au 1er août 2026.

## État process
- 145 sources configurées : 110 d'ingestion, 35 de contrôle.
- Snapshot courant : 676 fiches, toutes issues du bootstrap Aides Entreprises ; 0 fiche issue d'un cycle live multi-sources.
- 0/676 strictement vérifiées ; 86 avec CdC ; 166 avec calendrier.
- Le premier cycle réseau complet reste nécessaire pour passer Gate 3 de READY à un état mesuré.
