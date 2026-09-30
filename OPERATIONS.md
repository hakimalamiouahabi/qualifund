# Exploitation FUNDING RADAR

## Cycle actif

La collecte planifiée s’exécute chaque jour à 02:00 Europe/Paris, mais **uniquement sur le guichet ou la région défini dans `config/collection-lock.json`**.

Le cycle est :

`préflight → collecte → extraction → enrichissement → audit → tests → certification du verrou → commit des données`.

Tant que le verrou est actif, les autres guichets/régions ne sont ni recollectés ni enrichis. Leur empreinte est contrôlée avant publication.

## Passage au guichet suivant

On ne change le verrou qu’après :
- collecte sans erreur d’extraction inexpliquée ;
- audit de toutes les URLs découvertes ;
- absence de titre générique ou de lien parasite ;
- conformité des liens directs officiels ;
- certification `PASS` ;
- branche de sauvegarde certifiée.

Le guichet actif au 30/09/2026 est **ADEME**. Bpifrance est déjà certifié.
