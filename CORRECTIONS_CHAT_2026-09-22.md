# LEYTON RADAR — corrections consolidées du chat — 22/09/2026

Ce document fixe l’état technique réellement vérifié après reprise du ZIP, audits locaux et contrôles Web officiels.

## Corrections de fond

1. **676 fiches n’est pas le corpus exhaustif.** Il s’agit du snapshot bootstrap actuel ; 676/676 fiches proviennent d’Aides Entreprises et aucune fiche du snapshot courant ne provient encore d’un cycle live multi-sources.
2. **145 sources configurées ne signifie pas 145 sources déjà collectées.** Le registre contient 110 sources d’ingestion et 35 sources de contrôle ; le dernier cycle réel contient 0/110 source d’ingestion exécutée.
3. **Gate 3 n’est pas READY.** Sans cycle live, son état correct est `NOT_RUN`.
4. **Gate 6 `PASS_TECH` n’autorise pas un GO PRODUCTION.** Il devient `PASS` uniquement après validation sur un corpus multi-sources réellement collecté.
5. **GO PRODUCTION exige désormais PASS sur toutes les Gates.** Les statuts READY, PARTIAL, NOT_RUN, PASS_TECH, BLOCKED et FAIL sont non-productifs.
6. **La règle temporelle active est J+1.** J0 est exclu ; J+1 est accepté ; un dispositif permanent doit être officiellement vérifié.
7. **Aides Entreprises : le stock public JSON/CSV/XML est la voie primaire.** L’API REST officielle exige une authentification ; le connecteur ne la tente plus automatiquement en fallback.
8. **Les preuves Aides Entreprises ne pointent plus vers l’API protégée.** Elles référencent la page Open Data publique ; les pages officielles des financeurs restent conservées dans les liens source lorsqu’elles existent.
9. **Région Sud « flux json » :** la ressource publique observée est rendue en HTML ; elle est donc conservée comme source Web de contrôle, pas comme API JSON.
10. **Pays de la Loire Open Data :** le descripteur de contrôle a été normalisé avec racine OpenDataSoft + `datasetId` explicite.
11. **Baselines Web corrigées au 22/09/2026 :** ADEME 71 dispositifs visibles ; DGE 64 résultats ; Pays de la Loire 180 résultats.
12. **Validation locale :** AJV reste le moteur complet en CI après installation npm. Hors dépendances, `npm run validate` exécute désormais un fallback structurel critique au lieu d’échouer avant tout contrôle.
13. **GitHub :** la connexion disponible dans ce chat retourne 0 dépôt accessible ; Gate 1 reste BLOCKED.

## État technique consolidé v11.1.6

- Tests : **41/41 PASS**.
- Registre : **145 sources**, dont **143 officielles**.
- Couverture territoriale : **18/18 régions**.
- Ingestion : **110 sources** ; contrôle : **35 sources**.
- Snapshot : **676 fiches actives**, **60 AAP/AMI**, **0 VERIFIE**, **86 avec CdC**, **166 avec calendrier**.
- QA historique : critères de sélection, modalités de versement et remboursement encore absents du snapshot bootstrap ; les extracteurs/merge ont été durcis pour le prochain cycle live.
- GO PRODUCTION : **NON**.

## Sources Web officielles recontrôlées

- Aides Entreprises Open Data : https://data.aides-entreprises.fr/documentation
- Aides Entreprises stock : https://data.aides-entreprises.fr/stock
- ADEME catalogue entreprises : https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue
- DGE AAP/AMI : https://www.entreprises.gouv.fr/espace-entreprises/appels-a-projets-et-appels-a-manifestation-d-interet
- Pays de la Loire — aides : https://www.paysdelaloire.fr/les-aides
- Île-de-France Open Data : https://data.iledefrance.fr/explore/dataset/aides-appels-a-projets/
- Occitanie Open Data : https://data.laregion.fr/explore/dataset/aides-et-appels-a-projets-de-la-region-occitanie%40occitanie/
- Région Sud — flux public : https://www.maregionsud.fr/vos-aides/flux-json
- GitHub Actions schedule/timezone : https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

## Corrections v11.1.6
- L’affirmation « le corpus final doit dépasser 2 000 aides » est retirée. Les référentiels officiels montrent un réservoir brut très supérieur au snapshot, mais le nombre final Qualifund reste inconnu avant collecte/déduplication/filtrage.
- Les 676 fiches restent correctement décrites comme **snapshot bootstrap mono-source**, pas comme bibliothèque exhaustive.
- L’API REST Aides Entreprises n’est plus exposée comme source active ni comme preuve publique ; le stock Open Data est la référence de collecte.
- GitHub Pages étant statique, les endpoints `/api/company` et `/api/refresh` sont désactivés côté configuration navigateur sur `github.io`; la recherche SIREN utilise alors directement l’API Recherche d’entreprises ouverte.

