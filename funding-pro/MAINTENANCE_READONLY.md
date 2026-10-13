# Maintenance contrôlée — GitHub, Cloudflare D1, WordPress

## Inventaire vérifié le 13 octobre 2026
Le compte Cloudflare expose **4 bases distinctes**, dont `artscan-rd`, `artscan-rd-staging`, `ap-leyton-prod` et `mnin-nbda-staging`. AUCUNE ne porte directement le nom du dépôt Funding Radar. Une taille de fichier D1 ne suffit pas à conclure qu'une base est encombrée. Les métriques `num_tables` retournées par la liste ne prouvent pas l'absence de tables ; ne pas en déduire un diagnostic sans requête de schéma.

L'application WordPress.com accessible représente un site `MNIN BDA` sur environnement de staging. Aucune écriture WordPress autorisée dans cette phase.

## Régime d'épuration
1. **Lecture seule** : métadonnées / tables / index / anciens journaux et artefacts, secret leaks sur clone sans sortie publique.
2. **Qualification** : distinguer production, staging et autres projets ; identifier propriété, rétention légale, présence de dossiers clients et impact.
3. **Sauvegarde et restauration réellement testée** : exigence avant opération sensible.
4. **Proposition** : rapport diff, gain chiffré mesuré, plan de retour arrière.
5. **Approbation explicite par lot et cible exacte**.
6. **Exécution hors branche principale avec droits minimaux** ; jamais de suppression par ce module.

## Outils open source possibles
- `cloudflare/workers-sdk` : Wrangler, inspection/export D1 lorsque les permissions et quotas l'autorisent.
- `simonw/sqlite-utils` et `sqlfluff/sqlfluff` : audit SQLite/SQL local.
- `github/git-sizer` : inventaire des objets Git volumineux.
- `gitleaks/gitleaks` : inspection des secrets sans publication des résultats sensibles.
- `wp-cli/wp-cli` : inspection WordPress *seulement si l'hébergement/les permissions le permettent*.
- `OpenRefine/OpenRefine` : traitements sur exports anonymisés dans un environnement approuvé.

L'inventaire des outils n'est pas une installation effective. Ne pas utiliser `git-filter-repo` pour réécrire une branche partagée sans autorisation et stratégie de restauration.

## Pourquoi aucune purge automatique ?
Les opérations `DELETE`, `VACUUM`, `DROP`, `git push --force`, `wp db clean` et effacement de médias WordPress n'appartiennent PAS aux opérations autorisées. L'accord général sur l'autonomie n'est pas un accord irrévocable pour des suppressions irréversibles.
