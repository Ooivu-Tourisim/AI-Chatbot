# Aura fine-tuning preparation

Run `backend/.venv/Scripts/python.exe data/prepare_finetuning.py` from tourism.
Outputs under `data/finetuning` contain messages-only supervised training records:

- Tamil: 21 training dialogues and 5 validation dialogues.
- Multilingual: 102 training dialogues and 21 validation dialogues, including Tamil.
- `manifest.json`: source IDs, language counts and file hashes; `trained: false`.

Related topic variants or product references stay in the same split to reduce
validation leakage. Indicative product facts are provided in system context,
not presented as confirmed booking facts. Assistant answers include Aura's
language prefix. Use an assistant-only loss mask with the chosen model's chat
template; do not train on system or user tokens. Review Tamil fluency with a
native speaker before spending money on training. These small synthetic datasets
are a starting point, not evidence of reliable general multilingual performance.

No data has been uploaded and no model has been trained or switched. Groq's
current [LoRA documentation](https://console.groq.com/docs/lora) describes
enterprise inference of externally trained adapters, not dataset training.
Its documented supported base is Llama 3.1 8B, not the currently configured
`openai/gpt-oss-120b`. An 8 GB laptop GPU cannot fine-tune that 120B model locally.
Retaining both the current model and Groq API requires Groq to confirm hosting
support and an external training environment with sufficient memory.

The files train text response behavior only. Azure speech recognition and voice
generation stay separate. Before deploying a trained model, evaluate language
matching, current catalogue answers, pricing units, corrections, privacy,
cleanliness preferences, acceptance handoff and budget tool calls against the
existing model. These examples do not train tool calls or structured planning
outputs. Deployment must preserve the existing retrieval and pricing tools.
