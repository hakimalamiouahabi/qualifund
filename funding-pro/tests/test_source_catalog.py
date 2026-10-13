import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/"sources"
spec=importlib.util.spec_from_file_location("funding_public_sqlite",ROOT/"build_sqlite.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
REGISTRY=json.loads((ROOT/"registry.json").read_text(encoding="utf-8"))

def snapshot(eligibility="NON_ETABLIE",rate=None):
    return {"schema_version":1,"collection_mode":"TEST_OFFLINE","generated_at":"2026-10-13T00:00:00Z","runs":[],
            "records":[{"source_id":"datagouv","external_id":"r1","title":"Documents FEDER",
            "url":"https://www.data.gouv.fr/datasets/notice","category":"JEU_DE_DONNEES",
            "instrument":"NON_DETERMINE","status":"A_VERIFIER","eligibility":eligibility,
            "funding_rate":rate,"funding_cap":None,"documents":[{"title":"Guide",
            "url":"https://www.data.gouv.fr/doc.pdf","format":"pdf"}],
            "provenance":"TEST_NON_CERTIFIANT"}]}

class SourceDatabaseTest(unittest.TestCase):
    def test_build_and_idempotent_upsert(self):
        with tempfile.TemporaryDirectory() as tmp:
            conn=sqlite3.connect(Path(tmp)/"sources.sqlite")
            a=module.build(conn,REGISTRY,snapshot())
            b=module.build(conn,REGISTRY,snapshot())
            self.assertEqual(a["records"],1)
            self.assertEqual(b["records"],1)
            self.assertEqual(b["documents"],1)
            self.assertEqual(b["sources"],len(REGISTRY["sources"]))
            x=conn.execute("select eligibility_status, funding_rate, validation_status from funding_public_records").fetchone()
            self.assertEqual(x,("NON_ETABLIE",None,"A_VERIFIER"))
            conn.close()
    def test_no_fake_eligibility_or_rates(self):
        with sqlite3.connect(":memory:") as conn:
            with self.assertRaises(ValueError):
                module.build(conn,REGISTRY,snapshot(eligibility="CERTIFIEE"))
            with self.assertRaises(ValueError):
                module.build(conn,REGISTRY,snapshot(rate=0.75))
    def test_unknown_source_rejected(self):
        r=snapshot()
        r["records"][0]["source_id"]="agent_ia_invente"
        with sqlite3.connect(":memory:") as conn:
            with self.assertRaises(ValueError):
                module.build(conn,REGISTRY,r)

if __name__=="__main__": unittest.main()
