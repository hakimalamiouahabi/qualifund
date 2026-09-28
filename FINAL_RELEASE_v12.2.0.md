# LEYTON RADAR v12.2.0 — FINAL RELEASE

Cette release remplace v12.1.0 comme référence courante.

## Périmètre autoritatif

START-UP / PME / ETI / GE ; France national + régional ; projets R&D/innovation, investissement productif, transition numérique et transition écologique.

Instruments : **SUBVENTION + AVANCE REMBOURSABLE + PRÊT À TAUX ZÉRO**. Un prêt à intérêt positif n'est pas dans le périmètre.

## Deux modes de fonctionnement

### 1. HTML autonome live

Destiné notamment aux postes professionnels sans droits administrateur. Le fichier peut être ouvert directement dans Edge/Chrome. Il embarque la bibliothèque, le moteur de faisabilité et le scoring, et peut rafraîchir les sources publiques compatibles à l'ouverture ou à la demande. Le stock officiel Aides Entreprises peut être importé manuellement si la politique CORS du navigateur empêche le téléchargement direct.

### 2. Pipeline hébergé complet

Le ZIP contient le pipeline Node/GitHub Actions capable d'exécuter les 111 sources d'ingestion et 34 contrôles, enrichir les preuves et reconstruire la bibliothèque. Ce mode est nécessaire pour une collecte réellement exhaustive et planifiée lorsque aucun navigateur n'est ouvert.

## Règles de recommandation

- calendrier : échéance >= J+1, ou permanence officiellement prouvée ;
- éligibilité, pertinence et confiance documentaire restent séparées ;
- pertinence : score 0–100 avec pondération 25/15/20/15/10/10/5 ;
- priorité : fiche VÉRIFIÉE + CONFORME + pertinence >=85 % ;
- sortie : 8 priorités maximum et 6 pistes maximum.

## Statut de la release locale

La release est validée techniquement localement. Les Gates nécessitant une preuve réseau ou un déploiement ne sont jamais auto-déclarées PASS sans exécution réelle.
