# My Movies (my-movies-app)

Personal digital movie collection: search, sort, and open titles in IMDb / Apple TV / Prime / Sky. Add to Home Screen on iPhone for a PWA-style app.

## Hosting (e.g. GitHub Pages)

The app has **no movie data on the server**. Open the site, then use **Load movies JSON** to pick your local `movies.json` file. Your data stays on your device.

## Project structure

| File | Role |
|------|------|
| **movies.json** | Your data (array of film objects). Keep local; use **Load movies JSON** in the app to load it. See **movies.schema.json**. |
| **movies.schema.json** | JSON Schema for each film entry. Used by **validate_movies.py**. |
| **validate_movies.py** | Validates `movies.json` against the schema. Run before/after edits. |
| **normalise_movies.py** | One-time: backs up `movies.json`, coerces types, normalises field order. Run once then validate. |
| **build.py** | Bakes `movies.json` + CSS + JS into **standalone.html** for offline/Add to Home Screen. Run after editing data. Keep standalone.html local only. |
| **index.html** | UI: landing (file picker), header, search, sort, filters, list. No movie data. |
| **styles.css** | All visual styling. |
| **app.js** | Loads data via file picker or `window.MOVIE_DATA` (standalone build); filter, sort, render. |

The product roadmap is held offline (not in this repo).

## Run locally

From this folder:

```bash
./serve.sh
```

Then open the printed URL in Safari (Mac or iPhone on same Wi‑Fi). On first load you’ll see **Load movies JSON**; choose your local `movies.json` to view your collection. Add to Home Screen on iPhone for a cached PWA.

For a **single-file offline version** with data baked in, run `python3 build.py` after changing `movies.json`. Open `standalone.html` (e.g. via the same server). Do not commit `standalone.html`; it contains your data.

## Data format (movies.json)

Defined by **movies.schema.json**. Each array element is one film.

**Required**

- **title** (string): Film name.
- **year** (integer): Release year.
- **provider** (string): `"apple"` | `"prime"` | `"sky"` | `"blinkbox"` | `"bluray"` | `"dvd"`.
- **imdbId** (string): e.g. `"tt0107290"`.

**Optional**

- **status**: `"defunct"` for discontinued services (e.g. Blinkbox).
- **posterUrl**, **plot** (strings): Poster URL and plot text.
- **imdbRating** (number), **runtime** (integer, minutes), **genres** (array of strings).
- **yourRating** (integer 1–10), **dateRated** (string): Your rating and when you rated it.

Validate with:

```bash
python3 validate_movies.py
```
