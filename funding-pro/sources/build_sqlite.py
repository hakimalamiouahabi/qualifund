#!/usr/bin/env python3
"""Funding Pro: base SQLite locale publique, sans connexion Cloudflare ni donnees client.
Usage: python3 funding-pro/sources/build_sqlite.py export.json ./sources.sqlite
"""
import json
import sqlite3
import sys
from pathlib import Path

DDL = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS funding_sources (
    source_id TEXT PRIMARY KEY,
    institution TEXT NOT NULL,
    source_type TEXT NOT NULL,
    official_url TEXT NOT NULL,
    integration_status TEXT NOT NULL,
    note TEXT
);
CREATE TABLE IF NOT EXISTS funding_public_records (
    record_key TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES funding_sources(source_id),
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT NOT NULL,
    instrument TEXT NOT NULL DEFAULT 'NON_DETERMINE',
    validation_status TEXT NOT NULL DEFAULT 'A_VERIFIER',
    eligibility_status TEXT NOT NULL DEFAULT 'NON_ETABLIE',
    eligible_spending TEXT,
    funding_rate REAL,
    funding_cap REAL,
    deadline TEXT,
    issuer TEXT,
    territory TEXT,
    source_updated_at TEXT,
    observed_at TEXT NOT NULL,
    provenance TEXT NOT NULL,
    description TEXT,
    UNIQUE(source_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_funding_records_category ON funding_public_records(category);
CREATE INDEX IF NOT EXISTS idx_funding_records_source ON funding_public_records(source_id);
CREATE INDEX IF NOT EXISTS idx_funding_records_validation ON funding_public_records(validation_status);
CREATE TABLE IF NOT EXISTS funding_source_documents (
    record_key TEXT NOT NULL REFERENCES funding_public_records(record_key),
    document_url TEXT NOT NULL,
    title TEXT NOT NULL,
    format TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'A_VERIFIER',
    PRIMARY KEY(record_key,document_url)
);
CREATE TABLE IF NOT EXISTS funding_ingest_runs (
    run_id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    collection_mode TEXT NOT NULL,
    sources_checked INTEGER NOT NULL,
    records_count INTEGER NOT NULL,
    run_notes TEXT
);
"""

def _text(value, max_len=500):
    return str(value if value is not None else "")[:max_len]

def build(conn, registry, snapshot):
    """Accept ONLY normalized public source metadata. No individual/company dossiers."""
    if snapshot.get("schema_version") != 1 or not isinstance(snapshot.get("records"), list):
        raise ValueError("Format export inconnu")
    conn.executescript(DDL)
    observed = _text(snapshot.get("generated_at"), 60)
    sources = {s["id"]: s for s in registry["sources"]}
    with conn:
        for s in sources.values():
            conn.execute("""INSERT INTO funding_sources(source_id,institution,source_type,official_url,integration_status,note)
                VALUES(?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET
                institution=excluded.institution,source_type=excluded.source_type,
                official_url=excluded.official_url,integration_status=excluded.integration_status,note=excluded.note""",
                (s["id"], s["name"], s["kind"], s["base_url"], s["status"], s.get("note")))
        for r in snapshot["records"]:
            source_id = r["source_id"]
            if source_id not in sources:
                raise ValueError("Source non referencee: "+source_id)
            if r.get("eligibility") != "NON_ETABLIE":
                raise ValueError("Import non certifie: eligibilite affirmee sans validation")
            if r.get("funding_rate") is not None or r.get("funding_cap") is not None:
                raise ValueError("Montant non autorise dans la collecte brute")
            # L'import ne doit pas fabriquer une aide admissible ou ouverte.
            if r.get("status") != "A_VERIFIER" or r.get("instrument") != "NON_DETERMINE":
                raise ValueError("Statut ou instrument non conforme au collecteur")
            key = source_id + "|" + _text(r["external_id"], 255)
            url = r["url"]
            if not url.startswith("https://") or len(url)>2048:
                raise ValueError("Lien non HTTPS")
            conn.execute("""INSERT INTO funding_public_records
                (record_key,source_id,external_id,title,url,category,instrument,validation_status,
                eligibility_status,eligible_spending,funding_rate,funding_cap,deadline,issuer,
                territory,source_updated_at,observed_at,provenance,description)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(record_key) DO UPDATE SET
                title=excluded.title,url=excluded.url,category=excluded.category,
                source_updated_at=excluded.source_updated_at,observed_at=excluded.observed_at,
                provenance=excluded.provenance,description=excluded.description,
                issuer=excluded.issuer,territory=excluded.territory""",
                (key,source_id,_text(r["external_id"],255),_text(r["title"],255),url,
                 r["category"],r["instrument"],r["status"],r["eligibility"],None,None,None,None,
                 _text(r.get("issuer"),160),_text(r.get("territory"),160),
                 r.get("updated_at"),observed,_text(r.get("provenance"),130),r.get("description","")))
            for d in r.get("documents",[]):
                if not d.get("url","").startswith("https://"):continue
                conn.execute("""INSERT INTO funding_source_documents
                    (record_key,document_url,title,format,review_status)
                    VALUES(?,?,?,?,?) ON CONFLICT(record_key,document_url) DO UPDATE SET
                    title=excluded.title,format=excluded.format""",
                    (key,d["url"],_text(d.get("title"),255),_text(d.get("format"),30),"A_VERIFIER"))
        conn.execute("""INSERT INTO funding_ingest_runs
            (started_at,collection_mode,sources_checked,records_count,run_notes)
            VALUES(?,?,?,?,?)""", (observed,snapshot.get("collection_mode","INCONNU"),
            len(snapshot.get("runs",[])),len(snapshot["records"]),
            json.dumps(snapshot.get("runs",[]),ensure_ascii=False)[:7000]))
    bad=conn.execute("PRAGMA quick_check").fetchone()[0]
    if bad!="ok":raise RuntimeError("SQLite quick_check: "+bad)
    fk=conn.execute("PRAGMA foreign_key_check").fetchall()
    if fk:raise RuntimeError("Relations sources invalides")
    return {"records":conn.execute("SELECT COUNT(*) FROM funding_public_records").fetchone()[0],
            "documents":conn.execute("SELECT COUNT(*) FROM funding_source_documents").fetchone()[0],
            "sources":conn.execute("SELECT COUNT(*) FROM funding_sources").fetchone()[0],
            "integrity":"ok"}

if __name__=="__main__":
    if len(sys.argv)!=3:raise SystemExit("Usage: build_sqlite.py export.json cible.sqlite")
    base=Path(__file__).resolve().parent
    registry=json.loads((base/"registry.json").read_text(encoding="utf-8"))
    snapshot=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    dest=Path(sys.argv[2])
    dest.parent.mkdir(parents=True,exist_ok=True)
    # Refuse existing databases: no overwrite, no destructive write to a user's existing DB.
    if dest.exists():raise SystemExit("Cible existante refusee : choisissez un NOUVEAU fichier de sortie")
    conn=sqlite3.connect(str(dest))
    try:
        stats=build(conn,registry,snapshot)
        print(json.dumps(stats,ensure_ascii=False))
    except Exception:
        conn.close()
        dest.unlink(missing_ok=True)
        raise
    finally:
        try:conn.close()
        except:pass
