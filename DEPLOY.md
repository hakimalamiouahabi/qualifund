# Déploiement — URL unique

## GitHub Pages + GitHub Actions
Cible adaptée à la bibliothèque publique et à la collecte planifiée.

1. Créer un dépôt GitHub et pousser le contenu de ce dossier. **Le premier push déclenche déjà le cycle complet de collecte, QA, UAT et déploiement.**
2. Dans **Settings → Pages**, choisir **GitHub Actions** comme source.
3. Le workflow `LEYTON RADAR — collecte, QA et publication` publie automatiquement `site/`, exécute les smokes post-déploiement puis republie la readiness finale.
4. L’URL devient `https://<organisation>.github.io/<repo>/`.
5. Sur GitHub Pages, les fonctions `/api/*` ne sont pas disponibles : l’interface désactive donc le déclenchement serveur et utilise directement l’API Recherche d’entreprises ouverte pour le SIREN.

## Vercel + GitHub Actions
Utiliser cette cible si le bouton **Mettre à jour la cartographie** doit être actif. `api/refresh.js` nécessite `RADAR_ADMIN_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_TOKEN` et éventuellement `GITHUB_BRANCH`.

Aucun secret ne doit être placé dans `site/`.
