# LEYTON RADAR — Process Live Status v12.2.0

Date : 22/09/2026.

## État local vérifié

- Tests : **69/69 PASS**.
- Registre : **145 sources**, **143 officielles**, **18/18 régions**.
- Rôle des sources : **109 ingestion / 36 contrôle**.
- UAT pertinence : **5/5 PASS**, seuil >=85 %.
- Corpus présent : **676 fiches bootstrap Aides Entreprises**, **0 cycle live multi-source** dans le runtime local.
- Gate 8 : PASS.
- Gates exigeant une preuve live externe : 1, 2, 3, 4, 5, 6 final, 7, 9, puis 10.

## Activation

Une fois GitHub autorisé, `bootstrap/bootstrap-github.*` réalise le dépôt + Pages + déclenchement du workflow. Le workflow calcule ensuite les preuves et refuse la certification si une Gate n'est pas PASS.
