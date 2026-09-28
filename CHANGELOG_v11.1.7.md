# CHANGELOG v11.1.7 — Cycle Safety Hardening

Date : 22/09/2026

## P0 — sécurité du cycle de collecte
- Un connecteur d'ingestion qui retourne HTTP 200 mais 0 fiche n'est plus considéré comme un cycle exploitable.
- Un scan vide ou sous `minExpected` ne peut plus rendre obsolète le dernier corpus valide.
- Les sources `control-only` restent non destructives pour le cycle de vie des fiches.
- Une fiche précédemment `STALE` retrouvée via une autre source est réactivée en `ACTIVE` après déduplication.

## P0 — fiabilité des rapports de santé
- Le préflight sérialise désormais explicitement `probed` et `conclusive`.
- Les erreurs réseau / timeouts ne sont plus comptées comme résultats concluants.
- Le QA distingue : sources configurées, probées, concluantes, saines, et sources réellement exécutées dans un cycle live.

## Aides Territoires
- Nouvelle stratégie d'ingestion `aides-territoires` à partir de l'API publique.
- Filtrage avant import : bénéficiaire `Entreprises privées` + instruments `Subvention`, `Prêt`, `Avance récupérable` + périmètre national/régional exploitable.
- Les aides réservées aux collectivités ou uniquement en ingénierie sont exclues.
- Le registre passe à 111 sources d'ingestion et 34 sources de contrôle.
- Aucun résultat Aides Territoires n'est injecté dans le snapshot tant qu'un cycle live réel n'a pas été exécuté.

## Recette locale
- 51/51 tests PASS.
- 145 sources configurées, 143 officielles, 18/18 régions.
- 676/676 fiches valides en fallback structurel local.
- Gate 3 : NOT_RUN (0/111 ingestion, 0/34 contrôle live).
- GO PRODUCTION : NON.
