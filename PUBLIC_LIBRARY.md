# Bibliothèque publique QUALIFUND — v12.2.0

## URL cible après déploiement

`https://<domaine-qualifund>/bibliotheque/`

La page expose :
- recherche publique ;
- `qualifund-library.json` ;
- `qualifund-library.csv` ;
- `status.json` ;
- liens vers les sources officielles de chaque fiche.

## Fréquence
- collecte complète automatisée : chaque jour à **02:00 Europe/Paris** ;
- `workflow_dispatch` : relance administrateur à la demande ;
- bouton « Rafraîchir » dans l'application : recharge immédiatement la dernière bibliothèque publiée.

## Règles
- instruments : SUBVENTION, AVANCE_REMBOURSABLE ;
- recommandation temporelle : échéance >= J+1 ou dispositif permanent officiellement confirmé ;
- date inconnue : non recommandée avant vérification ;
- dernière version valide conservée en cas d'anomalie d'une source.
