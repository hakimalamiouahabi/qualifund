-- FUNDING PRO — SCHEMA POUR UNE NOUVELLE D1 DE STAGING UNIQUEMENT.
-- NE PAS executer sur artscan-rd, ap-leyton-prod ou mnin-nbda-staging.
-- Schema reserve au catalogue PUBLIC. Jamais de donnees de dossiers clients.
-- Aucun SQL de suppression ou de migration destructive.
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
  UNIQUE(source_id,external_id)
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