- Contrôle final v11.1.6 : Gate 3 = `NOT_RUN` tant que 0/110 sources d’ingestion ont tourné en live ; aucune extrapolation de volume final n’est autorisée.

- Le stock Aides Entreprises a été recontrôlé le 22/09/2026 : la page officielle affiche une mise à jour au 22/09/2026 et un JSON de 51,96 Mo. Les anciennes mentions 01/08/2026 / 51,48 Mo sont obsolètes.

## Corrections v11.1.7
- Un HTTP 200 avec 0 fiche parsée ne constitue plus une collecte d'ingestion réussie : le dernier corpus valide est conservé et aucune fiche n'est rendue obsolète sur cette base.
- Les erreurs réseau et timeouts du préflight ne sont plus assimilés à des résultats concluants dans le QA.
- Aides Territoires n'est plus seulement une source de contrôle : son API publique expose des bénéficiaires et types d'aide permettant une ingestion filtrée sur `Entreprises privées` et les instruments `Subvention`, `Prêt`, `Avance récupérable`. Aucun résultat n'est injecté sans cycle live réel.
- Le registre v11.1.7 compte 111 sources d'ingestion et 34 sources de contrôle.
- Le volume final Qualifund n'est pas déduit du volume brut d'un agrégateur : il reste à mesurer après filtrage, déduplication et vérification.


## Consolidation finale v12.0.0

- La règle métier finale reste **J+1** : J0 exclu, J+1 accepté ; une permanence exige une preuve calendrier A/B.
- Les **676 fiches** du snapshot livré sont un bootstrap historique Aides Entreprises et ne constituent pas la preuve d’exhaustivité multi-source.
- Le registre courant contient **145 sources : 111 ingestion + 34 contrôle**. Configurée ≠ collectée.
- Aucune cible arbitraire “>2000 fiches Qualifund” n’est retenue : le volume final dépend du cycle live, du périmètre instruments/entreprises, de la déduplication et du filtre projet.
- Les scans vides/sous-volume sont non destructifs et l’ordre des sources ne peut plus rendre STALE une fiche vue ailleurs dans le même cycle.
- Les pages catalogue génériques ne sont plus promues en preuves B de fiche.
- Le moteur navigateur et l’UAT utilisent le même scoring ; 5 cas UAT >=85 % sont requis.
- Les Gates externes (GitHub, URL, réseau, schedule) reposent sur des artefacts de preuve et non sur des drapeaux manuels.
- La version v12.0.0 est la release de référence ; les fichiers v11.x présents dans l’archive sont historiques.

## Correction finale v12.2.0 — autorité du cahier final

- **Périmètre instruments rectifié :** les mentions antérieures intégrant `PRET` dans le moteur Qualifund sont obsolètes. Le cahier final fait autorité : **SUBVENTION + AVANCE_REMBOURSABLE + PRET_TAUX_ZERO uniquement**. Les sources/produits prêt sont conservés au mieux comme contrôle de couverture, jamais comme instrument recommandable.
- **Aides Territoires rectifié :** son connecteur filtre désormais seulement `Subvention` et `Avance récupérable` pour Qualifund. La mention v11.1.7 incluant `Prêt` est donc historique et remplacée.
- **Registre courant :** 145 sources = **109 ingestion + 36 contrôle**, après reclassement des flux prêt hors périmètre final.
- **Scoring rectifié :** la pondération finale est **25/15/20/15/10/10/5 = 100** (objectifs, typologie, dépenses, éligibilité/sélection, finance, calendrier/maturité, territorialité/stratégie).
- **Restitution rectifiée :** maximum **8 priorités** uniquement si `VERIFIE` + `CONFORME` + pertinence >=85 %, et **6 pistes** maximum à sécuriser, avec « Pourquoi je la retiens » / « À sécuriser ».
- **Gates 4–5 rectifiées :** suppression du seuil arbitraire de 80 % de toute la bibliothèque. La production est sûre par quarantaine : seules les fiches VÉRIFIÉES peuvent être priorités ; leur intégrité A/B doit être totale, tandis que les autres restent dans la file de remédiation / pistes.
- **Gate 9 rectifiée :** un run live `push`, `workflow_dispatch` ou `schedule` de la chaîne complète prouve l'exécution ; le cron `02:00 Europe/Paris` est vérifié statiquement. Il n'est plus nécessaire d'attendre artificiellement le prochain déclenchement de 02:00 pour certifier le même workflow.
- **CI durcie :** actions GitHub épinglées sur SHA immuables ; la vérification finale relit le SHA de données réellement publié ; `certify:production` échoue explicitement si une Gate n'est pas PASS.
- **Contrat temporel homogène :** J0 exclu, J+1 accepté ; une permanence sans preuve calendrier A/B est refusée côté navigateur et bibliothèque.
- **Version de référence :** **v12.2.0** remplace v12.0.0 comme release finale candidate du code. La certification production reste factuelle et exige le premier cycle live.
