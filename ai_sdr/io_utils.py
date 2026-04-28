"""Defensive CSV/JSON I/O. Never raise on a single bad row."""

import csv
import json
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Iterable, List

from .models import EmailDraft, CritiqueResult, Prospect


def read_prospects(path: str | Path) -> List[Prospect]:
    path = Path(path)
    out: List[Prospect] = []
    try:
        with path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                domain = (row.get("company_domain") or "").strip().lower()
                if domain:
                    out.append(Prospect(company_domain=domain))
    except FileNotFoundError:
        return []
    except Exception:
        return out
    return out


def _to_jsonable(obj: Any) -> Any:
    if is_dataclass(obj):
        return {k: _to_jsonable(v) for k, v in asdict(obj).items()}
    if isinstance(obj, list):
        return [_to_jsonable(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    return obj


def write_json(records: Iterable[Any], path: str | Path) -> None:
    path = Path(path)
    payload = [_to_jsonable(r) for r in records]
    try:
        path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    except Exception as e:
        print(f"[io_utils] failed writing {path}: {e}")


DRAFT_CSV_FIELDS = [
    "company_domain",
    "first_name_guess",
    "subject",
    "body",
    "specificity_score",
    "humanness_score",
    "curiosity_score",
    "critique_notes",
]


def write_drafts_csv(
    pairs: Iterable[tuple[EmailDraft, CritiqueResult]],
    path: str | Path,
) -> None:
    path = Path(path)
    try:
        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=DRAFT_CSV_FIELDS, quoting=csv.QUOTE_ALL)
            writer.writeheader()
            for draft, critique in pairs:
                writer.writerow(
                    {
                        "company_domain": draft.company_domain,
                        "first_name_guess": draft.first_name_guess,
                        "subject": draft.subject,
                        "body": draft.body,
                        "specificity_score": critique.specificity,
                        "humanness_score": critique.humanness,
                        "curiosity_score": critique.curiosity,
                        "critique_notes": critique.reasoning,
                    }
                )
    except Exception as e:
        print(f"[io_utils] failed writing {path}: {e}")
