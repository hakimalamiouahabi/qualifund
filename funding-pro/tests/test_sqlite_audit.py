import hashlib
import sqlite3
import tempfile
import unittest
from pathlib import Path
import importlib.util

MODULE = Path(__file__).resolve().parents[1] / "sqlite_audit.py"
spec = importlib.util.spec_from_file_location("sqlite_audit", MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SQLiteAuditTests(unittest.TestCase):
    def test_snapshot_readonly_and_zero_data_export(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "mock.db"
            db = sqlite3.connect(path)
            db.executescript("""
                PRAGMA foreign_keys=ON;
                CREATE TABLE dossier(id INTEGER PRIMARY KEY, confidential_text TEXT);
                CREATE INDEX idx_dossier_secret ON dossier(confidential_text);
                INSERT INTO dossier(confidential_text) VALUES('CONFIDENTIEL-DOIT-RESTER-LOCAL');
            """)
            db.close()
            digest = lambda: hashlib.sha256(path.read_bytes()).hexdigest()
            before = digest()
            result = module.audit_sqlite_snapshot(str(path))
            self.assertEqual(result["status"], "PASS")
            self.assertEqual(result["table_names"], ["dossier"])
            self.assertEqual(result["index_count"], 1)
            self.assertFalse(result["automatic_cleanup"])
            self.assertNotIn("CONFIDENTIEL-DOIT-RESTER-LOCAL", str(result))
            self.assertEqual(before, digest())

    def test_missing_file_blocked(self):
        with self.assertRaises(FileNotFoundError):
            module.audit_sqlite_snapshot("/this-file-does-not-exist-7c0f.db")


if __name__ == "__main__":
    unittest.main()
