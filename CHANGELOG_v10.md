# v10.0 — LEYTON RADAR

- Rebranding complet de l'interface : **LEYTON RADAR — Aides & financements publics — Cartographie · Faisabilité · Veille**.
- Accueil centré sur « Nouvelle étude de faisabilité ».
- Parcours projet en 4 étapes.
- Enrichissement SIREN/SIRET via API publique, Pappers facultatif côté serveur.
- Séparation stricte **éligibilité / pertinence / confiance documentaire**.
- Seuil de restitution : **pertinence >= 85 %** ; suppression du top-N arbitraire.
- Fiche aide enrichie : assiette, versement, remboursement, aides d'État/cumul, annexes et preuves.
- Extraction documentaire : jusqu'à 8 PDF pertinents, preuve PDF avec page lorsque détectable.
- Crawler générique élargi : pagination plus profonde, sitemap plus large, jusqu'à 1 200 pages candidates/source.
- QA plus stricte et contrôle des modalités de remboursement pour AR/prêts.
- Rapport quotidien delta.
- GitHub Actions à 02:00 Europe/Paris.
- Endpoint serverless facultatif pour déclencher la collecte depuis le bouton de l'application sans exposer de secret.
