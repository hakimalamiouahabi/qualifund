# Leyton_Veilles A&S — corrections et limites vérifiées

## Corrections

- Identité demandée, marque Leyton agrandie, champs et navigation de 16 px, notes de 14 px. Mise en page adaptée au mobile.
- Recherche par mots indépendants, accents et alias BPI. Le champ conserve son identité DOM et son focus ; pagination à 50 résultats ; annulation de la recherche différée lors d’un changement de rubrique.
- Prospection possible à partir de l’activité, du NAF ou d’une thématique, sans longueur minimale de description.
- Suppression des pourcentages affichés et des pondérations présentées par financeur. Le classement interne reste une aide à la recherche textuelle, pas une méthode de sélection officielle ni un modèle prédictif.
- Données projet absentes neutralisées. Catégories non exhaustives, assiette budgétaire incertaine, région absente et simples mentions de consortium ne déclenchent plus d’exclusion automatique.
- Aucune conformité globale quand des conditions restent à instruire. Les contradictions territoriales explicites restent bloquantes.
- Rétablissement des fonctions manquantes de rendu des résultats et des fiches.
- Dates d’intégration visibles dans la veille, distinctes des dates de publication.
- Référence complémentaire Bpifrance « Aide pour le développement de l’innovation », sans rattachement supposé à France 2030. Déduplication sur URL officielle/identifiant lors de la construction Cloudflare.

## Validation

12 tests métier et de rendu réussis. Parcours Chromium local vérifié : saisie lente avec conservation du champ, résultat Bpifrance, changement de rubrique pendant une recherche différée, analyse sans description, viewport mobile 390 px sans débordement. Aucune erreur JavaScript sur ces parcours. Construction en quatre fragments sous la limite des fichiers Cloudflare.

## Limites de la base

Snapshot publié contrôlé : 2 202 enregistrements avant l’ajout complémentaire. 525 liens principaux renvoient au stock général Aides Entreprises plutôt qu’à une page propre au dispositif. Ce point n’est pas résolu par une correction graphique. Le stock consulté confirme l’absence de source détaillée pour la fiche ae_8864.

La fiche « Aide aux projets d’innovation » (ae_8864) concerne la CC des Montagnes du Giffre. Ne pas l’attribuer à Bpifrance à partir du seul titre. La base comporte aussi des contenus agrégés, des critères non structurés et des pages de catalogue : son exhaustivité, l’ouverture réelle de chaque aide et la fiabilité de tous les critères ne sont pas certifiées.

La qualification complète nécessite le règlement propre à chaque dispositif, la preuve des conditions applicables, les caractéristiques du projet, les dépenses et leur calendrier. Les points ADEME, Bpifrance et FEDER affichés constituent des axes d’instruction, jamais des barèmes officiels.

## Références consultées le 28 septembre 2026

- https://www.bpifrance.fr/catalogue-offres/aide-pour-le-developpement-de-linnovation
- https://www.bpifrance.fr/nos-actualites/aide-pour-le-developpement-de-linnovation-pour-qui-pour-quoi
- https://www.ademe.fr/nos-missions/financement/
- https://www.ademe.fr/wp-content/uploads/2025/12/2025-12-conditions-generales-france-2030.pdf
- https://www.europe-en-france.gouv.fr/fr/programmes-europeens-2021-2027
- https://data.aides-entreprises.fr/files/aides.json
