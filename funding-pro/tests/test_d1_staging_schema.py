import sqlite3
import unittest
from pathlib import Path

class D1StagingSchemaTest(unittest.TestCase):
    def test_public_catalog_schema_no_destructive_statement(self):
        sql=(Path(__file__).resolve().parents[1]/"sources"/"d1_staging_schema.sql").read_text(encoding="utf-8")
        upper=sql.upper()
        # Ignore SQL comments when checking potentially destructive statements.
        executable="\n".join(line for line in upper.splitlines() if not line.lstrip().startswith("--"))
        for token in ("DROP TABLE","DELETE FROM","TRUNCATE","VACUUM","UPDATE "):
            self.assertNotIn(token,executable)
        conn=sqlite3.connect(":memory:")
        try:
            conn.executescript(sql)
            tables={r[0] for r in conn.execute("select name from sqlite_master where type='table'")}
            self.assertTrue({"funding_sources","funding_public_records","funding_source_documents","funding_ingest_runs"}.issubset(tables))
            self.assertEqual(conn.execute("PRAGMA quick_check").fetchone()[0],"ok")
        finally:conn.close()

if __name__=="__main__":unittest.main()
