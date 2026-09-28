# HTML autonome live v12.2.0

## Utilisation

Ouvrir `LEYTON-RADAR-v12.2.0-AUTONOME-LIVE.html` par double clic dans Edge ou Chrome.

Aucune installation locale ni droit administrateur n'est requis.

## Mise à jour

Trois mécanismes sont disponibles :

1. actualisation automatique à l'ouverture lorsque la dernière actualisation locale a plus de 20 heures ;
2. bouton `Mettre à jour la cartographie` ;
3. bouton `Importer stock officiel` permettant de sélectionner le fichier `aides.json` officiel d'Aides Entreprises.

Si l'onglet reste ouvert, le fichier vérifie également la fenêtre 02:00 Europe/Paris et peut déclencher le rafraîchissement quotidien.

## Résilience

Une source inaccessible ne supprime jamais la dernière bibliothèque valide. Une mise à jour d'une source remplace uniquement le sous-corpus de cette source lorsqu'un volume exploitable a réellement été obtenu.

## Limite physique du navigateur

Un fichier `.html` fermé ne peut pas s'exécuter en arrière-plan. De plus, certaines pages officielles refusent les appels cross-origin depuis un fichier local. C'est pourquoi le mode autonome utilise en priorité les jeux/agrégateurs publics compatibles et prévoit l'import du stock officiel. L'exécution exhaustive de tous les crawlers HTML/PDF nécessite le pipeline hébergé fourni dans le ZIP.
