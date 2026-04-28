"""CLI entrypoint.

    python -m ai_sdr.cli run --input prospects.csv --output drafts.csv

`run` does enrich → generate → critique → (rewrite if needed) for every
prospect, then writes drafts.csv plus enriched.json.
"""

import argparse
import logging
import os
from pathlib import Path
from typing import List, Tuple

from .config import Config, load_config
from .critique import critique
from .enrich import enrich
from .generate import LLMUnavailable, generate, generate_via_llm, rewrite
from .io_utils import read_prospects, write_drafts_csv, write_json
from .models import CritiqueResult, EmailDraft, EnrichedProspect


_log = logging.getLogger("ai_sdr.cli")


def _initial_draft(record: EnrichedProspect, config: Config) -> EmailDraft:
    """Route to LLM if enabled+available; otherwise deterministic. Never crashes."""
    if config.use_llm and os.environ.get("ANTHROPIC_API_KEY"):
        try:
            return generate_via_llm(record, config)
        except LLMUnavailable as e:
            _log.warning(
                "LLM unavailable for %s (%s) — falling back to deterministic generator",
                record.company_domain,
                e,
            )
    return generate(record, config)


def _process_one(record: EnrichedProspect, config: Config) -> Tuple[EmailDraft, CritiqueResult]:
    draft = _initial_draft(record, config)
    result = critique(draft, record, config)
    passes_remaining = config.rewrite_passes
    while not result.passes and passes_remaining > 0:
        candidate = rewrite(record, draft, result, config)
        candidate_result = critique(candidate, record, config)
        # Keep whichever scores higher in aggregate.
        if (
            candidate_result.specificity + candidate_result.humanness + candidate_result.curiosity
        ) > (result.specificity + result.humanness + result.curiosity):
            draft, result = candidate, candidate_result
        passes_remaining -= 1
    return draft, result


def cmd_run(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    prospects = read_prospects(args.input)
    if not prospects:
        print(f"[ai_sdr] no prospects found in {args.input}")
        return 2

    enriched: List[EnrichedProspect] = []
    pairs: List[Tuple[EmailDraft, CritiqueResult]] = []

    for p in prospects:
        try:
            record = enrich(p)
        except Exception as e:
            record = EnrichedProspect(
                company_domain=p.company_domain,
                source="none",
                errors=[f"enrich_failed:{type(e).__name__}:{e}"],
            )
        enriched.append(record)
        try:
            draft, result = _process_one(record, config)
        except Exception as e:
            print(f"[ai_sdr] {p.company_domain}: pipeline error {e}")
            continue
        pairs.append((draft, result))

    write_json(enriched, args.enriched_out)
    write_drafts_csv(pairs, args.output)

    print(f"[ai_sdr] processed {len(prospects)} prospect(s)")
    print(f"[ai_sdr] enriched.json -> {args.enriched_out}")
    print(f"[ai_sdr] drafts.csv    -> {args.output}")
    passing = sum(1 for _, c in pairs if c.passes)
    print(f"[ai_sdr] critique pass rate: {passing}/{len(pairs)}")
    for draft, result in pairs:
        flag = "ok" if result.passes else "rewrite"
        print(
            f"  - {draft.company_domain:<14} "
            f"spec={result.specificity} hum={result.humanness} cur={result.curiosity} [{flag}]"
        )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ai_sdr", description="AI SDR pipeline.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    run = sub.add_parser("run", help="enrich + generate + critique end-to-end")
    run.add_argument("--input", default="prospects.csv")
    run.add_argument("--output", default="drafts.csv")
    run.add_argument("--enriched-out", default="enriched.json")
    run.add_argument(
        "--config",
        default=str(Path(__file__).resolve().parent.parent / "config.yaml"),
    )
    run.set_defaults(func=cmd_run)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
