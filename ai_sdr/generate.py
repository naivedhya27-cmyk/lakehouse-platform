"""Email generator.

v1: deterministic template engine driven by knowledge_base hooks.
A real LLM call slots in at the marked TODO — same input/output contract,
swap the body of `_compose_with_llm` and route `generate()` through it.

Templating rules (mirror prompts/write_emails.md):
- Body: ≤ config.max_words, exactly 4 sentences.
- S1: ideal_personalization_hook — must reference a real, specific feature.
- S2: ai_sdr_workflow_hypothesis — plausible internal workflow to automate.
- S3: hardcoded "I built a 4-min Loom showing this for a company like yours."
- S4: soft question CTA — never a meeting ask.
- Subject: 3–5 lowercase words, internal-forward feel.
"""

from .config import Config
from .models import CritiqueResult, EmailDraft, EnrichedProspect


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


def _llm_compose_TODO(record: EnrichedProspect, config: Config) -> tuple[str, str]:
    """TODO: real LLM call goes here.

    The deterministic template is good enough for v1, but the natural
    upgrade is an LLM with the rubric in prompts/write_emails.md.

    Reference signature (Anthropic SDK):

        from anthropic import Anthropic
        client = Anthropic()
        msg = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=400,
            system=open("prompts/write_emails.md").read(),
            messages=[{
                "role": "user",
                "content": json.dumps(asdict(record)),
            }],
        )
        # parse msg.content[0].text into (subject, body)

    Until that's wired, this delegates to the template path.
    """
    return _default_template(record, config, _CTA_DEFAULT)


def generate(record: EnrichedProspect, config: Config) -> EmailDraft:
    subject, body = _llm_compose_TODO(record, config)
    body = _trim_to_word_budget(body, config.max_words)
    first_name = record.kb.founder_first_name if record.kb else ""
    return EmailDraft(
        company_domain=record.company_domain,
        first_name_guess=first_name,
        subject=subject,
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
