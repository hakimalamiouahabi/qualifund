# Activation finale v12.2.0

Le code est prêt à s'auto-valider dès qu'il dispose d'un compte GitHub autorisé et d'un runner réseau.

## Windows / PowerShell

```powershell
cd LEYTON-RADAR-v12.2.0-FINAL-RELEASE
gh auth login
.\bootstrap\bootstrap-github.ps1 -RepoName leyton-radar -Visibility public -Watch
```

## macOS / Linux

```bash
cd LEYTON-RADAR-v12.2.0-FINAL-RELEASE
gh auth login
bash bootstrap/bootstrap-github.sh leyton-radar public
```

Le bootstrap :
1. crée ou rattache le dépôt ;
2. pousse `main` ;
3. active GitHub Pages avec `build_type=workflow` ;
4. déclenche `update-and-deploy.yml` en collecte complète ;
5. le workflow collecte, teste, enrichit, déploie, effectue les smoke tests et exécute `certify:production`.

Si le dépôt reste privé, GitHub Pages peut dépendre du plan GitHub du compte. Pour une activation gratuite universelle, utiliser un dépôt public.
