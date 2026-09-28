# Validation Web officielle — 22 septembre 2026

Cette note documente les contrôles Web utilisés pour durcir le registre. Les nombres observés servent de repères de couverture, pas de promesse sur le nombre final de fiches Qualifund après filtrage et déduplication.

- **Aides Entreprises** : les fichiers CSV/JSON/XML permettent de récupérer la base complète des aides aux entreprises. Stock « Aides » observé mis à jour le 22/09/2026 ; JSON annoncé à 51,96 Mo sur la page de stock. Le fichier est trop volumineux pour être chargé intégralement dans le runtime de ce chat. Le profil « PME tous secteurs » compte 2 415 dispositifs et le profil « ETI et grande entreprise » 626. Ces ensembles peuvent se chevaucher et incluent des natures hors périmètre Qualifund.
- **ADEME** : 71 dispositifs visibles dans le catalogue entreprises.
- **DGE** : 64 résultats sur la page AAP/AMI ; la DGE précise que cette liste n’est pas exhaustive de tous les AAP/AMI de l’État.
- **Pays de la Loire** : 180 résultats dans le catalogue régional.
- **Île-de-France** : 346 aides au total, dont 171 associées au public « Professionnel ».
- **Normandie** : 265 résultats dans le catalogue régional/européen.
- **Occitanie** : 353 résultats dans le catalogue aides et appels à projets.
- **ANR France 2030** : 6 appels ouverts observés sur la page dédiée au moment du contrôle.

## Correction de doctrine
Le snapshot actuel de 676 fiches est un bootstrap mono-source, pas une preuve d’exhaustivité multi-sources. Inversement, il est incorrect d’affirmer avant le premier cycle complet que le corpus final filtré dépassera nécessairement 2 000 fiches. Le volume final doit être mesuré après collecte, déduplication, restriction aux instruments SUBVENTION / AVANCE_REMBOURSABLE / PRET, profils START-UP / PME / ETI / GE, portée nationale/régionale et règle J+1.

## Aides Territoires — validation complémentaire v11.1.7
- L'API publique Aides Territoires expose notamment `targeted_audiences`, `aid_types`, `perimeter`, `submission_deadline`, taux de subvention, montants de prêt/avance récupérable et URL d'origine.
- Le code public définit explicitement l'audience `private_sector` = `Entreprises privées`.
- Les types financiers exposés comprennent `grant`, `loan` et `recoverable_advance`.
- Décision Qualifund : ingestion filtrée de ces instruments pour les entreprises privées, en conservant les aides à périmètre national/régional exploitable ; les aides réservées aux collectivités et l'ingénierie seule sont exclues.
- Cette décision configure le connecteur mais ne vaut pas preuve d'un cycle live réussi.
