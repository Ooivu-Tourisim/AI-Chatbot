"""Prepare local SFT files; never upload data or start paid training."""
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "finetuning"
SYSTEM = """You are Aura, a Northern Sri Lanka travel assistant. Answer the customer's
actual question in their language, using Tamil script for Tamil and Tamil transliteration
when the customer uses it. Ask one relevant question at a time and remember corrections.
Never invent availability, facilities, supplier confirmations or confirmed prices.
The provided concepts are proposals; preserve indicative price units and require supplier
confirmation. Respect privacy, accessibility and cleaning preferences without making
medical claims. Only after explicit acceptance or a request to proceed, offer a localized
link to #package-builder. Nothing is booked. Prefix each answer with [[language:xx]],
using the supplied response language code. This prefix is removed by the application.
"""


def group(record):
    products = sorted(s for s in record["source"] if s.startswith("NORTH-CONCEPT-"))
    return "|".join(products) if products else record["topic"]


def write_jsonl(path, rows):
    path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")


def main():
    records = [json.loads(line) for line in (DATA / "jaffna_conversations.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    knowledge = json.loads((DATA / "northern_tourism_knowledge.json").read_text(encoding="utf-8"))
    products = {p["id"]: p for p in knowledge["products"]}
    assert len({r["id"] for r in records}) == len(records), "Duplicate example IDs"
    OUT.mkdir(exist_ok=True)
    manifest = {"trained": False, "base_model": "openai/gpt-oss-120b", "provider": "groq", "training_scope": "assistant text responses only; no speech or tool-call training", "datasets": {}}
    for name, selected in (("tamil", [r for r in records if r["language_code"] == "ta"]), ("multilingual", records)):
        groups = sorted({group(r) for r in selected}, key=lambda g: hashlib.sha256(g.encode()).hexdigest())
        held_out = set(groups[:max(1, round(len(groups) * .2))])
        splits = {"train": [], "validation": []}
        ids = {"train": [], "validation": []}
        for r in selected:
            split = "validation" if group(r) in held_out else "train"
            context = {"response_language_code": r["language_code"], "pricing_policy": knowledge["pricing_policy"], "concepts": [products[s] for s in r["source"] if s in products]}
            messages = [{"role": "system", "content": SYSTEM + "\nReference context:\n" + json.dumps(context, ensure_ascii=False)}]
            for m in r["messages"]:
                assert m["role"] in ("user", "assistant") and m["content"].strip()
                content = m["content"]
                if m["role"] == "assistant":
                    content = f'[[language:{r["language_code"]}]]\n' + content
                messages.append({"role": m["role"], "content": content})
            assert messages[-1]["role"] == "assistant"
            splits[split].append({"messages": messages})
            ids[split].append(r["id"])
        assert splits["train"] and splits["validation"]
        assert {group(r) for r in selected if r["id"] in ids["train"]}.isdisjoint({group(r) for r in selected if r["id"] in ids["validation"]})
        for split, rows in splits.items():
            write_jsonl(OUT / f"{name}_{split}.jsonl", rows)
        manifest["datasets"][name] = {"counts": {s: len(rows) for s, rows in splits.items()}, "source_ids": ids, "languages": dict(Counter(r["language_code"] for r in selected)), "sha256": {s: hashlib.sha256((OUT / f"{name}_{s}.jsonl").read_bytes()).hexdigest() for s in splits}}
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({name: d["counts"] for name, d in manifest["datasets"].items()}))


if __name__ == "__main__":
    main()
