# CHANGELOG v12.2.0

Date de consolidation : 23 septembre 2026.

## Périmètre financier amendé

- `SUBVENTION` : inclus.
- `AVANCE_REMBOURSABLE` : incluse.
- `PRET_TAUX_ZERO` : inclus uniquement lorsque le caractère sans intérêt / taux zéro / prêt d'honneur est explicitement documenté.
- Prêts classiques portant intérêt : exclus.

## Sources et corpus

- Registre : 145 sources, dont 143 officielles.
- Couverture territoriale : 18/18 régions.
- 111 sources d'ingestion et 34 sources de contrôle.
- Deux sources officielles PTZ sont devenues ingestives : FOSTER Région Occitanie et Prêt FEDER Sud Innovation.
- Snapshot livré : 678 fiches, dont 676 issues du bootstrap Aides Entreprises et 2 fiches PTZ officielles ajoutées avec preuve B.

## HTML autonome live

Le fichier unique `LEYTON-RADAR-v12.2.0-AUTONOME-LIVE.html` :

- embarque l'intégralité du snapshot livré ;
- tente une actualisation publique à l'ouverture lorsqu'une mise à jour est nécessaire ;
- propose un bouton de mise à jour manuelle ;
- sait interroger les agrégateurs publics compatibles depuis le navigateur ;
- permet d'importer directement le stock JSON officiel Aides Entreprises lorsque CORS bloque son téléchargement ;
- conserve la bibliothèque mise à jour dans IndexedDB lorsque le navigateur l'autorise ;
- reste utilisable pour la session courante si ce stockage est bloqué ;
- déclenche une actualisation à 02:00 Europe/Paris lorsque l'onglet reste ouvert.

Un fichier HTML fermé ne peut pas exécuter du code en arrière-plan. Le cycle exhaustif des 111 sources reste donc assuré par le runner hébergé lorsqu'il est activé.

## Qualité

- Scans vides non destructifs.
- Ordre multi-source neutralisé pour le cycle de vie.
- Règle J+1 conservée.
- Permanence recommandable uniquement avec preuve calendrier A/B.
- Priorités : maximum 8, uniquement vérifiées/conformes et pertinence >=85 %.
- Pistes : maximum 6, explicitement à sécuriser.
