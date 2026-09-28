# Exploitation et maintenance automatique

- **Chaque jour à 02:00 Europe/Paris** : préflight des sources, collecte complète, enrichissement, QA, delta quotidien et publication.
- **À la demande** : le même cycle complet peut être déclenché via `workflow_dispatch` ou, sur un hébergement serverless configuré, via `api/refresh.js`.
- **À chaque cycle** : schéma, tests, QA de volume, santé des sources, journal des changements, synchronisation des artefacts publics et reconstruction de l’index de recherche.
- **En cas de panne source** : conservation de la dernière version valide, compteur d’échecs consécutifs, aucune suppression silencieuse.
- **En cas de modification de PDF** : nouvelle empreinte SHA-256 et fiche repassée à contrôler si des champs critiques changent.
