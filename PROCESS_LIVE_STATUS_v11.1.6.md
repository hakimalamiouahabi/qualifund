# LEYTON RADAR — état live v11.1.6

**Date de consolidation : 22/09/2026**

## Résultat exécuté dans ce chat

- Tests : **41/41 PASS**.
- JSON : corpus et registres lisibles ; aucun défaut structurel détecté par les scripts du projet.
- Registre : **145 sources**, dont **143 officielles**.
- Couverture : **18/18 régions**.
- Sources d’ingestion : **110** ; sources de contrôle : **35**.
- Dernier cycle live multi-sources : **0/110 exécutée** ; Gate 3 = `NOT_RUN`.
- Snapshot courant : **676 fiches**, toutes issues du bootstrap Aides Entreprises ; **0 fiche non-Aides Entreprises**.
- AAP/AMI : **60**.
- Vérification stricte : **0/676 VERIFIE**.
- CdC : **86/676** ; noyau documentaire critique : **51/676**.
- Fiches avec calendrier : **166/676**.
- Rapport quotidien : **676 -> 676 ; 0 nouvelle ; 0 modifiée ; 0 obsolète**.
- GitHub connecté : **0 dépôt accessible** au contrôle de cette session.
- GO PRODUCTION : **NON**.

## Corrections v11.1.6

1. Aides Entreprises utilise le **stock Open Data public** comme source primaire ; aucune API authentifiée n’est exposée dans les fiches.
2. Normalisation de provenance : `sourceId` présent sur les 676 fiches bootstrap ; anciennes URLs d’API protégées supprimées/réparées.
3. Échéances futures normalisées en objets `{date,type}`.
4. Workflows : reconstruction systématique des métadonnées publiques et de l’index avant Gates/déploiement.
5. GitHub Pages : endpoints serverless désactivés côté navigateur ; fallback direct vers l’API Recherche d’entreprises pour SIREN.
6. Vercel : suppression du rewrite catch-all pouvant masquer `/api/*`.
7. Dépendances directes figées et Node 22 déclaré ; absence de `package-lock.json` à régulariser dès qu’un registre npm est accessible.
8. Documentation et opérations alignées sur **un cycle quotidien à 02:00 Europe/Paris**.
9. Doctrine de volume corrigée : le corpus final n’est **pas présumé > 2 000** avant collecte, déduplication et filtrage effectifs.
10. Validation locale : fallback structurel si AJV n’est pas installé ; AJV reste requis pour la validation complète en CI.
