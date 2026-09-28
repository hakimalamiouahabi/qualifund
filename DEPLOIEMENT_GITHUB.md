# Déploiement GitHub — LEYTON RADAR

Le projet est prêt pour un dépôt GitHub dont la branche par défaut est `main`.

## Publication automatique

Le workflow `update-and-deploy.yml` :

- collecte à 02:00 heure de Paris ;
- produit les données `site/data/` ;
- produit le rapport `site/bibliotheque/rapports/latest.*` ;
- commit les données si elles changent ;
- déploie `site/` vers GitHub Pages.

## Déclenchement depuis l'application

GitHub Pages est statique : un secret GitHub ne doit jamais être inclus dans le JavaScript client. Pour rendre le bouton de collecte réellement actif, déployer le projet sur une plateforme supportant les fonctions serverless (par exemple Vercel) et configurer `api/refresh.js` avec `GITHUB_REPOSITORY` et `GITHUB_TOKEN` côté serveur.

Le dépôt GitHub demeure alors la source de vérité, GitHub Actions reste le moteur de collecte, et l'URL Vercel fournit le bouton de déclenchement sécurisé.
