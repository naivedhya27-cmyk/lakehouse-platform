# ai_sdr

A small, opinionated outbound-email pipeline for indie B2B SaaS founders
who want personalized cold emails without paying for a "sales engagement
platform" or training a fresh BDR. Stdlib-only, no API keys required to
run v1.

## Who this is for

Founders selling to other founders, where every cold email needs to
read like a curious DM from a peer — not a sequenced template from a
1,000-account blast. The pipeline is built around one rule: **every
email is graded before it ships, and rewritten if any axis underscores.**

## What it does

```
prospects.csv ──► enrich ──► generate ──► critique ──► rewrite? ──► drafts.csv
                    │            │            │
                    │            │            └─ specificity / humanness / curiosity
                    │            │
                    │            └─ template driven by knowledge_base.py hooks
                    │               (LLM-ready: see TODO in generate.py)
                    │
                    └─ live homepage scrape with KB fallback
```

## Run it

```bash
python -m ai_sdr.cli run --input prospects.csv --output drafts.csv
```

Outputs:
- `enriched.json` — raw enrichment per prospect (scrape data + KB lookup)
- `drafts.csv` — `company_domain, first_name_guess, subject, body,
  specificity_score, humanness_score, curiosity_score, critique_notes`

## QC philosophy

Every draft is scored 1–10 on three axes before it's allowed into
`drafts.csv`:

- **specificity** — does S1 reference a real, company-specific feature
  or wedge? (no "I love your product" garbage)
- **humanness** — sentence-length variance, no banned phrases
  (`"I hope this finds you well"`, `"circle back"`, `"synergy"`, ...)
- **curiosity** — does the close end with a question, not a meeting ask?

If any axis falls below `min_critique_score` (default 8), the orchestrator
runs a single rewrite pass with stricter constraints and keeps whichever
draft scored higher overall. Drafts that still don't pass are written to
the CSV anyway, with their scores attached so you can see which ones
need a manual editing pass.

## Architecture

```
ai_sdr/
├── cli.py             argparse → run subcommand
├── config.py          load config.yaml → typed Config
├── models.py          dataclasses passed between stages
├── io_utils.py        defensive CSV / JSON I/O
├── knowledge_base.py  structured facts for known target companies
├── enrich.py          live scrape → KB fallback → EnrichedProspect
├── generate.py        template (LLM-ready) → EmailDraft
├── critique.py        heuristic scoring (LLM-ready) → CritiqueResult
└── tests/test_smoke.py
```

Each module exposes one verb; each verb returns a dataclass from
`models.py`. The whole pipeline is composed in `cli._process_one()`.

## Example output (linear.app)

```
subject: fwd: linear triage idea
body:    Your Triage inbox basically templated how every modern issue
         tracker handles incoming reports — copied everywhere now.
         Curious whether your own inbound contact-form leads still get
         hand-sorted into Slack and Notion every morning. I built a
         4-min Loom showing this for a company like yours. Want me to
         send it over?
spec=10 hum=10 cur=10  [ok]
```

## Upgrade path to LLM

The deterministic template path is good enough to ship today, but the
pipeline is built so the LLM swap is one function each:

- `generate._llm_compose_TODO` → real Anthropic call (signature in the
  docstring)
- `critique.critique` → an LLM judge re-reading `prompts/write_emails.md`

Both contracts return the same dataclass; nothing else in the pipeline
needs to change.

## Config

Edit `config.yaml` at the repo root:

```yaml
max_words: 65
target_subject_words_max: 5
min_critique_score: 8
rewrite_passes: 1
sender_first_name: "navi"
loom_url_placeholder: "{LOOM_URL}"
```

## Adding a new prospect

The knowledge base ships pre-populated with a curated set of companies.
For anything new, you don't have to hand-write an entry — `scout.py`
(at the repo root) will scrape the homepage and populate one for you.

```bash
# 1. Add the domain to a fresh CSV
echo "company_domain"   >  fresh_prospects.csv
echo "newcompany.com"  >>  fresh_prospects.csv

# 2. Run scout locally (NOT inside the agent sandbox — needs outbound HTTP).
python scout.py --input fresh_prospects.csv

# 3. scout.py writes ai_sdr/knowledge_base_extra.py — a Python module
#    exposing an EXTRA dict of {domain: KnowledgeEntry}. The main
#    knowledge base auto-merges it on import (no code changes needed).

# 4. Re-run the pipeline; the new prospect now gets full personalization.
python -m ai_sdr.cli run --input prospects.csv --output drafts.csv
```

`scout.py` fetches `/`, `/blog`, and `/changelog` with a real User-Agent.
On Cloudflare 403 / network failure / 5xx, it transparently retries via
`web.archive.org`'s most recent snapshot. Stdlib only — no `pip install`.
A single bad domain never crashes the run.

Founder name and curated wedge fields are left blank by `scout.py` — the
LLM path can still write a personalized email from the scraped signature
feature and personalization hook, but you'll get the best results by
filling those two fields by hand once after scouting.

## Using a real LLM

The default deterministic generator runs with no API key. To switch on
the LLM path:

```bash
# 1. Export your Anthropic key
export ANTHROPIC_API_KEY=sk-ant-...

# 2. Flip the flag in config.yaml
sed -i 's/^use_llm: false/use_llm: true/' config.yaml

# 3. Re-run
python -m ai_sdr.cli run --input prospects.csv --output drafts.csv
```

Behavior:
- The orchestrator calls `generate_via_llm` first, which POSTs to
  `https://api.anthropic.com/v1/messages` with the system prompt at
  `ai_sdr/prompts/email_writer.system.md` and a structured user prompt
  built from the enriched record.
- 3 retries with exponential backoff on network errors and 5xx/429.
- Auth failures (401/403), rate-limit-after-retries, parse errors, or a
  missing key all raise `LLMUnavailable`. The orchestrator catches it,
  logs a warning, and falls back to the deterministic generator. The
  pipeline never crashes because of LLM issues.
- The critique loop runs identically on either path's output.

Bump the model alias in `ai_sdr/generate.py::MODEL_NAME` when a newer
sonnet ships — that's the only line that needs to change.

## Tests

```bash
python -m unittest ai_sdr.tests.test_smoke
# or, if pytest is available:
python -m pytest ai_sdr/tests
```

The smoke test runs the full pipeline on a single-row prospects.csv
(`linear.app`) end-to-end and asserts that `drafts.csv` exists with a
non-empty body. It uses stdlib `unittest` so no extra dependency is
required.
