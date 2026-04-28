"""Config loader. Parses a flat YAML subset (no PyYAML dependency).

The config schema is small and flat; a full YAML parser is unnecessary
and would add a runtime dep that the rest of the package avoids.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict


@dataclass
class Config:
    max_words: int
    target_subject_words_max: int
    min_critique_score: int
    rewrite_passes: int
    sender_first_name: str
    loom_url_placeholder: str
    use_llm: bool = False

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Config":
        required = [
            "max_words",
            "target_subject_words_max",
            "min_critique_score",
            "rewrite_passes",
            "sender_first_name",
            "loom_url_placeholder",
        ]
        missing = [k for k in required if k not in d]
        if missing:
            raise ValueError(f"config missing keys: {missing}")
        return cls(
            max_words=int(d["max_words"]),
            target_subject_words_max=int(d["target_subject_words_max"]),
            min_critique_score=int(d["min_critique_score"]),
            rewrite_passes=int(d["rewrite_passes"]),
            sender_first_name=str(d["sender_first_name"]),
            loom_url_placeholder=str(d["loom_url_placeholder"]),
            use_llm=bool(d.get("use_llm", False)),
        )


def _coerce(value: str) -> Any:
    v = value.strip()
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        return v[1:-1]
    if v.lower() in ("true", "false"):
        return v.lower() == "true"
    try:
        return int(v)
    except ValueError:
        pass
    try:
        return float(v)
    except ValueError:
        pass
    return v


def _parse_simple_yaml(text: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip() or ":" not in line:
            continue
        key, _, value = line.partition(":")
        out[key.strip()] = _coerce(value)
    return out


def load_config(path: str | Path) -> Config:
    path = Path(path)
    text = path.read_text(encoding="utf-8")
    return Config.from_dict(_parse_simple_yaml(text))
