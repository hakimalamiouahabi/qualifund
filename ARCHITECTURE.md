# Architecture FUNDING RADAR

```text
Guichet / région verrouillé
        ↓
Sources officielles directes
(HTML / RSS / API publique / Open Data / PDF)
        ↓
Collecteur dédié ou connecteur officiel
        ↓
Extraction structurée + preuves par champ
        ↓
Normalisation + déduplication
        ↓
Audit exhaustif des pages découvertes
        ↓
Certification bloquante
        ↓
Bibliothèque centrale
        ↓
Interface FUNDING RADAR
```

## Principe de verrouillage

Un seul guichet ou une seule région peut être actif à la fois. La bibliothèque des autres sources est reprise à l’identique. Le pipeline calcule une empreinte SHA-256 des fiches non sélectionnées avant et après le cycle et échoue si elles changent.

## Résilience

- aucune suppression silencieuse lors d’un scan dégradé ;
- chaque URL découverte doit être importée, explicitement exclue ou déclarée en erreur ;
- les pages génériques, accessibilité, mentions légales et agrégateurs ne peuvent pas devenir des fiches dispositif ;
- les titres génériques (« Document officiel ») sont refusés ;
- les documents officiels enrichissent les champs mais ne remplacent pas la page canonique du dispositif ;
- un guichet n’est déclaré terminé qu’après certification `PASS`.
