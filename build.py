#!/usr/bin/env python3
"""
build.py – My Movies (my-movies-app)
Combines movies.json + styles.css + app.js into a single standalone.html
that works offline when cached by Safari (Add to Home Screen).

Run from the project folder:
    python3 build.py

Then serve and open standalone.html in Safari on the iPhone.
Keep standalone.html local only (do not commit; it contains your data).
"""

import json
import pathlib
import sys

here = pathlib.Path(__file__).parent

def read(filename):
    path = here / filename
    if not path.exists():
        print(f"ERROR: {filename} not found in {here}")
        sys.exit(1)
    return path.read_text(encoding='utf-8')

# Read source files
css     = read('styles.css')
js      = read('app.js')
movies  = json.loads(read('movies.json'))
index   = read('index.html')

# Embed movies as a JS variable (compact JSON, no line breaks in strings)
movies_js = 'window.MOVIE_DATA = ' + json.dumps(movies, ensure_ascii=False) + ';'

# Inline CSS into index.html (replace the <link> tag)
html = index.replace(
    '<link rel="stylesheet" href="styles.css">',
    f'<style>\n{css}\n\t</style>'
)

# Inline JS + data (replace the <script src="app.js"> tag)
html = html.replace(
    '<script src="app.js"></script>',
    f'<script>\n\t{movies_js}\n\t</script>\n\t<script>\n{js}\n\t</script>'
)

out = here / 'standalone.html'
out.write_text(html, encoding='utf-8')
print(f"Built standalone.html ({out.stat().st_size // 1024} KB)")
print(f"  • {len(movies)} films embedded")
print(f"  Serve the folder and open: http://<your-mac-ip>:8000/standalone.html")
print(f"  Then in Safari → Share → Add to Home Screen for offline access.")
