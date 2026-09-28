# LEYTON RADAR v10.0 — récapitulatif

## Produit

**LEYTON RADAR**  
*Aides & financements publics*  
**Cartographie · Faisabilité · Veille**

## Bibliothèque

- 18 régions revues dans le registre maître.
- 145 sources/connecteurs configurés dans la version courante.
- 143 sources marquées officielles dans le registre.
- Instruments : SUBVENTION, AVANCE REMBOURSABLE, PRET.
- Échéance recommandable : >= J+1 ou permanent officiellement confirmé.
- Conservation de la dernière version valide si un connecteur échoue ou renvoie un volume anormal.

## Étude de faisabilité

- Enrichissement entreprise par SIREN/SIRET.
- Parcours projet en 4 étapes.
- Éligibilité, pertinence et confiance documentaire séparées.
- Une aide n'apparaît que si elle n'est pas bloquée et si sa **pertinence projet est >= 85 %**.
- Toutes les aides dépassant le seuil sont affichées : pas de top-N arbitraire.

## Fiche aide

Champs : objectif, thématiques, bénéficiaires, instrument, répartition SUB/AR, assiette, montant d'aide, taux par taille, portée, région, financeur, opérateur, projets attendus, dépenses éligibles/exclues, prérequis, critères de sélection, points de vigilance, dates, relèves, versements, remboursement AR/prêt, aides d'État/cumul, CdC, annexes, source, dernière vérification et preuves.

## Veille

- Tâche ChatGPT : **LEYTON RADAR — veille**, active chaque jour à 02:00 Europe/Paris.
- Workflow GitHub : collecte complète quotidienne à 02:00 Europe/Paris + déclenchement manuel.
- Rapport delta : nouvelles aides, modifications, clôtures/obsolescence.

## Déploiement

- GitHub Pages : publication publique et veille automatique.
- GitHub + Vercel : ajoute le bouton sécurisé « Mettre à jour la cartographie » grâce à `api/refresh.js`.
- Aucun secret n'est embarqué dans le navigateur.

## Situation de la bibliothèque bootstrap actuelle

La bibliothèque embarquée issue de la version précédente contient 676 fiches actives. Elle sert de bootstrap uniquement. Son audit courant montre encore 0 fiche strictement `VERIFIE` selon la nouvelle règle renforcée ; la collecte v10 doit donc être exécutée sur un environnement connecté pour enrichir les preuves, CdC, critères de sélection, versements et remboursements avant de revendiquer une bibliothèque réglementaire complètement vérifiée.
