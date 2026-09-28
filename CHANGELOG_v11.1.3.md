# Changelog v11.1.3 — Web / ingestion / regulatory hardening

Date: 2026-09-22

## Corrections principales

- Règle métier J+1 conservée et vérifiée dans le moteur et l'interface.
- Ajout d'une détection robuste des liens de pagination de catalogues, notamment les paramètres `currentPage`, `pageIndex` et `pageNumber`.
- Extension de la détection des liens métier: AAP/AMI, appels à candidatures, subventions, avances remboursables, prêts, concours et fonds européens.
- Ajout de seuils de couverture observés sur sources officielles pour ADEME, DGE et Pays de la Loire afin de détecter les collectes anormalement incomplètes.
- Correction de plusieurs références officielles de datasets régionaux et ajout d'horodatages de vérification web.
- Correction de la cohérence de version: production-gates, génération de bibliothèque et index de recherche utilisent désormais la version du registre de sources.
- Correction P0 de `mergeAid()`: les champs réglementaires extraits n'étaient pas conservés lors de la fusion. Sont désormais préservés: critères de sélection, versement, remboursement, règles aides d'État, procédure de candidature, contact, coûts projet min/max, ventilation d'aide et caractère permanent.
- Ajout de fallbacks d'extraction réglementaire sur le texte intégral lorsque les pages n'exposent pas de sections structurées.
- Ajout de tests de non-régression couvrant pagination, seuils sources, cohérence de version, fusion réglementaire et fallbacks d'extraction.

## État du corpus livré

Le snapshot historique reste volontairement inchangé tant qu'un cycle live complet n'a pas pu être exécuté: 676 fiches, toutes issues du bootstrap Aides Entreprises. La version des fichiers historiques n'est pas artificiellement réécrite.

## Limites d'exécution dans le runtime de cette session

- Le stock JSON officiel Aides Entreprises a été vérifié sur le web, mais son téléchargement (~51,5 Mo) n'a pas pu être effectué depuis le runtime.
- `npm install` ne peut pas terminer faute d'accès réseau sortant du runtime; les scénarios nécessitant Cheerio/Playwright/AJV n'ont donc pas été rejoués ici.
- Aucun dépôt n'est visible via la connexion GitHub actuelle; aucun workflow distant ni déploiement ne peut être déclenché depuis cette session.
