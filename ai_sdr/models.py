"""Typed dataclasses passed between pipeline stages.

Each stage takes the previous stage's dataclass and returns the next.
This is the contract; everything else is implementation detail.
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Prospect:
    company_domain: str


@dataclass
class ScrapedHomepage:
    title: str = ""
    meta_description: str = ""
    h1: str = ""
    paragraphs: List[str] = field(default_factory=list)
    latest_blog_post_title: str = ""


@dataclass
class KnowledgeEntry:
    domain: str
    founder_first_name: str
    founder_email_guess: str
    product_one_liner: str
    signature_feature: str
    positioning_wedge: str
    ideal_personalization_hook: str
    ai_sdr_workflow_hypothesis: str
    subject_hint: str


@dataclass
class EnrichedProspect:
    company_domain: str
    source: str  # "scrape" | "kb" | "mixed"
    scraped: ScrapedHomepage = field(default_factory=ScrapedHomepage)
    kb: Optional[KnowledgeEntry] = None
    errors: List[str] = field(default_factory=list)


@dataclass
class EmailDraft:
    company_domain: str
    first_name_guess: str
    subject: str
    body: str


@dataclass
class CritiqueResult:
    specificity: int  # 1-10
    humanness: int    # 1-10
    curiosity: int    # 1-10
    reasoning: str
    passes: bool
