# LEYTON RADAR v12.2.0

# LEYTON RADAR

> **Release courante : v12.2.0 — Final Release Candidate.**  
> Sources : 145 (111 ingestion + 34 contrôle) · règle calendrier J+1 · pertinence >=85 % · validation finale pilotée par `PRODUCTION_READINESS.md`.  
> Voir `FINAL_RELEASE_v12.2.0.md` et `FINAL_ACTIVATION.md` pour le statut et l’activation production.

**Aides & financements publics**  
**Cartographie · Faisabilité · Veille**

LEYTON RADAR est une application web destinée à la qualification senior des aides publiques françaises pour les **START-UP, PME, ETI et GE**. Le périmètre financier couvre **subventions, avances remboursables et prêts à taux zéro explicitement documentés**. Les prêts classiques avec intérêts restent exclus.

## Finalité

1. Maintenir une bibliothèque nationale/régionale alimentée par le registre maître des sources publiques.
2. Reconstruire et contrôler la bibliothèque automatiquement chaque jour à **02:00 Europe/Paris** et à la demande.
3. Construire une **fiche réglementaire normalisée et sourcée** pour chaque aide/AAP.
4. Enrichir la fiche entreprise à partir d'un **SIREN/SIRET**, avec sources publiques officielles prioritaires et Pappers facultatif côté serveur.
5. Qualifier un projet et n'afficher dans la cartographie finale que les dispositifs **sans incompatibilité bloquante** et présentant une **pertinence projet >= 85 %**.

## Trois indicateurs séparés

- **Éligibilité** : CONFORME / À VÉRIFIER / NON CONFORME.
- **Pertinence projet** : score 0–100 % basé uniquement sur l'adéquation projet/dispositif. Seuil d'affichage : 85 %.
- **Confiance documentaire** : qualité et couverture des preuves officielles. Elle n'ajoute aucun point à la pertinence.

Un score de 92 % signifie donc « forte adéquation avec le projet », jamais « 92 % de probabilité d'obtenir l'aide ».

## Fiche AAP / aide

La fiche standard comprend : objectif, thématiques, bénéficiaires, type d'aide, répartition SUB/AR/PTZ, assiette min/max, montant d'aide min/max, taux par taille, portée, région, financeur, opérateur, dépenses éligibles et exclues, projets attendus, prérequis, critères de sélection, points de vigilance, ouverture, clôture, relèves, prochaine relève, modalités de versement, remboursement AR/PTZ, aides d'État/cumul, CdC/règlement, annexes, source officielle, dernière vérification et preuve par champ.

Toute donnée publique manquante reste : **NON DOCUMENTÉ — À VÉRIFIER**.

## Mise à jour

Le workflow `.github/workflows/update-and-deploy.yml` :

- s'exécute tous les jours à **02:00 Europe/Paris** ;
- exécute les connecteurs ;
- enrichit les fiches avec les pages officielles et PDF ;
- exécute les tests et contrôles QA ;
- produit un rapport delta quotidien ;
- publie `site/` sur GitHub Pages.

Le bouton **Mettre à jour la cartographie** utilise `api/refresh.js` uniquement lorsqu’un endpoint serverless sécurisé est déployé. Sur GitHub Pages, la collecte planifiée reste indépendante du navigateur. Dans le fichier HTML autonome v12.2, le bouton lance une actualisation navigateur des agrégateurs publics compatibles et permet aussi l’import du stock officiel Aides Entreprises. Les secrets GitHub ne sont jamais placés dans le navigateur.

## Déploiement

### GitHub Pages

Idéal pour la bibliothèque publique et la mise à jour automatique. Le workflow planifié ne nécessite aucune action de l'utilisateur après configuration du dépôt.

### GitHub + Vercel

Recommandé si l'on souhaite aussi le déclenchement manuel depuis l'application : `api/refresh.js` appelle GitHub Actions côté serveur. Variables requises :

- `GITHUB_REPOSITORY=owner/repo`
- `GITHUB_TOKEN=<token limité au workflow>`
- `GITHUB_BRANCH=main`
- `PAPPERS_API_TOKEN=<facultatif>`

## Données entreprise

`api/company.js` interroge d'abord l'API Recherche d'entreprises de la DINUM. Si `PAPPERS_API_TOKEN` est configuré, Pappers est utilisé uniquement comme enrichissement complémentaire et non comme dépendance bloquante.

## Confidentialité

Les données de projet saisies dans l'interface restent dans le navigateur (`localStorage`) dans la version statique. Elles ne sont jamais publiées dans la bibliothèque.
