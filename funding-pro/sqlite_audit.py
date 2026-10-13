"""Lecture seule d'une COPIE SQLite, pour prédiagnostic d'hygiène D1/WordPress.
Aucune purge, aucune correction, aucun vacuum, aucune écriture.
Ne jamais transmettre d'export client sensible à GitHub public.
"""
from __future__ import annotations
import json
import sqlite3
import sys
from pathlib import Path


def audit_sqlite_snapshot(filename: str) -> dict:
    path = Path(filename).expanduser().resolve(strict=True)
    if not path.is_file():
        raise ValueError("Une copie SQLite fichier est requise")
    # mode=ro protège la copie ; query_only protège contre toute requête de modification.
    conn = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=2.0)
    try:
        conn.execute("PRAGMA query_only=ON")
        readonly = conn.execute("PRAGMA query_only").fetchone()[0] == 1
        if not readonly:
            raise RuntimeError("PRAGMA query_only non activé")
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )]
        indexes = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
        ).fetchone()[0]
        views = conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='view'").fetchone()[0]
        triggers = conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'").fetchone()[0]
        # Ne jamais renvoyer le contenu ou les identifiants des lignes.
        fk_violations = sum(1 for _ in conn.execute("PRAGMA foreign_key_check"))
        check = conn.execute("PRAGMA quick_check").fetchone()[0]
        return {
            "status": "PASS" if check == "ok" and fk_violations == 0 else "FAIL",
            "mode": "SQLITE_SNAPSHOT_READ_ONLY",
            "bytes": path.stat().st_size,
            "table_count": len(tables),
            "table_names": tables,
            "index_count": indexes,
            "view_count": views,
            "trigger_count": triggers,
            "foreign_key_violation_count": fk_violations,
            "quick_check": "PASS" if check == "ok" else "FAIL",
            "automatic_cleanup": False,
            "recommendations": [
                "Comparer à la sauvegarde attestée et vérifier la restauration avant toute opération.",
                "Analyser les tables volumineuses sur une copie isolée avec consentement.",
                "Ne pas supprimer de tables, objets, branches, pages, médias ou enregistrements automatiquement.",
            ],
        }
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("Usage: python3 sqlite_audit.py <COPIE_SQLITE.db>")
        print(json.dumps(audit_sqlite_snapshot(sys.argv[1]), ensure_ascii=False, indent=2))
    except (ValueError, OSError, sqlite3.Error, RuntimeError) as exc:
        print(json.dumps({"status": "BLOQUÉ", "message": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
