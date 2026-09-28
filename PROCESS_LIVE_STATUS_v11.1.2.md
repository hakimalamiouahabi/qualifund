# LEYTON RADAR — état live v11.1.2

## Décision métier confirmée
- Calendrier : **échéance >= J+1** ou dispositif permanent explicitement vérifié.
- J0 est exclu ; J+1 est inclus.

## État technique
- 145 sources configurées.
- 110 sources d'ingestion et 35 sources de contrôle.
- 676 fiches dans le bootstrap courant, toutes issues d'Aides Entreprises.
- 0 source exécutée dans `coverage.json` du dernier état livré.
- 0 fiche hors bootstrap Aides Entreprises dans la bibliothèque livrée.
- 0/676 fiche strictement `VERIFIE`.
- 86 fiches avec CdC ; 166 avec calendrier.

## Priorité
1. Exécuter un premier cycle live complet des 110 sources d'ingestion.
2. Mesurer imports bruts, succès/échecs et corpus non-bootstrap.
3. Dédupliquer et valider le corpus réel.
4. Monter la couverture documentaire et les preuves par champ.
5. Recette consultant puis déploiement permanent.
