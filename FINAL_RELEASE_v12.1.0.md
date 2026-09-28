# LEYTON RADAR v12.2.0 — FINAL RELEASE CANDIDATE

Date de consolidation : 22/09/2026.

## Contrat métier final

- Entreprises : START-UP, PME, ETI, GE.
- Instruments recommandables : **SUBVENTION**, **AVANCE_REMBOURSABLE** et **PRET_TAUX_ZERO** uniquement.
- Calendrier : échéance exploitable **>= J+1** ; une permanence n'est recevable que si le calendrier permanent est appuyé par une preuve A/B.
- Pertinence minimale : **85/100**.
- Pondération : objectifs/thématiques 25, typologie 15, dépenses 20, éligibilité/sélection 15, finance 10, calendrier/maturité 10, territorialité/stratégie 5.
- Restitution : **8 priorités maximum**, strictement VÉRIFIÉES et conformes, plus **6 pistes maximum** à sécuriser.
- Chaque restitution expose « Pourquoi je la retiens » et « À sécuriser ».

## Sécurité de collecte

- Un scan vide ou sous son seuil minimal n'est jamais destructif.
- L'ordre des connecteurs ne peut pas rebasculer en STALE une fiche vue ailleurs pendant le même cycle.
- Une source générique Open Data de niveau C ne peut pas être promue artificiellement en preuve B.
- Les pages opérateur spécifiques et documents officiels PDF alimentent les preuves A/B.
- Les fiches non VÉRIFIÉES ne peuvent pas devenir des priorités fermes.

## CI/CD

- GitHub Actions épinglées sur SHA immuables.
- Le job de validation finale relit le SHA du corpus réellement publié.
- Cron quotidien : 02:00 Europe/Paris.
- Déploiement GitHub Pages, smoke URL publique, smoke SIREN DINUM, UAT, readiness puis certification stricte.
- `npm run certify:production` retourne un code non nul tant que le GO PRODUCTION n'est pas réellement obtenu.

## État local de cette archive

- 145 sources configurées : 109 ingestion / 36 contrôle.
- 676 fiches bootstrap historiques ; aucun cycle live multi-source n'a été simulé.
- 69/69 tests unitaires/de contrat passent avant packaging.
- 5/5 cas UAT >= 85 %.
- GO PRODUCTION local : NON, volontairement, faute de dépôt/URL/cycle réseau dans ce runtime.

Cette archive est la version finale du code et du contrat de validation. Le label « production certifiée » n'est accordé qu'après les preuves live automatisées des Gates 1–10.
