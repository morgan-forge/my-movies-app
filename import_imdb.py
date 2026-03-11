#!/usr/bin/env python3
"""
Import IMDb ratings CSV into movies.json.
Primary match: IMDb ID (Const in CSV = imdbId in collection), normalised (strip + lower).
Fallback: normalised title + year, for films where the collection has a different/wrong imdbId.
Writes yourRating (1-10) and dateRated (YYYY-MM-DD). Only processes Title Type = Movie.

Usage (from morgans-movies folder):
  python3 import_imdb.py [path/to/ratings.csv]
  If no path given, uses the first .csv in the folder.
"""

import csv
import json
import re
import sys
from pathlib import Path

here = Path(__file__).parent


def norm_title(s):
    if not s:
        return ""
    s = s.lower().strip()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def main():
    if len(sys.argv) >= 2:
        csv_path = Path(sys.argv[1])
    else:
        csvs = list(here.glob("*.csv"))
        if not csvs:
            print("No CSV file found. Pass path: python3 import_imdb.py path/to/ratings.csv")
            sys.exit(1)
        csv_path = csvs[0]

    if not csv_path.exists():
        print(f"File not found: {csv_path}")
        sys.exit(1)

    # Build lookup by IMDb ID (normalised: strip + lower) and by (title_norm, year) for fallback
    ratings_by_id = {}
    ratings_by_title_year = {}
    with open(csv_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("Title Type") != "Movie":
                continue
            c = (row.get("Const") or "").strip()
            if not c:
                continue
            try:
                r = int(row.get("Your Rating", 0))
            except (ValueError, TypeError):
                r = None
            date_rated = (row.get("Date Rated") or "").strip()
            if r is not None and 1 <= r <= 10:
                key_id = c.lower()
                ratings_by_id[key_id] = {
                    "yourRating": r,
                    "dateRated": date_rated or None,
                    "const": c,
                }
                t = norm_title(row.get("Title", ""))
                y = str(row.get("Year", "")).strip()
                if t and y:
                    ratings_by_title_year[(t, y)] = ratings_by_id[key_id]

    movies_path = here / "movies.json"
    movies = json.loads(movies_path.read_text(encoding="utf-8"))

    updated_by_id = 0
    updated_by_title = 0
    for m in movies:
        iid_raw = (m.get("imdbId") or "").strip()
        iid = iid_raw.lower() if iid_raw else ""

        # 1) Primary: match by IMDb ID
        if iid and iid in ratings_by_id:
            data = ratings_by_id[iid]
            m["yourRating"] = data["yourRating"]
            if data["dateRated"]:
                m["dateRated"] = data["dateRated"]
            updated_by_id += 1
            continue

        # 2) Fallback: match by normalised title + year (catches wrong/different imdbId in collection)
        title = norm_title(m.get("title", ""))
        year = str(m.get("year") or "").strip()
        if title and year and (title, year) in ratings_by_title_year:
            data = ratings_by_title_year[(title, year)]
            m["yourRating"] = data["yourRating"]
            if data["dateRated"]:
                m["dateRated"] = data["dateRated"]
            m["imdbId"] = data["const"]  # align to CSV so future imports match by ID
            updated_by_title += 1

    movies_path.write_text(json.dumps(movies, ensure_ascii=False, indent=2), encoding="utf-8")
    total = updated_by_id + updated_by_title
    print(f"Updated {total} films from {csv_path.name}")
    print(f"  By IMDb ID: {updated_by_id}")
    if updated_by_title:
        print(f"  By title+year (and imdbId corrected): {updated_by_title}")


if __name__ == "__main__":
    main()
