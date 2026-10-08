import os
import gc
import tempfile
import unittest

import database
import rag


class DatabaseRetrievalTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=os.path.dirname(__file__))
        self.original = database.DB_PATH
        database.DB_PATH = os.path.join(self.tmp.name, "packages.db")
        database.init_db()

    def tearDown(self):
        database.DB_PATH = self.original
        # Existing database helpers use transaction contexts; collect their
        # connections before deleting the temporary file on Windows.
        gc.collect()
        self.tmp.cleanup()

    def test_destination_and_explicit_id(self):
        matches = rag.retrieve("Delft wild ponies")
        self.assertEqual(matches[0]["id"], "NOC-ISL-02")
        self.assertEqual(rag.retrieve("NOC-ROM-06 inclusions")[0]["id"], "NOC-ROM-06")

    def test_follow_up_keeps_referenced_package(self):
        matches = rag.retrieve("What is included?", ["Try [NOC-ROM-06] for your honeymoon."])
        self.assertEqual(matches[0]["id"], "NOC-ROM-06")
        self.assertIn("exclusions", rag.build_context("NOC-ROM-06"))

    def test_updates_and_inactive_records(self):
        with database.get_connection() as conn:
            conn.execute("UPDATE packages SET price_lkr = 123456 WHERE id = ?", ("NOC-ISL-02",))
        self.assertEqual(rag.retrieve("NOC-ISL-02")[0]["price_lkr"], 123456)
        with database.get_connection() as conn:
            conn.execute("UPDATE packages SET is_active = 0 WHERE id = ?", ("NOC-ISL-02",))
        self.assertNotIn("NOC-ISL-02", rag.build_context("NOC-ISL-02"))

    def test_unmatched_and_fts_syntax(self):
        self.assertEqual(rag.retrieve("zzzzunmatched"), [])
        self.assertEqual(rag.retrieve('" OR * () --'), [])
        self.assertIn("No matching detailed records", rag.build_context(""))


if __name__ == "__main__":
    unittest.main()
