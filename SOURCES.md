# Sources FUNDING RADAR

Le registre machine est `config/sources.json`.

La politique active est **DIRECT_OFFICIAL_ONLY** : seules les sources publiques officielles directement rattachées au guichet ou à la région peuvent alimenter les fiches.

Les agrégateurs nationaux généralistes sont exclus de l’ingestion. Les sources de contrôle qui ne produisent pas de fiches ne sont conservées que lorsqu’elles servent un contrôle nécessaire à la stratégie courante.

Le traitement est séquentiel : **un guichet ou une région à la fois**. Le verrou courant se trouve dans `config/collection-lock.json`.

Au 30/09/2026 :
- Bpifrance : certifié ;
- ADEME : actif ;
- autres guichets et régions : gelés.
