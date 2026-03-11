#!/usr/bin/env python3
"""
fetch_posters.py – Morgans' Movies
Fetches missing metadata from TMDB for any film in movies.json
that is missing a posterUrl, plot, imdbRating, runtime, or genres.

Fills in ALL of: poster, plot, TMDB rating, runtime, genres.

Usage:
    python3 fetch_posters.py YOUR_TMDB_READ_ACCESS_TOKEN

Get a free token at: https://www.themoviedb.org/settings/api
(Use the long "API Read Access Token", starts with eyJ...)

After running, also run:
    python3 build.py
to bake everything into standalone.html.
"""

import json, sys, time, pathlib, urllib.request, urllib.parse, urllib.error

HERE     = pathlib.Path(__file__).parent
JSON     = HERE / "movies.json"
BASE     = "https://api.themoviedb.org/3"
IMG_BASE = "https://image.tmdb.org/t/p/w300"

METADATA_FIELDS = ("posterUrl", "plot", "imdbRating", "runtime", "genres")

def needs_data(m):
    """True if any enrichment field is missing."""
    return any(not m.get(f) for f in METADATA_FIELDS)

def tmdb_get(path, token, params=None):
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/json"
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("  Rate limited — waiting 10s...")
            time.sleep(10)
            return tmdb_get(path, token, params)
        return None
    except Exception:
        return None

def extract_metadata(result):
    """Pull all useful fields from a TMDB movie result dict."""
    meta = {}
    if result.get("poster_path"):
        meta["posterUrl"] = IMG_BASE + result["poster_path"]
    if result.get("overview"):
        meta["plot"] = result["overview"]
    if result.get("vote_average"):
        meta["imdbRating"] = round(result["vote_average"], 1)
    if result.get("genre_ids"):
        # genre_ids need a lookup — handled separately via /genre/movie/list
        meta["_genre_ids"] = result["genre_ids"]
    return meta

def fetch_full_details(tmdb_id, token):
    """Fetch full movie details including runtime and genres by TMDB id."""
    data = tmdb_get(f"/movie/{tmdb_id}", token, {"language": "en-US"})
    if not data:
        return {}
    meta = {}
    if data.get("poster_path"):
        meta["posterUrl"] = IMG_BASE + data["poster_path"]
    if data.get("overview"):
        meta["plot"] = data["overview"]
    if data.get("vote_average"):
        meta["imdbRating"] = round(data["vote_average"], 1)
    if data.get("runtime"):
        meta["runtime"] = data["runtime"]
    if data.get("genres"):
        meta["genres"] = [g["name"] for g in data["genres"]]
    return meta

def find_tmdb_id_by_imdb(imdb_id, token):
    data = tmdb_get(f"/find/{imdb_id}", token, {"external_source": "imdb_id"})
    if not data:
        return None
    results = data.get("movie_results", [])
    return results[0]["id"] if results else None

def find_tmdb_id_by_search(title, year, token):
    params = {"query": title, "language": "en-US"}
    if year:
        params["year"] = year
    data = tmdb_get("/search/movie", token, params)
    if data and data.get("results"):
        return data["results"][0]["id"]
    # Retry without year
    if year:
        data2 = tmdb_get("/search/movie", token, {"query": title, "language": "en-US"})
        if data2 and data2.get("results"):
            return data2["results"][0]["id"]
    return None

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    token = sys.argv[1].strip()

    # Auth check
    check = tmdb_get("/configuration", token)
    if not check:
        print("ERROR: Could not connect to TMDB. Check your token and internet connection.")
        sys.exit(1)
    print("TMDB connection OK\n")

    movies = json.loads(JSON.read_text(encoding="utf-8"))
    to_enrich = [m for m in movies if needs_data(m)]

    print(f"Films needing enrichment: {len(to_enrich)} / {len(movies)}")
    print("Fetching from TMDB (poster + plot + rating + runtime + genres)...\n")

    enriched   = 0
    not_found  = []

    for i, m in enumerate(to_enrich):
        title = m.get("title", "")
        year  = m.get("year")
        iid   = m.get("imdbId")
        label = f"[{i+1}/{len(to_enrich)}]"

        # Step 1: find TMDB id
        tmdb_id = None
        if iid:
            tmdb_id = find_tmdb_id_by_imdb(iid, token)
            time.sleep(0.27)

        if not tmdb_id:
            tmdb_id = find_tmdb_id_by_search(title, year, token)
            time.sleep(0.27)

        if not tmdb_id:
            not_found.append(f"{title} ({year})")
            print(f"  {label} ✗  {title} ({year}) — not found on TMDB")
            continue

        # Step 2: fetch full details (runtime, genres, plot, rating, poster)
        meta = fetch_full_details(tmdb_id, token)
        time.sleep(0.27)

        if not meta:
            not_found.append(f"{title} ({year})")
            print(f"  {label} ✗  {title} ({year}) — details fetch failed")
            continue

        # Step 3: fill in only missing fields (never overwrite existing data)
        filled = []
        for field in METADATA_FIELDS:
            if not m.get(field) and meta.get(field):
                m[field] = meta[field]
                filled.append(field)

        if filled:
            enriched += 1
            print(f"  {label} ✓  {title} ({year}) — added: {', '.join(filled)}")
        else:
            print(f"  {label} –  {title} ({year}) — already complete")

    JSON.write_text(json.dumps(movies, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\n{'='*55}")
    print(f"Enriched {enriched} / {len(to_enrich)} films.")
    print(f"movies.json updated.")

    if not_found:
        print(f"\nCould not find on TMDB ({len(not_found)} films):")
        for t in not_found:
            print(f"  - {t}")

    print(f"\nNow run:  python3 build.py")

if __name__ == "__main__":
    main()
