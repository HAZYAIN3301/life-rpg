# Secretary: optional local Ollama and selected files — v268

Implemented 2026-09-21. This is a server-local provider and an ephemeral text-file
index, not a shared ecosystem database or a remote bridge to the owner's Mac.

## Configuration
Run Satoru on the same machine as Ollama. Explicit administrator configuration:

```
SATORU_OLLAMA_ENABLED=1
SATORU_OLLAMA_USERS=<comma-separated Satoru account IDs>
OLLAMA_MODEL=qwen3.5:9b-mlx
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

Install/pull the chosen model separately. The app never downloads models.
Allowed users choose Ollama in Settings → connections → AI provider. Configured
status means authorized configuration, not a successful model health probe.
Only loopback URLs are accepted. Model metadata must describe local completion
weights; remote/cloud aliases fail before private context is sent. API requests
cannot choose the host or model. Explicit Ollama requests never fall back to cloud.
One inference at a time, 120-second timeout, bounded response, 48,000-character
input ceiling; oversized context fails visibly instead of truncating silently.
Railway cannot access a model on a user's Mac through its own localhost.
Production deployment therefore leaves this provider disabled unless deliberately
configured on a server hosting Ollama; existing cloud providers keep working.

## Files
Up to five explicitly selected TXT/MD/Markdown/JSON/CSV files, 512 KiB each.
The browser indexes their full text in memory and selects up to eight matching
chunks, around 12,000 characters plus metadata, for the current question.
It sends those fragments and filenames to the selected provider on submission.
This replaces the old first-20,000-character attachment truncation.
Retrieval is lexical with basic word-prefix matching, not semantic embeddings.
Unsupported/oversized input is rejected. No implicit filesystem scanning or
persistent document library. Removal/account reset clears the attachment; account
and write-epoch guards reject stale uploads and chat completions.

Answers include an expandable view of the actual supplied fragments. This does
not certify the model's claims or citations: Qwen sometimes invents exact line
numbers inside an otherwise relevant chunk. File contents are untrusted data.

## Evidence and limits
Ollama 0.34.2, installed qwen3.5:9b-mlx on 24 GiB Mac. Synthetic benchmark receipt:
art-factory/secretary-v267/local-benchmark.json (filename records pre-merge work).
20/20 requested facts/refusals correct; only 9/20 strict citation format checks
passed. Median 1.339 s; repetitive extraction smoke cases, not intelligence or
Gemini comparison. Real browser chat recovered a fact beyond 20k characters and
a budget from another file. It also made unsupported descriptive claims and
inexact line references; original excerpts were visibly correct. No claim that
local Qwen is smarter than Gemini or ready for autonomous financial operations.

## Next increments
1. Persistent per-account document library: revisions, deletion, permissions,
   provenance and retrieval evaluation; then semantic/hybrid search and embeddings.
2. Paired native Mac connector for production-to-local inference, with explicit
   per-account grants, revocation, bounded jobs, offline behavior, no public Ollama.
3. Typed Satoru APIs/events for planner/cards/sport/finance; models remain replaceable.
4. Read-only MCP tools for Codex/Claude Code first; separately authorized writes.
5. Same-data Gemini/Groq/local evaluation before changing any default provider.
