# Cahier des charges final — QUALIFUND v8

## 1. Finalité
QUALIFUND est une application web de cartographie et qualification des **subventions et avances remboursables** destinées aux **START-UP, PME, ETI et GE**, pour un **projet unique** relevant de la R&D/innovation, de l’investissement productif, de la transition numérique ou de la transition écologique. La restitution doit être exploitable par un **consultant senior Aides & Subventions**.

## 2. Expérience finale
L’utilisateur ouvre une **URL HTTPS unique**. Aucun EXE, HTML local, Python, Node ou serveur local. La bibliothèque publique est mise à jour automatiquement côté serveur et le projet client reste dans le navigateur.

## 3. Sources
Le registre suit les sources nationales et régionales gratuites : Aides Entreprises, Bpifrance/France 2030, ADEME, DGE, ANR, Europe en France/FEDER-FSE+-FTJ, FranceAgriMer, Banque des Territoires, OFB, Transition écologique des entreprises et les 18 territoires régionaux. Les agrégateurs non officiels servent uniquement de contrôle de couverture.

## 4. Hiérarchie de preuve
- **A** : cahier des charges, règlement, délibération, texte officiel de l’édition ;
- **B** : page/API officielle du financeur décrivant l’édition active ;
- **C** : base publique transversale officielle ;
- **D** : source secondaire de contrôle.

Aucune condition, date, dépense, taux ou plafond n’est inventé.

## 5. Fiche standard obligatoire
Chaque AAP/aide présente exactement les rubriques suivantes :
1. identité / financeur / opérateur / programme / édition ;
2. objectif ;
3. bénéficiaires et tailles d’entreprise ;
4. thématiques visées ;
5. portée nationale/régionale et territoires ;
6. type d’aide : SUBVENTION et/ou AVANCE REMBOURSABLE ;
7. taux min/max et modulation par taille si documentée ;
8. montants min/max/plafonds et modulation par taille si documentée ;
9. projets attendus ;
10. dépenses éligibles et dépenses exclues ;
11. ouverture, toutes les relèves, prochaine échéance exploitable, clôture finale, permanence ;
12. prérequis ;
13. critères de sélection ;
14. points d’attention consultant ;
15. cahier des charges/règlement avec lien direct téléchargeable si disponible ;
16. traçabilité et preuve de chaque champ critique.

## 6. Mise à jour robuste
Le moteur exécute automatiquement API/Open Data → page officielle → navigateur headless → documents PDF. Chaque source est isolée par timeout et retries. Une anomalie de volume ou un échec **n’efface jamais la dernière version valide**. Un scan incomplet ne marque pas massivement les fiches comme disparues. Les PDF sont hachés pour détecter les modifications.

## 7. Publication sûre
Une nouvelle bibliothèque n’est publiée que si les tests, le schéma et les garde-fous de volume passent. La collecte planifiée ne réenclenche pas en boucle le workflow après le commit des seules données.

## 8. J+1
Une aide à date fixe est recommandable uniquement si la **prochaine relève réellement exploitable est supérieure ou égale à la date d’analyse + 1 jour calendaire**. Une absence de date ne vaut jamais permanence. La permanence doit être explicitement documentée.

## 9. Qualification senior
Ordre des filtres : instrument → archive/stale → taille → territoire → calendrier/J+1 → seuil budgétaire → exclusions sectorielles explicites → adéquation sectorielle des dispositifs spécialisés → pertinence.

Score interne /100 : objectifs 25, typologie 15, dépenses 20, éligibilité/sélection 15, finance 10, calendrier/maturité 10, territorialité/stratégie 5. Le score n’est jamais une probabilité de financement.

La restitution contient au maximum **8 priorités** et **6 pistes à approfondir**, avec pour chacune : **Pourquoi je la retiens** et **À sécuriser**.

## 10. Confidentialité
Les données du projet restent en local dans le navigateur. Aucun SIREN, budget, résumé ou donnée client n’est envoyé à GitHub ni aux financeurs.

## 11. Exploitation
Collecte complète quotidienne à **02:00 Europe/Paris** et déclenchement manuel à la demande. Chaque cycle exécute le préflight, la collecte, l’enrichissement, la QA, le journal des changements et la publication. Le tableau de bord affiche la santé de chaque source, la dernière réussite, la complétude, la couverture CdC, les changements et les anomalies.

## 12. Critère de version finale
La version finale est une architecture **auto-surveillée et dégradée proprement** face aux changements externes. Elle ne promet pas que les sites tiers ne changeront jamais ; elle garantit que ces changements sont détectés, isolés et qu’ils ne suppriment pas silencieusement la bibliothèque valide.
