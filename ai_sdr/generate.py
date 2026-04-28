"""Email generator.

Two paths:

1. Deterministic template engine driven by knowledge_base hooks. Runs
   offline, no API key required, used by default.

2. `generate_via_llm` — calls the Anthropic Messages API with the system
   prompt at prompts/email_writer.system.md. Used when config.use_llm is
   true AND ANTHROPIC_API_KEY is set. On any failure (auth, rate limit,
   network, parse error) raises LLMUnavailable; the orchestrator catches
   it and falls back to the deterministic path. The pipeline never
   crashes because of LLM issues.

Templating rules (deterministic path; mirror prompts/email_writer.system.md):
- Body: ≤ config.max_words, exactly 4 sentences.
- S1: ideal_personalization_hook — must reference a real, specific feature.
- S2: ai_sdr_workflow_hypothesis — plausible internal workflow to automate.
- S3: hardcoded "I built a 4-min Loom showing this for a company like yours."
- S4: soft question CTA — never a meeting ask.
- Subject: 3–5 lowercase words, internal-forward feel.
"""

import json
import logging
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Optional

from .config import Config
from .models import CritiqueResult, EmailDraft, EnrichedProspect


# Latest sonnet alias — bump here when a new model ships.
MODEL_NAME = "claude-sonnet-4-5"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
LLM_MAX_TOKENS = 600
LLM_TIMEOUT_S = 30
LLM_MAX_RETRIES = 3

_log = logging.getLogger("ai_sdr.generate")


class LLMUnavailable(Exception):
    """Raised when the LLM path can't produce a valid draft.

    Anything from missing API key, auth/rate-limit responses, network
    errors after retries, or unparseable model output. The orchestrator
    catches this and falls back to the deterministic generator.
    """


_S3 = "I built a 4-min Loom showing this for a company like yours."

# Two CTA pools so the rewrite path can pick a different one.
_CTA_DEFAULT = "Want me to send it over?"
_CTA_TIGHT = "Is that even a real bottleneck on your side?"
_CTA_REWRITE = "Worth a look, or already solved?"


def _word_count(text: str) -> int:
    return len(text.split())


def _trim_to_word_budget(body: str, budget: int) -> str:
    """If over budget, drop adjective-ish filler before sentences. Last resort:
    truncate at sentence boundary."""
    if _word_count(body) <= budget:
        return body
    sentences = [s.strip() for s in body.split(".") if s.strip()]
    while sentences and _word_count(". ".join(sentences)) > budget:
        sentences.pop(0) if len(sentences) > 4 else sentences.__setitem__(
            0, " ".join(sentences[0].split()[:-1])
        )
        if not sentences[0]:
            break
    return ". ".join(sentences) + ("." if sentences else "")


def _compose_subject(domain: str, hint: str, max_words: int) -> str:
    stem = domain.split(".")[0]
    candidate = f"fwd: {stem} {hint} idea".lower()
    words = candidate.split()
    if len(words) > max_words:
        candidate = " ".join(words[:max_words])
    return candidate


def _default_template(record: EnrichedProspect, config: Config, cta: str) -> tuple[str, str]:
    """Return (subject, body) using the KB hooks."""
    kb = record.kb
    if kb is None:
        # Last-resort fallback when no KB and scrape failed.
        title = record.scraped.title or record.company_domain
        s1 = f"Saw {title} — the positioning is sharper than most in the category."
        s2 = (
            "Curious whether your inbound still gets manually triaged before "
            "the right person gets pinged."
        )
        subject = f"fwd: {record.company_domain.split('.')[0]} idea".lower()
    else:
        s1 = f"{kb.ideal_personalization_hook}."
        s2 = f"{kb.ai_sdr_workflow_hypothesis}."
        subject = _compose_subject(
            kb.domain, kb.subject_hint, config.target_subject_words_max
        )

    body = " ".join([s1, s2, _S3, cta])
    return subject, body


def generate(record: EnrichedProspect, config: Config) -> EmailDraft:
    """Deterministic template path. Always works, no API key required."""
    subject, body = _default_template(record, config, _CTA_DEFAULT)
    body = _trim_to_word_budget(body, config.max_words)
    first_name = record.kb.founder_first_name if record.kb else ""
    return EmailDraft(
        company_domain=record.company_domain,
        first_name_guess=first_name,
        subject=subject,
        body=body,
    )


# ---------------------------------------------------------------------------
# LLM path
# ---------------------------------------------------------------------------


def _load_system_prompt() -> str:
    path = Path(__file__).resolve().parent / "prompts" / "email_writer.system.md"
    try:
        return path.read_text(encoding="utf-8")
    except OSError as e:
        raise LLMUnavailable(f"system prompt unreadable: {e}") from e


