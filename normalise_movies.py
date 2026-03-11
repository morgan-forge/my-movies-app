#!/usr/bin/env python3
"""
One-time normalise movies.json: backup, coerce types, drop null optionals, enforce field order.
Run once to fix drift (e.g. imdbRating as string). Re-run validate_movies.py after.

  python3 normalise_movies.py
"""

import json
import shutil
from pathlib import Path

here = Path(__file__).parent
movies_path = here / "movies.json"
backup_path = here / "movies.json.bak"

# Canonical order: required first, then optional (matches movies.schema.json)
FIELD_ORDER = [
    "title", "year", "provider", "imdbId",
    "status", "posterUrl", "plot", "imdbRating", "runtime", "genres",
    "yourRating", "dateRated",
]


def coerce_value(key, value):
    if value is None:
        return None
    if key == "year":
        return int(value) if not isinstance(value, int) or isinstance(value, bool) else value
    if key == "imdbRating":
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                return None
        return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None
    if key == "runtime":
        if isinstance(value, str):
            try:
                return int(value)
            except ValueError:
                return None
        return int(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None
    if key == "yourRating":
        if isinstance(value, str):
            try:
                return int(value)
            except ValueError:
                return None
        return int(value) if isinstance(value, int) and not isinstance(value, bool) else None
    return value


def normalise_entry(entry):
    out = {}
    for key in FIELD_ORDER:
        if key not in entry:
            continue
        value = entry[key]
        value = coerce_value(key, value)
        if value is None and key not in ("title", "year", "provider", "imdbId"):
            continue  # omit null optionals
        if key in ("title", "year", "provider", "imdbId") and value is None:
            out[key] = None  # keep required keys even if null so validator can report
        else:
            out[key] = value
    return out


def main():
    if not movies_path.exists():
        print(f"movies.json not found: {movies_path}")
        return 1

    data = json.loads(movies_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        print("movies.json root must be an array")
        return 1

    shutil.copy2(movies_path, backup_path)
    print(f"Backed up to {backup_path}")

    normalised = [normalise_entry(e) for e in data]
    movies_path.write_text(
        json.dumps(normalised, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(normalised)} entries to {movies_path}. Run: python3 validate_movies.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
