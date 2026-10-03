# FUNDING RADAR | Leyton

FUNDING RADAR consolide les aides, subventions, avances remboursables, prêts à taux zéro et appels à projets utiles aux entreprises en France à partir de **sources publiques officielles directes**.

## Stratégie de collecte

La collecte et la mise à jour fonctionnent sans LLM. Un seul guichet ou une seule région peut être actif à la fois :

1. verrou exclusif sur le guichet ou la région ;
2. collecte directe des seules sources officielles calibrées ;
3. extraction structurée des fiches et documents ;
4. audit comptable de toutes les URLs découvertes ;
5. contrôle des titres, liens, dates, instruments, bénéficiaires et preuves ;
6. certification bloquante liée à la configuration **et au code exacts** du cycle ;
7. publication uniquement des sources dont le certificat PASS correspond encore à cette base technique ;
8. passage manuel au guichet ou à la région suivante.

Une collecte échouée ou anormalement incomplète ne remplace jamais le dernier snapshot valide.

## État du chantier — Foundation v3 / v12.8

- **Bpifrance : cycle de recertification actif.** Le PASS historique v2 est conservé comme preuve, mais ne déverrouille plus la publication tant qu'un nouveau PASS v12.8 n'est pas généré.
- **ADEME : gelé jusqu'au PASS Bpifrance v12.8.** Le PASS historique v4 est conservé mais doit être recertifié sur la même base technique.
- **Auvergne-Rhône-Alpes : gelée.** Le cycle AURA ne reprend qu'après les nouveaux PASS Bpifrance puis ADEME.
- **Autres régions / FEDER / FEADER / FSE+ / FTJ / ANR : gelés** et activables uniquement après calibration explicite de leurs seuils et de leur référentiel maître.

La publication suit la règle **CERTIFIED_SOURCE_ONLY**. Un certificat ancien, sans empreinte, ou dont la configuration, le connecteur, la chaîne de collecte, la purge, la certification ou le build ont changé est rejeté en mode fail-closed. Les données peuvent rester conservées comme snapshot historique sans être publiées.

## Politique source

Sont admises comme sources de vérité : pages officielles directement rattachées au financeur ou à la région, API/Open Data officiels spécifiques, flux RSS officiels et documents réglementaires officiels. Les agrégateurs généralistes ne peuvent ni alimenter la bibliothèque ni servir de preuve de publication.

Une donnée absente n'est pas inventée. Une fiche sans preuve minimale de guichet, de statut courant, d'instrument cible et d'éligibilité entreprise reste hors publication.

## Garde-fous de production

- verrou de collecte obligatoire ;
- seuils de complétude calibrés avant activation ;
- dernier snapshot valide conservé en cas d'échec ;
- déduplication par identifiant et URL officielle ;
- statuts STALE / CLOSED / EXPIRED / ARCHIVE toujours exclus de la publication ;
- ledger de certification reconstruit à chaque publication ;
- fingerprint de configuration et de base technique obligatoire ;
- certificat actif incohérent automatiquement ramené à **PENDING** ;
- artefacts de diagnostic périmés supprimés avant régénération ;
- build public limité au corpus certifié.

## Exécution

```bash
npm ci
npm test
npm run audit:sources
npm run preflight:sources
npm run update:full
npm run certify:active
npm run validate
npm run audit:deep:strict
```

Le registre maître est `config/sources.json`, le verrou courant `config/collection-lock.json` et les données internes `site/data/`. Le corpus public est construit à partir du ledger certifié, jamais directement depuis le stock brut.
