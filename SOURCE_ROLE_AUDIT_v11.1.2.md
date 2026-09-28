# Audit des rôles de sources — v11.1.2

## Règle
Une source `control-only` n'est pas comptée comme source d'ingestion et ne doit jamais masquer l'absence de collecte réelle.

## API encore en contrôle seul
- `aides_territoires` : contrôle national large ; périmètre plus large que les seules entreprises.
- `bretagne_opendata`, `cvl_opendata`, `corse_opendata`, `reunion_opendata` : points d'entrée génériques de catalogues Open Data, sans dataset aide unique explicitement fixé dans cette configuration.
- `occitanie_dataset_aides` : doublon de contrôle du connecteur `occitanie` déjà configuré en `opendatasoft`.
- `pdl_opendata_interventions` : doublon de contrôle de la source Pays de la Loire déjà reliée au dataset `234400034_fluxinterventionsprod_pdl` via la source principale.
- `pdl_open_data_portal` : portail générique de contrôle.
- `paca_aides_json` : URL nommée « flux-json » mais exposant actuellement un catalogue HTML ; la source principale Région Sud reste le collecteur web de référence.

## Conséquence
Le volume utile doit être mesuré sur les sources d'ingestion effectivement exécutées, les imports bruts et le corpus non-bootstrap, pas sur le nombre total de lignes du registre.
