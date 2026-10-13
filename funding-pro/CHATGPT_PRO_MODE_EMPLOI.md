# Funding Pro — mode d'emploi sans informatique

**Statut : prototype de travail, NON déployé comme site public.** Aucun serveur personnel, aucune API d'IA payante, aucune base Cloudflare ou WordPress modifiée.

## Option A — rester exclusivement dans ce chat ChatGPT
Écrire simplement :

> **Funding Pro : prépare un dossier de subvention ou d'avance remboursable pour mon projet. Utilise les 700 profils existants selon leurs compétences, sans créer d'agent.**

ChatGPT reprend `docs/CHAT_700_MASTER.md` et `agents/manifest-700-target.json` sur la branche `proposal/pro-700-audit-open-source` du dépôt `hakimalamiouahabi/mnin-nbda-brevet-3ac`, puis mobilise les experts réellement adaptés (API, données, traçabilité, contrôle budgétaire, QA, sécurité) **comme perspectives successives d'un seul assistant**.

Profils existants déjà contrôlés :
- `EX_2_02_1_01` Ingénieur REST API
- `EX_2_02_1_03` Ingénieur base de données
- `EX_4_01_1_01` Data engineer
- `EX_4_01_1_08` Expert traçabilité sources
- `EX_5_03_1_09` Expert contrôle budget
- `EX_2_06_1_02` QA automation
- `EX_5_01_1_09` Auditeur sécurité

**Important :** ces profils MNIN ne constituent pas des experts spécialisés en droit des aides publiques françaises. ChatGPT doit vérifier les règles officielles et demander les pièces manquantes, jamais attribuer une expertise réglementaire non établie.

## Option B — utiliser la nouvelle interface de saisie
1. Ouvrir le fichier `funding-pro/preview/Funding_Pro_Atelier.html` **dans le navigateur**, après l'avoir récupéré dans GitHub ou via la pièce jointe de la conversation.
2. Renseigner l'entreprise, les caractéristiques du dispositif, le projet et les dépenses.
3. Vérifier le bilan : budget total, financement sollicité, apports et écart ; lire les alertes.
4. Cliquer sur **Copier le brief pour ChatGPT**, puis le coller dans une conversation ChatGPT Pro.
5. Pour enregistrer un travail sur l'appareil, cliquer sur **Sauvegarder .json** ; pour un brouillon, **Exporter le dossier .md**.

La page est 100 % statique, sans bibliothèques distantes, réseau, compte, serveur ou conservation automatique : aucune écriture GitHub, WordPress ou Cloudflare. Le téléchargement JSON contient **toutes les données saisies** ; le garder dans un emplacement privé adapté aux dossiers clients.

## Quelle différence par rapport à l'ancienne version ?
- Ancien moteur : programme Node CLI et fichiers JSON à préparer manuellement, sans interface conviviale.
- Nouveau prototype : formulaires, lignes de dépenses, équilibre du plan de financement, alertes, import/export et brief directement réutilisable dans ChatGPT.
- ChatGPT Pro fait toujours le travail intellectuel après que l'utilisateur lui fournit les éléments ; le formulaire ne rédige pas automatiquement un dossier expert.

## Ce qui n'est pas encore opérationnel
- Publication sur un domaine public.
- Calcul certifié du montant, du taux, du plafond ou des dépenses admissibles.
- Vérification automatique en direct des appels à projets fédéraux/régionaux.
- Agents IA autonomes, sessions parallèles, dépôts automatiques.
- Stockage privé centralisé des dossiers ou synchronisation automatique.

**Sécurité et autorisations :** ne pas fusionner ni déployer sans revue. Ne jamais transférer des pièces sensibles dans le dépôt GitHub public.
