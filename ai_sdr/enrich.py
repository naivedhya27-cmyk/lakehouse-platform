"""Enrichment layer.

Tries to scrape the live homepage first. On failure (block, timeout,
network error), falls back to the structured knowledge base. Both sources
are merged into a single EnrichedProspect — we never pretend a scrape
worked when it didn't, but we never block the pipeline on it either.
"""

import html
import re
import urllib.error
import urllib.request
from typing import Optional

from .knowledge_base import lookup
from .models import EnrichedProspect, Prospect, ScrapedHomepage


_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
_TIMEOUT = 8

_TAG_RE = re.compile(r"<[^>]+>")
_SCRIPT_STYLE_RE = re.compile(
    r"<(script|style|noscript|svg)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL
)
_WHITESPACE_RE = re.compile(r"\s+")


def _fetch(url: str) -> Optional[str]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            raw = resp.read()
            charset = resp.headers.get_content_charset() or "utf-8"
            return raw.decode(charset, errors="replace")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, ValueError):
        return None
    except Exception:
        return None


def _clean(s: str) -> str:
    if not s:
        return ""
    return _WHITESPACE_RE.sub(" ", html.unescape(s)).strip()


def _strip_tags(s: str) -> str:
    if not s:
        return ""
    s = _SCRIPT_STYLE_RE.sub(" ", s)
    return _clean(_TAG_RE.sub(" ", s))


def _extract(body: str) -> ScrapedHomepage:
    out = ScrapedHomepage()
    try:
        m = re.search(r"<title[^>]*>(.*?)</title>", body, re.IGNORECASE | re.DOTALL)
        if m:
            out.title = _clean(m.group(1))
    except Exception:
        pass
    try:
        for pat in (
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']',
        ):
            m = re.search(pat, body, re.IGNORECASE)
            if m:
                out.meta_description = _clean(m.group(1))
                break
    except Exception:
        pass
    try:
        m = re.search(r"<h1[^>]*>(.*?)</h1>", body, re.IGNORECASE | re.DOTALL)
        if m:
            out.h1 = _strip_tags(m.group(1))
    except Exception:
        pass
    try:
        cleaned = _SCRIPT_STYLE_RE.sub(" ", body)
        for m in re.finditer(r"<p[^>]*>(.*?)</p>", cleaned, re.IGNORECASE | re.DOTALL):
            text = _strip_tags(m.group(1))
            if len(text) >= 40:
                out.paragraphs.append(text)
            if len(out.paragraphs) >= 2:
                break
    except Exception:
        pass
    return out


def _extract_blog_title(body: str) -> str:
    try:
        for tag in ("h1", "h2", "h3"):
            for m in re.finditer(rf"<{tag}[^>]*>(.*?)</{tag}>", body, re.IGNORECASE | re.DOTALL):
                text = _strip_tags(m.group(1))
                if 8 <= len(text) <= 200 and text.lower() not in ("blog", "posts"):
                    return text
    except Exception:
        return ""
    return ""


def enrich(prospect: Prospect) -> EnrichedProspect:
    """Try live scrape first, fall back to KB. Never raises."""
    domain = prospect.company_domain
    record = EnrichedProspect(company_domain=domain, source="kb")
    record.kb = lookup(domain)

    scraped_anything = False
    try:
        homepage = _fetch(f"https://{domain}")
        if homepage is None:
            record.errors.append("homepage_fetch_failed")
        else:
            record.scraped = _extract(homepage)
            scraped_anything = bool(
                record.scraped.title
                or record.scraped.meta_description
                or record.scraped.h1
                or record.scraped.paragraphs
            )
        for path in ("/blog", "/blog/"):
            try:
                blog = _fetch(f"https://{domain}{path}")
                if blog:
                    title = _extract_blog_title(blog)
                    if title:
                        record.scraped.latest_blog_post_title = title
                        scraped_anything = True
                        break
            except Exception:
                continue
    except Exception as e:
        record.errors.append(f"enrich:{type(e).__name__}")

    if scraped_anything and record.kb is not None:
        record.source = "mixed"
    elif scraped_anything:
        record.source = "scrape"
    elif record.kb is not None:
        record.source = "kb"
    else:
        record.source = "none"
        record.errors.append("no_data_available")

    return record
