# Jaffna conversation and local knowledge dataset

The supplied concept document is preserved in `data/northern_tourism_source.txt`.
Its 31 detailed experience records are normalized in
`data/northern_tourism_knowledge.json`, with source-line references, original
price units, durations, audience and supplier conditions. These are proposals,
not verified current supplier rates or active booking products.

`data/jaffna_conversations.jsonl` contains 54 illustrative dialogues: one per
detailed experience, 12 planning and exception scenarios, and a localized
food-and-craft handoff conversation in English, Tamil, Sinhala, German, French,
Arabic, Korean, Chinese, Hindi, Italian and Spanish. The readable edition is
`docs/jaffna_conversations.md`. Localized examples should receive native-speaker
editorial review before being used as public marketing copy.

Examples cover family accessibility, planting season, realistic district coverage,
surprise privacy, food allergies, pilgrimage, women's groups, price units,
weather alternatives, photography consent, corrections and acceptance handoff.
They demonstrate answering the question, remembering corrections, asking one
relevant next question, and opening Build my own trip only after acceptance.

`backend/local_knowledge.py` supplies the source knowledge to Aura's chat prompt.
It keeps the concept directory separate from active SQLite package IDs and quote
values. Customers can discuss proposed experiences, but unlisted activities must
remain wishes for staff confirmation rather than becoming priced builder options.
No new provider rates, booking availability, ferry timetables or field seasons
were invented. No active database products were changed.

The dataset is a local reference and evaluation artifact. It does not fine-tune
Groq or change Azure recognition/synthesis models. Retrieval currently selects
additional detail by text overlap; the concept directory and shared responsible
tourism rules are always available. No external model calls were used to generate
these examples.

Rebuild from `backend`:

```powershell
.\.venv\Scripts\python.exe ..\data\build_dataset.py
.\.venv\Scripts\python.exe -m unittest test_local_knowledge -v
```

Restart the backend to use the local knowledge in chat. Before promoting a
proposed experience to an active product, confirm its suppliers, price basis,
permissions, capacity, availability, inclusions and cancellation terms.
