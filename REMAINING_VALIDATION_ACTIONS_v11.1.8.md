# LEYTON RADAR — Actions restantes avant validation définitive

Date : 22/09/2026
Version : 11.1.8

Il reste **10 macro-actions de validation**. Elles correspondent aux 10 Gates encore non finalisées (Gate 6 n'est que PASS_TECH).

1. Rendre le dépôt GitHub accessible et pousser la v11.1.8.
2. Activer GitHub Pages (ou l'hébergement cible) et obtenir une URL permanente.
3. Exécuter le préflight puis le premier cycle live complet : 111 sources d'ingestion + 34 sources de contrôle.
4. Recalculer la bibliothèque et atteindre une vérification réglementaire exploitable sur le corpus réellement collecté.
5. Compléter/contrôler les preuves et CdC critiques manquants par fiche.
6. Valider déduplication, fraîcheur, réactivation et protection anti-scan-vide sur le corpus multi-sources réel.
7. Valider l'enrichissement SIREN/SIRET en live sur un échantillon de recette.
8. Réaliser les 5 cas consultant de recette pertinence >=85% et confirmer la séparation éligibilité / pertinence / confiance documentaire.
9. Laisser réussir au moins un cycle distant planifié à 02:00 Europe/Paris avec rapport, commit des données et redéploiement.
10. Exécuter la recette production finale sans anomalie P0 et constater Gates 1–9 PASS avant GO PRODUCTION.

## P0 immédiats
- Gate 1 : dépôt GitHub accessible.
- Gate 3 : premier cycle live multi-sources.
- Gates 4–5 : vérification et preuves du corpus reconstruit.

## Critère de clôture
GO PRODUCTION uniquement si les Gates 1 à 9 sont en PASS, aucun P0 ouvert, puis Gate 10 PASS.
