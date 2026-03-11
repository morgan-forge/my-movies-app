#!/usr/bin/env python3
"""
Validate movies.json against movies.schema.json.
Exits 0 if valid, 1 and prints errors otherwise.
Run before or after build to catch schema drift.

  python3 validate_movies.py
"""

import json
import sys
from pathlib import Path

here = Path(__file__).parent
schema_path = here / "movies.schema.json"
movies_path = here / "movies.json"


def validate_entry(entry, index, schema, errors):
    required = schema.get("required", [])
    props = schema.get("properties", {})
    extra_ok = schema.get("additionalProperties", True)

    for key in required:
        if key not in entry:
            errors.append(f"Entry {index} (title={entry.get('title', '?')!r}): missing required field {key!r}")
        elif entry[key] is None:
            errors.append(f"Entry {index} (title={entry.get('title', '?')!r}): required field {key!r} is null")

    for key, value in entry.items():
        if key not in props:
            if not extra_ok:
                errors.append(f"Entry {index} (title={entry.get('title', '?')!r}): unknown field {key!r}")
            continue
        prop = props[key]
        if value is None:
            continue
        type_ = prop.get("type")
        if type_ == "string" and not isinstance(value, str):
            errors.append(f"Entry {index} ({entry.get('title', '?')!r}): {key!r} should be string, got {type(value).__name__}")
        elif type_ == "integer":
            if isinstance(value, bool) or not isinstance(value, int):
                errors.append(f"Entry {index} ({entry.get('title', '?')!r}): {key!r} should be integer, got {type(value).__name__} ({value!r})")
        elif type_ == "number" and not isinstance(value, (int, float)):
            errors.append(f"Entry {index} ({entry.get('title', '?')!r}): {key!r} should be number, got {type(value).__name__} ({value!r})")
        elif type_ == "array" and not isinstance(value, list):
            errors.append(f"Entry {index} ({entry.get('title', '?')!r}): {key!r} should be array, got {type(value).__name__}")
        if "enum" in prop and value not in prop["enum"]:
            errors.append(f"Entry {index} ({entry.get('title', '?')!r}): {key!r} must be one of {prop['enum']}, got {value!r}")
        if prop.get("minimum") is not None and value < prop["minimum"]:
            errors.append(f"Entry {index} ({entry.get('title', '?')!r}): {key!r} must be >= {prop['minimum']}, got {value}")
        if prop.get("maximum") is not None and value > prop["maximum"]:
            errors.append(f"Entry {index} ({entry.get('title', '?')!r}): {key!r} must be <= {prop['maximum']}, got {value}")


def main():
    if not schema_path.exists():
        print(f"Schema not found: {schema_path}", file=sys.stderr)
        sys.exit(1)
    if not movies_path.exists():
        print(f"movies.json not found: {movies_path}", file=sys.stderr)
        sys.exit(1)

    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    movies = json.loads(movies_path.read_text(encoding="utf-8"))

    if not isinstance(movies, list):
        print("movies.json root must be an array", file=sys.stderr)
        sys.exit(1)

    errors = []
    for i, entry in enumerate(movies):
        if not isinstance(entry, dict):
            errors.append(f"Entry {i}: must be an object, got {type(entry).__name__}")
            continue
        validate_entry(entry, i, schema, errors)

    if errors:
        for e in errors:
            print(e, file=sys.stderr)
        print(f"\n{len(errors)} error(s). Fix movies.json or relax movies.schema.json.", file=sys.stderr)
        sys.exit(1)
    print(f"Valid: {len(movies)} films conform to movies.schema.json")


if __name__ == "__main__":
    main()
