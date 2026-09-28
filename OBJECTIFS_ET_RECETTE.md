# LEYTON RADAR — objectifs et critères de recette

## Objectif 1 — bibliothèque vérifiée

Le registre maître comprend les sources nationales et les 18 régions françaises auditées. Une source `configurée` n'est jamais assimilée à une source `collectée`. Les statuts à suivre sont : configurée, accessible, collectée, enrichie, vérifiée.

## Objectif 2 — cartographie mise à jour

- Mise à jour complète quotidienne : **02:00 Europe/Paris**.
- Mise à jour manuelle : bouton applicatif via endpoint serveur sécurisé.
- Rapport : nouvelles aides, dispositifs modifiés, nouvelles relèves, aides closes/obsolètes/disparues, erreurs de source.
- Une source défaillante ne remplace pas sa dernière version valide.

## Objectif 3 — critères et modalités

La fiche senior standardisée impose les champs du cahier des charges métier et une preuve par champ sensible. Les preuves sont hiérarchisées :

- **A** : CdC, règlement, convention ou annexe financière officielle ;
- **B** : page officielle financeur/opérateur ;
- **C** : base publique officielle transversale ;
- **D** : source secondaire de découverte uniquement.

## Objectif 4 — entreprise

SIREN/SIRET → API Recherche d'entreprises / RNE / Sirene selon disponibilité → enrichissement Pappers facultatif → fusion avec données internes client (CA, bilan, effectif réel, groupe, autonomie, sites, historique d'aides, capacité de financement).

## Objectif 5 — projet

Le parcours collecte : secteur, NAF, région/site, résumé, objectifs, typologies, maturité, budget, dépenses, calendrier, partenaires/consortium, impacts, emplois, environnement, numérique/IA, plan de financement et autres aides.

## Objectif final — étude de faisabilité

Une aide n'est affichée que si :

1. aucune incompatibilité bloquante documentée n'est détectée ;
2. la prochaine échéance est >= J+1 ou le caractère permanent est vérifié ;
3. la **pertinence projet est >= 85 %**.

Le score de pertinence est indépendant de la qualité documentaire. Il est calculé sur : objectifs/thématiques 30, type de projet 20, dépenses/travaux 20, secteur/cas d'usage 10, maturité 10, impacts/critères de sélection 10.

La confiance documentaire est affichée séparément et ne peut jamais faire passer artificiellement une aide au-dessus de 85 %.
