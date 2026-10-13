# Sources officielles Funding Pro — dossier des dispositifs et preuves

## Résultat actuel — 13 octobre 2026

**Statut : collecte de métadonnées publiques testée sur GitHub Actions. Ce n'est pas une base Cloudflare déployée.**
Le premier run stable a créé **24 références** et indexé **3 liens de documents** en SQLite. Une référence peut être :
- un **portail officiel** (point de départ, pas une subvention),
- un **jeu de données** public (par exemple historique d'aides ADEME, pas la preuve d'un AAP ouvert),
- un **document source / guide / cahier des charges** avec URL officielle,
- une **fiche d'aide à qualifier**, uniquement lorsqu'une source renvoie effectivement ce type d'objet.

### Sept sources ou canaux catalogués, statuts vérifiés

1. **data.gouv.fr** : API de catalogue interrogée en direct sans clé (OK) ; renvoie des jeux de données, parfois avec des liens vers PDF.
2. **ADEME Data Fair** : API de catalogue interrogée en direct sans clé (OK) ; métadonnées ADEME, pas les conditions d'un appel ouvert.
3. **Aides-territoires** : API officiellement documentée, mais notre appel anonyme à \`/api/aids/\` reçoit **HTTP 401** le 13/10/2026. Aucun accès disponible sans autorisation adéquate. Service désormais prioritairement orienté vers collectivités/établissements publics ; ce n'est pas le référentiel principal d'aides aux entreprises.
4. **FEDER / Europe-en-France** : portail officiel national, programmes régionaux et guides ; **aucune API exhaustive d'appels régionaux vérifiée**.
5. **ADEME AGIR** : catalogue officiel des appels et aides + liens vers guides, FAQ, cahiers des charges ; **portail référencé, pas de robot autonome d'extraction du catalogue AGIR**.
6. **Bpifrance** : pages officielles d'AAP et cahiers des charges référencés ; **aucune API d'AAP sans clé attestée**.
7. **Régions** : autorités de gestion FEDER identifiées via portail national ; couverture systématique de chaque site régional à développer et vérifier individuellement.

Sources officielles de référence :
- https://www.data.gouv.fr/dataservices/api-catalogue-des-donnees-ouvertes-data-gouv-fr
- https://data.ademe.fr/openapi-viewer/?urlType=catalog
- https://www.data.gouv.fr/dataservices/api-aides-territoires
- https://www.europe-en-france.gouv.fr/fr/appels-projets
- https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue
- https://www.bpifrance.fr/nos-appels-a-projets-concours

## Documents officiels indexés dans la base

Exemple ADEME EcoIDEN : fichier PDF officiel \`Cahier des charges 2026\` et guide de dépôt, accessibles par liens HTTPS officiels dans le registre. **Le contenu intégral des PDF n'est pas aspiré, stocké ni certifié par ce prototype.** Pour rédiger une demande, ChatGPT doit ouvrir la dernière version des PDF et citer les pages des conditions pertinentes.

## Fonctionnement technique, sans nouvelle infrastructure

- \`registry.json\` : sources, leurs URL, limites d'accès et références documentaires.
- \`ingest_official.mjs\` : lecture d'API publiques officielles avec délais, listes limitées et catégories prudentes ; exécution \`--offline\` ou \`--live --include-at\`.
- \`build_sqlite.py\` : transforme les réponses en **nouvelle base SQLite isolée** avec dédoublonnage par source/ID, preuve, documents, date d'observation et index.
- \`.github/workflows/funding-pro-official-sources.yml\` : exécute des tests, les appels API et des exports publics temporaires ; résultats téléchargeables pendant **7 jours** dans les artefacts GitHub.
- Tests automatiques : réponses simulées, non-invention de taux/éligibilité, refus des sources inconnues, contrôle d'intégrité.

Les fichiers JSON/SQLite sont **publics** car produits dans un dépôt public. Ne jamais y envoyer de SIREN client non déjà public, dossier client, contacts confidentiels, fichiers privés ou informations de connexion.

### Depuis ChatGPT Pro uniquement

Dans le chat, écrire :

> **Équipe 700 — Funding Pro : consulte le registre GitHub des sources publiques, recherche les appels [thème et région], vérifie le cahier des charges officiel, donne-moi les aides pertinentes avec statut, date et preuves. Sans inventer d'éligibilité.**

ChatGPT utilise les **connecteurs déjà disponibles** et sa consultation des sources officielles. Le site HTML Funding Pro n'absorbe pas le modèle ChatGPT Pro : ce mode est **piloté par le chat**, pas un appel direct au modèle depuis une page externe. Les 700 postes MNIN demeurent le même catalogue existant, pas des modèles IA parallèles.

### Pour une vraie base Cloudflare persistante synchronisée

**NON DÉPLOYÉ et NON AUTORISÉ À ÉCRIRE pour l'instant.** Étapes nécessaires :
1. Créer une **nouvelle base dédiée staging Funding Pro** (pas toucher aux 4 D1 existantes) après accord utilisateur.
2. Vérifier les conditions de réutilisation, les quotas et l'accès des sources complémentaires ; maintenir un journal par source.
3. Importer un premier lot officiel public dans D1 à partir du pipeline de validation, avec anti-doublons et sauvegarde.
4. Tester interface de recherche et accès ChatGPT par connecteur Cloudflare ; aucune permission étendue ou installation MCP contournant les droits.
5. Valider puis activer une actualisation planifiée, conservant l'historique des changements et ne publiant pas de données privées.

### Ce qui manque encore

- Une API ouverte vérifiée pour l'intégralité des AAP Bpifrance, de tous les appels FEDER et des régions ; **la disponibilité universelle de telles API n'est pas établie**.
- Lecture/extraction contrôlée de textes PDF, conditions et versions, clauses d'éligibilité, dates de relève et budgets avec citations de pages.
- Mise à jour automatique régulière et persistance D1 ; le workflow actuel est lancé par les modifications du code ou à la demande, pas planifié en production.
- Expiration et comparaison fiable des AAP, retrait des doublons interportails et prise en compte des republications/correctifs.

Une fiche ne doit pas passer à **VALIDÉE** sans preuve datée du financeur, conditions de territoire, forme de l'aide (subvention ou avance remboursable), calendrier, critères, taux et dépenses éligibles effectivement établis. Le pipeline seul laisse ces champs à vérifier.
