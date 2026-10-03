# FUNDING RADAR | Leyton

FUNDING RADAR consolide les aides, subventions, avances remboursables, prêts à taux zéro et appels à projets utiles aux entreprises en France à partir de **sources publiques officielles directes**.

## Stratégie de collecte

Le projet fonctionne sans LLM pour la collecte et la mise à jour. Chaque guichet ou région est traité **un par un** :

1. verrou exclusif sur un guichet/région ;
2. collecte directe de ses sources officielles ;
3. extraction structurée des fiches et documents ;
4. audit exhaustif des URLs découvertes ;
5. contrôle des titres, liens directs, dates, critères et documents ;
6. certification bloquante ;
7. création d’un point de restauration certifié ;
8. passage au guichet/région suivant.

Les autres guichets sont cryptographiquement gelés pendant le cycle actif.

## État du chantier

- **ADEME : certifié PASS** selon le référentiel officiel Entreprises.
- **Bpifrance v2 : certifié PASS** selon les référentiels maîtres officiels et le contre-audit multi-moteurs.
- **Auvergne-Rhône-Alpes : cycle régional actif** sur le catalogue officiel filtré Entreprise ; certification bloquante avant passage à la région suivante.
- **FEDER / FEADER / FSE+ / FTJ / ANR** restent séparés et gelés jusqu’à leur cycle dédié.

La publication publique suit la règle **CERTIFIED_SOURCE_ONLY** : une source non certifiée PASS et une fiche insuffisamment prouvée restent en quarantaine. Le stock brut interne n’est pas exposé directement ; le build produit un corpus segmenté certifié et un export CSV.

## Politique source

Sont admises comme sources de vérité : pages officielles de guichet/région, API/Open Data officiels, flux RSS officiels et documents réglementaires officiels. Les agrégateurs généralistes ne sont pas utilisés pour alimenter la bibliothèque.

Une fiche n’invente jamais une donnée absente : la valeur reste à vérifier et renvoie vers la source ou le CdC lorsqu’il existe.

## Exécution

```bash
npm ci
npm test
npm run audit:sources
npm run preflight:sources
npm run update:full
npm run certify:active
npm run validate
```

Le registre maître est `config/sources.json`. Le verrou courant est `config/collection-lock.json`. Les données publiées sont dans `site/data/`.
