import json
import unittest
from pathlib import Path
from local_knowledge import DATA_PATH, build_local_context


class LocalKnowledgeTests(unittest.TestCase):
    def test_prices_keep_units_and_concepts_cannot_be_booked_as_packages(self):
        context = build_local_context("paddy planting")
        self.assertIn("LKR 3,000–6,000 per person", context)
        self.assertIn("NOT active or confirmed bookable packages", context)
        self.assertIn("NEVER put NORTH-CONCEPT IDs into the builder", context)
        self.assertIn("Only during suitable planting periods", context)

    def test_examples_cover_localization_and_reference_existing_source_records(self):
        data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        ids = {p["id"] for p in data["products"]}
        examples = [json.loads(line) for line in DATA_PATH.with_name("jaffna_conversations.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual({e["language_code"] for e in examples}, {"en", "si", "ta", "de", "fr", "ar", "ko", "zh", "hi", "it", "es"})
        for example in examples:
            self.assertTrue(example["illustrative"])
            self.assertEqual([m["role"] for m in example["messages"]], ["user", "assistant", "user", "assistant"])
            for source in example["source"]:
                self.assertTrue(source in ids or source == "northern_tourism_source.txt")

    def test_every_source_concept_has_a_conversation(self):
        data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        examples = [json.loads(line) for line in DATA_PATH.with_name("jaffna_conversations.jsonl").read_text(encoding="utf-8").splitlines()]
        references = {source for example in examples for source in example["source"]}
        self.assertTrue(all(product["id"] in references for product in data["products"]))