def _build_user_prompt(record: EnrichedProspect, config: Config) -> str:
    lines = [f"# Target: {record.company_domain}"]
    if record.kb is not None:
        kb = record.kb
        lines += [
            "",
            "## Company facts (curated)",
            f"- Founder first name: {kb.founder_first_name}",
            f"- Product one-liner: {kb.product_one_liner}",
            f"- Signature feature: {kb.signature_feature}",
            f"- Positioning wedge: {kb.positioning_wedge}",
            f"- Personalization hook: {kb.ideal_personalization_hook}",
            f"- AI-SDR workflow hypothesis: {kb.ai_sdr_workflow_hypothesis}",
            f"- Subject hint: {kb.subject_hint}",
        ]
    s = record.scraped
    if s and (s.title or s.h1 or s.paragraphs or s.meta_description):
        lines += [
            "",
            "## Scraped homepage (fresh)",
            f"- Title: {s.title}",
            f"- Meta description: {s.meta_description}",
            f"- H1: {s.h1}",
            f"- First paragraphs: {s.paragraphs[:2]}",
            f"- Latest blog post title: {s.latest_blog_post_title}",
        ]
    lines += [
        "",
        "## Constraints",
        f"- Body: max {config.max_words} words, exactly 4 sentences.",
        f"- Subject: max {config.target_subject_words_max} lowercase words.",
        f"- Sender persona: indie AI builder named {config.sender_first_name}.",
        "",
        'Return ONLY JSON: {"subject": "...", "body": "..."}',
    ]
    return "\n".join(lines)


def _call_anthropic(system: str, user: str) -> str:
    """POST to /v1/messages with retries. Returns raw response body text.

    Raises LLMUnavailable on auth failures or after retries are exhausted.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise LLMUnavailable("ANTHROPIC_API_KEY not set")

    payload = json.dumps(
        {
            "model": MODEL_NAME,
            "max_tokens": LLM_MAX_TOKENS,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
    ).encode("utf-8")
    headers = {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }

    backoff = 1.0
    last_err: Optional[BaseException] = None
    for attempt in range(LLM_MAX_RETRIES):
        try:
            req = urllib.request.Request(
                ANTHROPIC_URL, data=payload, headers=headers, method="POST"
            )
            with urllib.request.urlopen(req, timeout=LLM_TIMEOUT_S) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (401, 403):
                raise LLMUnavailable(f"auth failed: HTTP {e.code}") from e
            if e.code == 429 or 500 <= e.code < 600:
                _log.warning("anthropic %s on attempt %d, backing off %.1fs", e.code, attempt + 1, backoff)
                time.sleep(backoff)
                backoff *= 2
                continue
            raise LLMUnavailable(f"unexpected HTTP {e.code}") from e
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
            _log.warning("network error on attempt %d (%s), backing off %.1fs", attempt + 1, e, backoff)
            time.sleep(backoff)
            backoff *= 2
            continue

    raise LLMUnavailable(f"max retries exhausted: {last_err}")


def _parse_response_payload(raw: str) -> dict[str, Any]:
    """Pull {"subject", "body"} out of the model response. Defensive."""
    try:
        envelope = json.loads(raw)
    except json.JSONDecodeError as e:
        raise LLMUnavailable(f"response not JSON: {e}") from e
    try:
        text = envelope["content"][0]["text"]
    except (KeyError, IndexError, TypeError) as e:
        raise LLMUnavailable(f"response shape unexpected: {e}") from e

    text = text.strip()
    # Strip optional markdown fences.
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    parsed: Optional[dict] = None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                parsed = json.loads(m.group(0))
            except json.JSONDecodeError as e:
                raise LLMUnavailable(f"could not parse JSON from model output: {e}") from e
    if not isinstance(parsed, dict):
        raise LLMUnavailable("model output did not contain a JSON object")

    subject = str(parsed.get("subject", "")).strip().lower()
    body = str(parsed.get("body", "")).strip()
    if not subject or not body:
        raise LLMUnavailable("subject or body empty")
    return {"subject": subject, "body": body}


def generate_via_llm(record: EnrichedProspect, config: Config) -> EmailDraft:
    """LLM-backed draft. Raises LLMUnavailable on any recoverable failure.

    The orchestrator (cli._process_one) catches LLMUnavailable and
    transparently falls back to `generate()`.
    """
    system = _load_system_prompt()
    user = _build_user_prompt(record, config)
    raw = _call_anthropic(system, user)
    parsed = _parse_response_payload(raw)
    body = _trim_to_word_budget(parsed["body"], config.max_words)
    first_name = record.kb.founder_first_name if record.kb else ""
    return EmailDraft(
        company_domain=record.company_domain,
        first_name_guess=first_name,
        subject=parsed["subject"],
        body=body,
    )


def rewrite(
    record: EnrichedProspect,
    previous: EmailDraft,
    critique: CritiqueResult,
    config: Config,
) -> EmailDraft:
    """Single rewrite pass with stricter constraints.

    Strategy: pick a tighter CTA, prepend the signature feature name to S1
    if specificity scored low. TODO: in the LLM version, re-prompt with the
    critique's reasoning string as guidance.
    """
    cta = _CTA_TIGHT if critique.curiosity < config.min_critique_score else _CTA_REWRITE
    subject, body = _default_template(record, config, cta)

    if critique.specificity < config.min_critique_score and record.kb:
        # Prepend the signature feature name to S1 to force concreteness.
        kb = record.kb
        feature_name = kb.signature_feature.split("—")[0].strip().rstrip(".")
        body_parts = body.split(". ", 1)
        if body_parts:
            body_parts[0] = f"{feature_name} — {body_parts[0]}"
        body = ". ".join(body_parts)

    body = _trim_to_word_budget(body, config.max_words)
    first_name = record.kb.founder_first_name if record.kb else ""
    return EmailDraft(
        company_domain=record.company_domain,
        first_name_guess=first_name,
        subject=subject,
        body=body,
    )
