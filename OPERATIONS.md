# Exploitation FUNDING RADAR

## Cycle actif

La collecte planifiée s’exécute **deux fois par mois, le 1er et le 15 à 02:00 Europe/Paris**, uniquement sur le guichet ou la région défini dans `config/collection-lock.json`. **Aucun push GitHub ne déclenche de collecte.** Le lancement manuel reste réservé à une maintenance ou une recertification exceptionnelle.

Le chemin de production est :

`gate syntaxe/tests/schéma → purge déterministe → préflight → collecte officielle → contrôle de complétude → enrichissement officiel → certification → audits → tests finaux → commit → build public certifié`.

La collecte n’utilise **ni LLM, ni moteur de recherche externe, ni API payante**. Les seules preuves admises pour la collecte et la certification sont les sources officielles directes configurées.

## Atomicité des sources

Chaque source est traitée comme un snapshot atomique. Si son volume, son rendement, son compteur officiel ou son extraction ne satisfait pas les seuils calibrés, **aucune donnée partielle de ce cycle n’est fusionnée**. Le dernier snapshot valide reste inchangé et le cycle est signalé en échec.

Tant que le verrou est actif, les autres guichets/régions ne sont ni recollectés ni enrichis. Leur empreinte est contrôlée avant et après le cycle.

## Passage au guichet suivant

Le verrou ne change qu’après :
- collecte officielle sans erreur inexpliquée ;
- comptabilité complète des URLs du référentiel maître ;
- absence de titre générique, lien parasite ou agrégateur ;
- conformité des pages officielles directes ;
- contrôles de complétude et de seuils réussis ;
- certification `PASS` liée à la configuration, au code et au snapshot exact des données ;
- audit profond sans P0 ;
- tests et build de production réussis.

**Ordre actuel : Bpifrance PASS → ADEME PASS → Auvergne-Rhône-Alpes (cycle actif).** Les autres régions et fonds restent gelés jusqu’au PASS AURA sur le socle official-only.
