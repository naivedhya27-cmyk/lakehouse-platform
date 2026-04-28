"""Enrich prospects from prospects.csv by scraping their public homepage.

Standard library only. Defensive: every network call is wrapped, a single
bad row never crashes the run.
"""

import csv
import html
import json
import re
import urllib.request
import urllib.error
from typing import Optional

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
TIMEOUT = 12

TAG_RE = re.compile(r"<[^>]+>")
SCRIPT_STYLE_RE = re.compile(
    r"<(script|style|noscript|svg)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL
)
WHITESPACE_RE = re.compile(r"\s+")


def fetch(url: str) -> Optional[str]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read()
            charset = resp.headers.get_content_charset() or "utf-8"
            try:
                return raw.decode(charset, errors="replace")
            except LookupError:
                return raw.decode("utf-8", errors="replace")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, OSError):
        return None
    except Exception:
        return None


def clean_text(s: str) -> str:
    if not s:
        return ""
    s = html.unescape(s)
    s = WHITESPACE_RE.sub(" ", s).strip()
    return s


def strip_tags(s: str) -> str:
    if not s:
        return ""
    s = SCRIPT_STYLE_RE.sub(" ", s)
    s = TAG_RE.sub(" ", s)
    return clean_text(s)


def extract_title(body: str) -> str:
    try:
        m = re.search(r"<title[^>]*>(.*?)</title>", body, re.IGNORECASE | re.DOTALL)
        return clean_text(m.group(1)) if m else ""
    except Exception:
        return ""


def extract_meta_description(body: str) -> str:
    try:
        patterns = [
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']',
            r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:description["\']',
        ]
        for pat in patterns:
            m = re.search(pat, body, re.IGNORECASE)
            if m:
                return clean_text(m.group(1))
        return ""
    except Exception:
        return ""


def extract_first_h1(body: str) -> str:
    try:
        m = re.search(r"<h1[^>]*>(.*?)</h1>", body, re.IGNORECASE | re.DOTALL)
        return strip_tags(m.group(1)) if m else ""
    except Exception:
        return ""


def extract_first_paragraphs(body: str, n: int = 2) -> list:
    out = []
    try:
        # Strip script/style first to avoid garbage
        cleaned = SCRIPT_STYLE_RE.sub(" ", body)
        # Try real <p> tags
        for m in re.finditer(r"<p[^>]*>(.*?)</p>", cleaned, re.IGNORECASE | re.DOTALL):
            text = strip_tags(m.group(1))
            if len(text) >= 40:
                out.append(text)
            if len(out) >= n:
                return out
        # Fallback: divs/sections with substantial text
        if len(out) < n:
            for m in re.finditer(
                r"<(div|section|article)[^>]*>(.*?)</\1>",
                cleaned,
                re.IGNORECASE | re.DOTALL,
            ):
                text = strip_tags(m.group(2))
                if 60 <= len(text) <= 600 and text not in out:
                    out.append(text)
                if len(out) >= n:
                    break
    except Exception:
        pass
    return out[:n]


def extract_latest_blog_title(body: str) -> str:
    """Best-effort: first <h1>, <h2>, or <a> inside the blog index that looks like a post title."""
    try:
        # Try article > h1/h2 first
        for tag in ("h1", "h2", "h3"):
            for m in re.finditer(
                rf"<{tag}[^>]*>(.*?)</{tag}>", body, re.IGNORECASE | re.DOTALL
            ):
                text = strip_tags(m.group(1))
                if 8 <= len(text) <= 200 and text.lower() not in ("blog", "posts"):
                    return text
        # Fallback: first plausible <a> link text
        for m in re.finditer(r"<a[^>]*>(.*?)</a>", body, re.IGNORECASE | re.DOTALL):
            text = strip_tags(m.group(1))
            if 12 <= len(text) <= 160:
                return text
    except Exception:
        return ""
    return ""


def enrich_domain(domain: str) -> dict:
    domain = domain.strip().lower()
    record = {
        "company_domain": domain,
        "url": f"https://{domain}",
        "title": "",
        "meta_description": "",
        "h1": "",
        "paragraphs": [],
        "latest_blog_post_title": "",
        "errors": [],
    }
    try:
        homepage = fetch(f"https://{domain}")
        if homepage is None:
            record["errors"].append("homepage_fetch_failed")
        else:
            try:
                record["title"] = extract_title(homepage)
            except Exception as e:
                record["errors"].append(f"title:{type(e).__name__}")
            try:
                record["meta_description"] = extract_meta_description(homepage)
            except Exception as e:
                record["errors"].append(f"meta:{type(e).__name__}")
            try:
                record["h1"] = extract_first_h1(homepage)
            except Exception as e:
                record["errors"].append(f"h1:{type(e).__name__}")
            try:
                record["paragraphs"] = extract_first_paragraphs(homepage, 2)
            except Exception as e:
                record["errors"].append(f"paragraphs:{type(e).__name__}")

        # Best-effort blog scrape
        for path in ("/blog", "/blog/"):
            try:
                blog = fetch(f"https://{domain}{path}")
                if blog:
                    title = extract_latest_blog_title(blog)
                    if title:
                        record["latest_blog_post_title"] = title
                        break
            except Exception:
                continue
    except Exception as e:
        record["errors"].append(f"top:{type(e).__name__}")
    return record


def main() -> None:
    results = []
    try:
        with open("prospects.csv", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                domain = (row.get("company_domain") or "").strip()
                if not domain:
                    continue
                try:
                    results.append(enrich_domain(domain))
                except Exception as e:
                    results.append(
                        {
                            "company_domain": domain,
                            "errors": [f"row_failed:{type(e).__name__}:{e}"],
                        }
                    )
    except FileNotFoundError:
        print("prospects.csv not found")
        return
    except Exception as e:
        print(f"failed reading prospects.csv: {e}")
        return

    try:
        with open("enriched.json", "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"wrote enriched.json with {len(results)} record(s)")
    except Exception as e:
        print(f"failed writing enriched.json: {e}")


if __name__ == "__main__":
    main()
