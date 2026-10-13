# FUNDING PRO — bridge ChatGPT Pro / financements publics

**Statut : prototype isolé, non déployé, non fusionné.** Ce dossier est indépendant de FUNDING RADAR et ne modifie ni sa collecte, ni ses certifications, ni ses publications.

## Périmètre exclusif
Demandes de **subventions** et **avances remboursables** françaises : FEDER, régions, Bpifrance, ADEME, appels à projets publics comparables. **Pas de prêts commerciaux, crédits d'impôt, aides privées, assurances ou prêts à taux zéro** dans ce moteur.

## Exécution sans service payant ni API d'IA
- ChatGPT Pro standard : rédaction experte interactive à partir d'un dossier **validé**, via les connecteurs natifs autorisés. Aucune promesse de MCP personnalisé avec écriture.
- Node.js 22 en local ou GitHub Actions sur demande : préparation déterministe et contrôle financier, sans LLM.
- Cloudflare : aucune base ni Worker créée ou modifiée par cette branche.
- WordPress : aucune modification ni lecture de données personnelles.
- **Aucune donnée confidentielle dans ce dépôt public.** Les dossiers client doivent rester locaux ou dans un espace privé dont les permissions ont été vérifiées.

## Démarrage
```bash
node funding-pro/engine.mjs funding-pro/fixtures/fictional-case.json /tmp/dossier-brouillon.md
python3 -m unittest discover -s funding-pro/tests -p 'test_*.py'
node --test funding-pro/tests/engine.test.mjs
python3 funding-pro/sqlite_audit.py /chemin/vers/une-copie-sqlite.db
```
Le premier exemple utilise des données **fictives** pour les tests, jamais un dossier réel.

## Principes techniques
1. Toute condition d'éligibilité, date limite, dépense admissible, intensité/plafond d'aide doit avoir sa **preuve officielle datée et validée par un humain** ; sinon le champ est À VÉRIFIER.
2. Le moteur n'invente ni dispositif, ni taux, ni promesse de financement. Les montants restent un scénario de travail fondé sur les données d'entrée.
3. Aucun dépôt automatique d'une demande ou changement de dispositif.
4. L'audit SQLite est strictement **lecture seule sur copie** ; aucune action de suppression, purge, optimisation de base, réécriture Git ou modification WordPress.
5. Le catalogue existant des **700 rôles** est seulement référencé par son ID et son SHA Git : **700 rôles catalogués ≠ 700 IA en exécution**.

## Connexions et logiciels libres
Voir `integrations.json` pour les dépôts publics, les outils accessibles et les **statuts réels**. La présence dans ce catalogue ne signifie pas installation ni connexion automatique à ChatGPT.

## Conditions de mise en production
Validation humaine, revue de sécurité, confidentialité des dossiers, sauvegardes/restauration, sources officielles contrôlées, tests de non-régression et autorisations propres à chaque service.

## Connexions officielles supplémentaires
- `official_apis.mjs` prépare l'interrogation HTTPS des API publiques officielles **Recherche d'entreprises** et **Catalogue data.gouv.fr**, avec contrôle de délai et réduction des données.
- Les tests utilisent des réponses simulées. **Aucun dossier réel ni taux d'aide n'est récupéré ou déduit automatiquement**.
- `sqlite-utils==4.2.1` et `sqlfluff==4.4.0` sont exécutés sur un runner GitHub Actions éphémère avec une base fictive. Ils ne sont pas installés dans ChatGPT.

## Interface réparée : utilisation sans ligne de commande

- **Ouvrir** `funding-pro/preview/Funding_Pro_Atelier.html` dans un navigateur. Aucune installation : formulaires, budget, alertes, import/export et copier-coller vers ChatGPT Pro.
- **Mode 100 % chat :** lire `funding-pro/CHATGPT_PRO_MODE_EMPLOI.md`, puis écrire « Funding Pro : prépare mon dossier de subvention ou d'avance remboursable » dans ChatGPT. Les profils mobilisés sont ceux du référentiel MNIN existant, sans nouveau profil ni sessions IA indépendantes.
- **Tests :** `funding-pro/tests/atelier-ui.test.mjs` vérifie le chargement structurel et la syntaxe JS ; les exports ont également été testés dans Chromium local sur des données fictives. Cette page reste un **prototype HTML statique**, non un site déployé.
- **Sécurité :** les données saisies dans l'interface ne sont ni enregistrées automatiquement ni envoyées sur Internet ; les exports sont des fichiers sensibles à protéger localement. Ne jamais publier un dossier réel dans GitHub public.
