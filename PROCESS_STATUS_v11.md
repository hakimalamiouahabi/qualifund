# LEYTON RADAR — état d'avancement du passage en production

## Statut global
GO PRODUCTION : **NON — hardening en cours**.

## Gates
1. Dépôt GitHub : **BLOCKED** — aucun dépôt accessible/configuré dans le compte GitHub connecté.
2. URL permanente : **BLOCKED** — dépend du dépôt/déploiement.
3. 145 connecteurs : **READY** — registre 145/145 validé ; premier cycle serveur à exécuter.
4. Bibliothèque vérifiée : **FAIL** — bootstrap actuel : 0/676 fiches strictement VÉRIFIÉES.
5. Extraction CdC / preuve par champ : **PARTIAL** — 51/676 fiches possèdent actuellement le noyau documentaire critique ; moteur renforcé.
6. Déduplication & fraîcheur : **PASS_TECH** — tests techniques OK ; recette corpus réel requise.
7. SIREN/SIRET : **READY** — endpoint entreprise implémenté ; test live après déploiement.
8. Pertinence ≥85 % : **PARTIAL** — logique implémentée ; 5+ dossiers consultants nécessaires pour calibration/recette.
9. Mise à jour quotidienne 02:00 + rapport : **PARTIAL** — workflow + rapport + préflight 145 sources intégrés ; exécution live après GitHub.
10. Recette finale : **NOT_STARTED**.

## Correctifs v11 déjà appliqués
- audit du registre corrigé : 145 sources, 143 officielles, 18 nationales, 127 régionales/territoriales, 18/18 régions ;
- nouveau préflight réseau des sources pour le pipeline hébergé ;
- tableau de bord des 10 gates dans l'application ;
- endpoint « Mettre à jour la cartographie » protégé par `RADAR_ADMIN_TOKEN` ;
- workflow quotidien enrichi : préflight → collecte → QA → rapport → gates → publication ;
- tests registre ajoutés ; total : 15/15 tests réussis ;
- scripts `production:gates` et `preflight:sources` ajoutés.

## Prochaine action bloquante
Créer un dépôt GitHub accessible au connecteur, idéalement `leyton-radar`, puis pousser ce projet pour exécuter le premier cycle live des 145 connecteurs et obtenir l'URL permanente.
