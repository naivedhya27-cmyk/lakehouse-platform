"""Email critique. Heuristic in v1; LLM-backed in a future version.

Three axes, each scored 1–10:
  - specificity: does the email reference a concrete, company-specific thing?
  - humanness: does it sound like a person, not a sales template?
  - curiosity: does the close invite a reply rather than demand a meeting?

If any axis < config.min_critique_score, the orchestrator triggers a single
rewrite via generate.rewrite().
"""

import re
from typing import List

from .config import Config
from .models import CritiqueResult, EmailDraft, EnrichedProspect


_BANNED_PHRASES = [
    "i hope this finds you well",
    "i hope this email finds you well",
    "circle back",
    "touch base",
    "synergy",
    "leverage",
    "quick chat",
    "book a 15-min call",
    "book a 15 min call",
    "15-minute call",
    "15 min call",
    "as per my last email",
    "low-hanging fruit",
    "moving forward",
    "going forward",
    "at your earliest convenience",
]

_BANNED_CTAS = [
    "book a call",
    "book a meeting",
    "schedule a call",
    "schedule a meeting",
    "get on a call",
    "hop on a call",
    "jump on a call",
    "set up a call",
]

_STOPWORDS = set(
    """a an and the to of in for on with from as is it was at by be this that these those your you our we i my me""".split()
)


def _sentences(text: str) -> List[str]:
    # naive split that keeps "?" and "!" as terminators
    parts = re.split(r"(?<=[\.\?\!])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _company_specific_token_present(body: str, record: EnrichedProspect) -> bool:
    """Check whether the body contains at least one token tied to this company:
    domain stem, founder name, or any meaningful word from the signature feature."""
    body_l = body.lower()
    stem = record.company_domain.split(".")[0].lower()
    if stem in body_l:
        return True
    if record.kb:
        if record.kb.founder_first_name.lower() in body_l:
            return True
        for word in re.findall(r"[A-Za-z][A-Za-z\-]{3,}", record.kb.signature_feature):
            if word.lower() not in _STOPWORDS and word.lower() in body_l:
                return True
    return False


def _score_specificity(draft: EmailDraft, record: EnrichedProspect) -> tuple[int, str]:
    sentences = _sentences(draft.body)
    s1 = sentences[0] if sentences else ""
    score = 5
    notes = []
    if _company_specific_token_present(s1, record):
        score += 3
        notes.append("S1 names a company-specific token")
    elif _company_specific_token_present(draft.body, record):
        score += 1
        notes.append("body mentions a company-specific token, but not in S1")
    else:
        notes.append("no company-specific token detected")

    if record.kb and any(
        w.lower() in s1.lower()
        for w in re.findall(r"[A-Za-z][A-Za-z\-]{3,}", record.kb.signature_feature)
        if w.lower() not in _STOPWORDS
    ):
        score += 2
        notes.append("S1 references the signature feature")

    return min(score, 10), "; ".join(notes)


def _score_humanness(draft: EmailDraft) -> tuple[int, str]:
    body_l = draft.body.lower()
    score = 9
    notes = []
    for phrase in _BANNED_PHRASES:
        if phrase in body_l:
            score -= 4
            notes.append(f"banned phrase: '{phrase}'")
    sentences = _sentences(draft.body)
    if len(sentences) != 4:
        score -= 2
        notes.append(f"expected 4 sentences, got {len(sentences)}")
    lengths = [len(s.split()) for s in sentences]
    if lengths and (max(lengths) - min(lengths)) >= 4:
        score += 1
        notes.append("good sentence-length variance")
    if not notes:
        notes.append("no banned phrases, sentence count correct")
    return max(min(score, 10), 1), "; ".join(notes)


def _score_curiosity(draft: EmailDraft) -> tuple[int, str]:
    body_l = draft.body.lower()
    sentences = _sentences(draft.body)
    last = sentences[-1] if sentences else ""
    score = 5
    notes = []
    if last.endswith("?"):
        score += 3
        notes.append("closes with a question")
    else:
        notes.append("close is not a question")
    for cta in _BANNED_CTAS:
        if cta in body_l:
            score -= 5
            notes.append(f"banned CTA: '{cta}'")
            break
    if 4 <= len(last.split()) <= 12:
        score += 2
        notes.append("CTA length is conversational")
    return max(min(score, 10), 1), "; ".join(notes)


def critique(draft: EmailDraft, record: EnrichedProspect, config: Config) -> CritiqueResult:
    """TODO: an LLM judge would replace these heuristics by re-reading the
    rubric and the draft together. Reference signature:

        client.messages.create(
            model="claude-opus-4-7",
            system=open("prompts/write_emails.md").read(),
            messages=[{"role": "user", "content": "Rate this draft 1-10 on ..."}],
        )
    """
    spec, sn = _score_specificity(draft, record)
    hum, hn = _score_humanness(draft)
    cur, cn = _score_curiosity(draft)
    passes = (
        spec >= config.min_critique_score
        and hum >= config.min_critique_score
        and cur >= config.min_critique_score
    )
    reasoning = f"specificity[{sn}] | humanness[{hn}] | curiosity[{cn}]"
    return CritiqueResult(
        specificity=spec,
        humanness=hum,
        curiosity=cur,
        reasoning=reasoning,
        passes=passes,
    )
