# Changelog v12.1.0

- Alignement strict sur le cahier final : SUBVENTION + AVANCE_REMBOURSABLE ; suppression de PRET du moteur recommandable.
- Scoring final 25/15/20/15/10/10/5.
- Restitution 8 priorités VÉRIFIÉES + 6 pistes.
- J+1 inclusif et permanence avec preuve calendrier A/B obligatoire.
- Gates 4–5 basées sur l'intégrité des fiches VÉRIFIÉES et la file de remédiation, sans seuil arbitraire de 80 % du stock entier.
- Gate 9 peut être prouvée par un run live push/workflow_dispatch/schedule de la même chaîne ; le cron/timezone est couvert par test statique.
- Nouveau `certify:production` : échec explicite tant que les 10 Gates ne sont pas PASS.
- GitHub Actions épinglées sur SHA immuables ; vérification finale sur le SHA réellement publié.
- API SIREN : sélection exacte du SIREN, timeouts ; API refresh : comparaison du token en temps constant.
- 69 tests de non-régression et de contrat final.
