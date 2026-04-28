"""scout.py — enrich fresh prospect domains.

Designed to run on YOUR LAPTOP, not inside the agent sandbox (the
sandbox blocks outbound HTTP). Standard library only; no pip install.

Usage:
    python scout.py --input fresh_prospects.csv

Reads a one-column CSV with header `company_domain`. For each domain:
- fetches https://{domain}, /blog, /changelog with a real User-Agent
- on 403 / Cloudflare / network failure, transparently retries via
  web.archive.org's most recent snapshot
- extracts: <title>, meta description, first <h1>, first 2 substantial
  paragraphs (>= 80 chars), latest blog post title, og:image url,
  latest changelog entry title

Writes ai_sdr/knowledge_base_extra.py — a Python module exposing an
EXTRA dict of {domain: KnowledgeEntry} that is auto-merged into the
main knowledge base on the next pipeline run.

Defensive: every fetch and every domain is wrapped in try/except.
A single bad domain never crashes the run.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Optional


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
ACCEPT = (
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,"
    "image/webp,*/*;q=0.8"
)
TIMEOUT = 12
WAYBACK_AVAILABILITY = "https://archive.org/wayback/available?url={u}"

_TAG_RE = re.compile(r"<[^>]+>")
_SCRIPT_STYLE_RE = re.compile(
    r"<(script|style|noscript|svg)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL
)
_WS_RE = re.compile(r"\s+")


# ---------------------------------------------------------------------------
# Fetching
# ---------------------------------------------------------------------------


def _request(url: str) -> tuple[int, Optional[str]]:
    """Returns (status, body_or_None). Never raises."""
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": ACCEPT,
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read()
            charset = resp.headers.get_content_charset() or "utf-8"
            try:
                return resp.status, raw.decode(charset, errors="replace")
            except LookupError:
                return resp.status, raw.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return 0, None
    except Exception:
        return 0, None


def _wayback_snapshot(url: str) -> Optional[str]:
    """Pull the closest archive.org snapshot URL for `url`. Best-effort."""
    try:
        avail = WAYBACK_AVAILABILITY.format(u=urllib.parse.quote(url, safe=""))
        status, body = _request(avail)
        if not body or status != 200:
            return None
        meta = json.loads(body)
        snap = (meta.get("archived_snapshots") or {}).get("closest") or {}
        if snap.get("available") and snap.get("url"):
            snap_url = snap["url"]
            if snap_url.startswith("http://"):
                snap_url = "https://" + snap_url[len("http://") :]
            return snap_url
    except Exception:
        return None
    return None


def fetch(url: str) -> Optional[str]:
    """Fetch a URL. On 403/Cloudflare-style blocks or network failure,
    transparently retry via web.archive.org. Never raises."""
    status, body = _request(url)
    if body and 200 <= status < 300:
        return body
    if status in (0, 403, 429, 503) or status >= 500:
        snap_url = _wayback_snapshot(url)
        if snap_url:
            _, snap_body = _request(snap_url)
            if snap_body:
                return snap_body
    return None


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------


def _clean(s: str) -> str:
    if not s:
        return ""
    return _WS_RE.sub(" ", html.unescape(s)).strip()


def _strip_tags(s: str) -> str:
    if not s:
        return ""
    s = _SCRIPT_STYLE_RE.sub(" ", s)
    return _clean(_TAG_RE.sub(" ", s))


def extract_title(body: str) -> str:
    try:
        m = re.search(r"<title[^>]*>(.*?)</title>", body, re.IGNORECASE | re.DOTALL)
        return _clean(m.group(1)) if m else ""
    except Exception:
        return ""


def extract_meta_description(body: str) -> str:
    try:
        for pat in (
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']',
            r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
        ):
            m = re.search(pat, body, re.IGNORECASE)
            if m:
                return _clean(m.group(1))
    except Exception:
        pass
    return ""


def extract_h1(body: str) -> str:
    try:
        m = re.search(r"<h1[^>]*>(.*?)</h1>", body, re.IGNORECASE | re.DOTALL)
        return _strip_tags(m.group(1)) if m else ""
    except Exception:
        return ""


def extract_paragraphs(body: str, min_len: int = 80, n: int = 2) -> list[str]:
    out: list[str] = []
    try:
        cleaned = _SCRIPT_STYLE_RE.sub(" ", body)
        for m in re.finditer(r"<p[^>]*>(.*?)</p>", cleaned, re.IGNORECASE | re.DOTALL):
            text = _strip_tags(m.group(1))
            if len(text) >= min_len:
                out.append(text)
            if len(out) >= n:
                break
    except Exception:
        pass
    return out[:n]


def extract_og_image(body: str) -> str:
    try:
        for pat in (
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
        ):
            m = re.search(pat, body, re.IGNORECASE)
            if m:
                return _clean(m.group(1))
    except Exception:
        pass
    return ""


def extract_first_post_title(body: str) -> str:
    try:
        for tag in ("h1", "h2", "h3"):
            for m in re.finditer(
                rf"<{tag}[^>]*>(.*?)</{tag}>", body, re.IGNORECASE | re.DOTALL
            ):
                text = _strip_tags(m.group(1))
                if 8 <= len(text) <= 200 and text.lower() not in ("blog", "posts", "changelog"):
                    return text
    except Exception:
        return ""
    return ""


# ---------------------------------------------------------------------------
# Per-domain orchestration
# ---------------------------------------------------------------------------


def scout_domain(domain: str) -> dict[str, Any]:
    facts: dict[str, Any] = {
        "domain": domain,
        "title": "",
        "meta_description": "",
        "h1": "",
        "paragraphs": [],
        "og_image": "",
        "latest_blog_post_title": "",
        "latest_changelog_title": "",
        "errors": [],
    }
    try:
        home = fetch(f"https://{domain}")
        if not home:
            facts["errors"].append("home_unreachable")
        else:
            facts["title"] = extract_title(home)
            facts["meta_description"] = extract_meta_description(home)
            facts["h1"] = extract_h1(home)
            facts["paragraphs"] = extract_paragraphs(home, min_len=80, n=2)
            facts["og_image"] = extract_og_image(home)

        for path, key in (
            ("/blog", "latest_blog_post_title"),
            ("/changelog", "latest_changelog_title"),
        ):
            try:
                page = fetch(f"https://{domain}{path}")
                if page:
                    title = extract_first_post_title(page)
                    if title:
                        facts[key] = title
            except Exception:
                continue
    except Exception as e:
        facts["errors"].append(f"top:{type(e).__name__}")
    return facts


# ---------------------------------------------------------------------------
# Output: write knowledge_base_extra.py
# ---------------------------------------------------------------------------


def _entry_repr(facts: dict[str, Any]) -> str:
    """Render one KnowledgeEntry constructor call as a string.

    The scrape doesn't tell us a founder name or curated wedge, so those
    fields are intentionally left blank for the human (or LLM) to fill in.
    Everything else is best-effort proxied from the scraped facts.
    """
    domain = facts["domain"]
    title = facts.get("title", "")
    meta = facts.get("meta_description", "")
    h1 = facts.get("h1", "")
    paragraphs = facts.get("paragraphs") or []
    blog = facts.get("latest_blog_post_title", "")
    changelog = facts.get("latest_changelog_title", "")

    one_liner = meta or title or "(scraped)"
    signature = h1 or title or "(scraped)"
    wedge = (paragraphs[0] if paragraphs else (meta or title or "(scraped)"))
    hook = blog or changelog or signature or one_liner
    workflow = (
        "Curious whether your inbound still gets manually triaged before the right "
        "person picks it up"
    )
    subject_hint = re.sub(r"[^a-z0-9]+", " ", (h1 or title or domain).lower()).split()
    subject_hint = subject_hint[0] if subject_hint else domain.split(".")[0]

    return (
        f"    {domain!r}: KnowledgeEntry(\n"
        f"        domain={domain!r},\n"
        f'        founder_first_name="",\n'
        f'        founder_email_guess="",\n'
        f"        product_one_liner={one_liner!r},\n"
        f"        signature_feature={signature!r},\n"
        f"        positioning_wedge={wedge!r},\n"
        f"        ideal_personalization_hook={hook!r},\n"
        f"        ai_sdr_workflow_hypothesis={workflow!r},\n"
        f"        subject_hint={subject_hint!r},\n"
        f"    ),"
    )


def write_extra_module(facts_list: list[dict[str, Any]], out_path: Path) -> None:
    entries = "\n".join(_entry_repr(f) for f in facts_list)
    body = (
        '"""Auto-generated by scout.py. Do not edit by hand.\n\n'
        "Merged into ai_sdr.knowledge_base.KNOWLEDGE on package import via\n"
        "`from .knowledge_base_extra import EXTRA; KNOWLEDGE.update(EXTRA)`.\n"
        '"""\n\n'
        "from .models import KnowledgeEntry\n\n\n"
        "EXTRA: dict[str, KnowledgeEntry] = {\n"
        f"{entries}\n"
        "}\n"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(body, encoding="utf-8")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Scout fresh prospect domains and update the knowledge base."
    )
    parser.add_argument(
        "--input",
        default="fresh_prospects.csv",
        help="CSV with a `company_domain` column.",
    )
    parser.add_argument(
        "--output",
        default="ai_sdr/knowledge_base_extra.py",
        help="Destination Python module (default: ai_sdr/knowledge_base_extra.py).",
    )
    args = parser.parse_args(argv)

    input_path = Path(args.input)
    out_path = Path(args.output)

    if not input_path.exists():
        print(f"[scout] input not found: {input_path}", file=sys.stderr)
        return 2

    facts_list: list[dict[str, Any]] = []
    try:
        with input_path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                domain = (row.get("company_domain") or "").strip().lower()
                if not domain:
                    continue
                try:
                    facts = scout_domain(domain)
                    facts_list.append(facts)
                    status = "ok" if not facts["errors"] else f"partial ({','.join(facts['errors'])})"
                    print(f"[scout] {domain:<24} {status}")
                except Exception as e:
                    print(f"[scout] {domain:<24} failed: {type(e).__name__}: {e}")
    except Exception as e:
        print(f"[scout] failed reading {input_path}: {e}", file=sys.stderr)
        return 1

    if not facts_list:
        print("[scout] no domains processed; not writing extras")
        return 0

    try:
        write_extra_module(facts_list, out_path)
    except Exception as e:
        print(f"[scout] failed writing {out_path}: {e}", file=sys.stderr)
        return 1

    print(f"[scout] wrote {len(facts_list)} entries to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
