/**
 * My Movies - processing: load data, filter, sort, render.
 * Data is loaded via file picker (movies.json) or injected as window.MOVIE_DATA in standalone build.
 */

(function () {
	'use strict';

	var movies = [];
	var currentSort = 'newest';
	var sortDir = 1; // 1 = default direction, -1 = reversed

	// Active filters: { format: Set, decade: Set, genre: Set }
	var activeFilters = { format: new Set(), decade: new Set(), genre: new Set() };
	var filterOpen = false;

	var STORAGE_KEY_MOVIES = 'my-movies-app.movies';
	var statusStripHideTimer = null;

	var BRAND_SVGS = {
		apple: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="vertical-align:middle;display:inline-block" aria-label="Apple TV"><path d="M20.57 17.735h-1.815l-3.34-9.203h1.633l2.02 5.987c.075.231.273.9.586 2.012l.297-.997.33-1.006 2.094-6.004H24zm-5.344-.066a5.76 5.76 0 0 1-1.55.207c-1.23 0-1.84-.693-1.84-2.087V9.646h-1.063V8.532h1.121V7.081l1.476-.602v2.062h1.707v1.113H13.38v5.805c0 .446.074.75.214.932.14.182.396.264.75.264.207 0 .495-.041.883-.115zm-7.29-5.343c.017 1.764 1.55 2.358 1.567 2.366-.017.042-.248.842-.808 1.658-.487.71-.99 1.418-1.79 1.435-.783.016-1.03-.462-1.93-.462-.89 0-1.17.445-1.913.478-.758.025-1.344-.775-1.838-1.484-.998-1.451-1.765-4.098-.734-5.88.51-.89 1.426-1.451 2.416-1.46.75-.016 1.468.512 1.93.512.461 0 1.327-.627 2.234-.536.38.016 1.452.157 2.136 1.154-.058.033-1.278.743-1.27 2.219M6.468 7.988c.404-.495.685-1.18.61-1.864-.585.025-1.294.388-1.723.883-.38.437-.71 1.138-.619 1.806.652.05 1.328-.338 1.732-.825Z"/></svg>',
		sky: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="vertical-align:middle;display:inline-block" aria-label="Sky"><path d="M7.387 13.656c0 1.423-.933 2.454-2.823 2.675-1.35.147-3.337-.025-4.294-.148-.025-.147-.074-.343-.074-.49 0-1.252.663-1.522 1.3-1.522.664 0 1.694.123 2.455.123.834 0 1.104-.295 1.104-.565 0-.368-.343-.515-1.006-.638l-1.767-.343C.785 12.453 0 11.423 0 10.343c0-1.325.933-2.454 2.798-2.65 1.398-.148 3.116.024 4.049.122.024.172.049.32.049.491 0 1.252-.663 1.522-1.276 1.522-.491 0-1.227-.099-2.086-.099-.884 0-1.227.246-1.227.54 0 .32.343.442.883.54l1.718.32c1.742.294 2.479 1.3 2.479 2.527m3.092 1.521c0 .761-.295 1.203-1.792 1.203-.196 0-.368-.025-.54-.05V6.22c0-.76.27-1.57 1.767-1.57.196 0 .393.024.565.049zm6.085 3.927c.197.098.59.22 1.105.245.859.025 1.325-.319 1.693-1.08L24 7.913a2.5 2.5 0 0 0-.957-.22c-.589 0-1.399.122-1.914 1.325l-1.497 3.534-2.945-4.81c-.196-.05-.662-.148-1.006-.148-1.03 0-1.62.393-2.233 1.031l-2.871 3.141 2.306 3.632c.418.663.982 1.006 1.89 1.006.589 0 1.104-.147 1.325-.245l-2.773-4.196 1.963-2.086 3.24 5.08Z"/></svg>'
	};

	var STORE_SCHEMES = { apple: 'videos://', prime: 'primevideo://', sky: 'skystore://' };
	var STORE_LABELS = {
		apple: 'Apple TV', prime: 'Prime Video', sky: 'Sky Store',
		bluray: '💿 Blu-ray', dvd: '📀 DVD'
	};
	var PROVIDER_LABELS = {
		apple: 'Apple TV', prime: 'Prime Video', sky: 'Sky Store',
		blinkbox: 'Blinkbox (Defunct)', bluray: 'Blu-ray', dvd: 'DVD'
	};
	var PHYSICAL = { bluray: true, dvd: true };

	var FORMAT_ORDER = ['bluray', 'dvd', 'apple', 'prime', 'sky', 'blinkbox'];
	var FORMAT_LABELS = {
		bluray: 'Blu-ray', dvd: 'DVD', apple: 'Apple',
		prime: 'Prime', sky: 'Sky', blinkbox: 'Blinkbox'
	};
	var STATS_LABELS = {
		bluray: '💿 BLU-RAY', dvd: '📀 DVD', apple: 'APPLE',
		prime: 'PRIME', sky: 'SKY', blinkbox: 'BLINKBOX'
	};

	function get(id) { return document.getElementById(id); }

	function formatRuntime(mins) {
		if (!mins) return null;
		var h = Math.floor(mins / 60), m = mins % 60;
		return h ? h + 'h ' + (m ? m + 'm' : '') : m + 'm';
	}

	// ── Build available filter values from data ──────────────────────────────

	function availableFormats() {
		var seen = {};
		movies.forEach(function (m) { if (m.provider) seen[m.provider] = true; });
		return FORMAT_ORDER.filter(function (p) { return seen[p]; });
	}

	function availableDecades() {
		var seen = {};
		movies.forEach(function (m) {
			if (m.year) {
				var d = Math.floor(m.year / 10) * 10;
				seen[d] = true;
			}
		});
		return Object.keys(seen).map(Number).sort(function (a, b) { return b - a; });
	}

	function availableGenres() {
		var seen = {};
		movies.forEach(function (m) {
			if (m.genres) m.genres.forEach(function (g) { seen[g] = true; });
		});
		return Object.keys(seen).sort();
	}

	// ── Render chips ─────────────────────────────────────────────────────────

	function buildChips(containerId, values, activeSet, labelFn) {
		var container = get(containerId);
		if (!container) return;
		container.innerHTML = '';
		values.forEach(function (val) {
			var btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'chip' + (activeSet.has(String(val)) ? ' active' : '');
			btn.textContent = labelFn ? labelFn(val) : String(val);
			btn.dataset.value = String(val);
			container.appendChild(btn);
		});
	}

	function refreshChips() {
		buildChips('chipsFormat', availableFormats(), activeFilters.format, function (p) {
			return FORMAT_LABELS[p] || p;
		});
		buildChips('chipsDecade', availableDecades(), activeFilters.decade, function (d) {
			return d + 's';
		});
		buildChips('chipsGenre', availableGenres(), activeFilters.genre, null);
	}

	// ── Filter panel toggle ──────────────────────────────────────────────────

	function setFilterOpen(open) {
		filterOpen = open;
		var panel  = get('filterPanel');
		var toggle = get('filterToggle');
		if (panel)  panel.classList.toggle('open', open);
		if (toggle) toggle.classList.toggle('active', open);
		if (open) refreshChips();
	}

	// ── Provider stats ───────────────────────────────────────────────────────

	function updateProviderStats() {
		var counts = {};
		movies.forEach(function (m) {
			var p = (m.provider || 'unknown').toLowerCase();
			counts[p] = (counts[p] || 0) + 1;
		});

		var statsEl = get('providerStats');
		var countEl = get('filmCount');
		if (!statsEl || !countEl) return;

		var parts = [];
		var streamingEmojiBefore = false;
		FORMAT_ORDER.forEach(function (p) {
			if (!counts[p]) return;
			var isStreaming = !PHYSICAL[p];
			if (isStreaming && !streamingEmojiBefore) {
				parts.push('▶️');
				streamingEmojiBefore = true;
			}
			parts.push((STATS_LABELS[p] || p) + ' ' + counts[p]);
		});

		statsEl.textContent = parts.join(' · ');
		countEl.innerHTML = '<span>' + movies.length + '</span> FILMS';
	}

	// ── Apply filters + search ───────────────────────────────────────────────
	// Each sort also applies a filter: hide films that lack the data that sort uses.
	// A–Z shows everything; others filter then sort.

	function filteredMovies() {
		var searchEl = get('searchInput');
		var query = searchEl && searchEl.value ? searchEl.value.trim().toLowerCase() : '';

		var hasFormat = activeFilters.format.size > 0;
		var hasDecade = activeFilters.decade.size > 0;
		var hasGenre  = activeFilters.genre.size > 0;

		var items = movies.filter(function (m) {
			// Search
			if (query && (m.title || '').toLowerCase().indexOf(query) === -1) return false;
			// Format
			if (hasFormat && !activeFilters.format.has(m.provider || '')) return false;
			// Decade
			if (hasDecade) {
				var d = m.year ? String(Math.floor(m.year / 10) * 10) : '';
				if (!activeFilters.decade.has(d)) return false;
			}
			// Genre
			if (hasGenre) {
				var mg = m.genres || [];
				var found = false;
				activeFilters.genre.forEach(function (g) { if (mg.indexOf(g) !== -1) found = true; });
				if (!found) return false;
			}
			return true;
		});

		// Sort-based filter: only show films that have the data this sort uses
		if (currentSort === 'newest') {
			items = items.filter(function (m) { return m.year != null && m.year !== 0; });
		} else if (currentSort === 'mine') {
			items = items.filter(function (m) { return m.yourRating != null; });
		} else if (currentSort === 'imdb') {
			items = items.filter(function (m) { return m.imdbRating != null && parseFloat(m.imdbRating) > 0; });
		} else if (currentSort === 'runtime') {
			items = items.filter(function (m) { return m.runtime != null && m.runtime > 0; });
		}
		// currentSort === 'alpha': no filter, show all

		return items;
	}

	// ── Update filter count label ────────────────────────────────────────────

	function updateFilterCount(visible, total) {
		var el = get('filterCount');
		if (!el) return;
		var numFilters = activeFilters.format.size + activeFilters.decade.size + activeFilters.genre.size;
		var toggleEl = get('filterToggle');
		if (toggleEl) toggleEl.classList.toggle('has-filters', numFilters > 0);

		if (numFilters === 0) {
			el.textContent = 'showing all';
		} else {
			el.textContent = visible + ' of ' + total + ' · ' + numFilters + ' filter' + (numFilters > 1 ? 's' : '');
		}
	}

	// ── Build card ───────────────────────────────────────────────────────────

	function buildStoreBtn(item, detail) {
		var cls = detail ? 'btn-link btn-detail btn-' : 'btn-link btn-';
		if (item.status === 'defunct') {
			return '<span class="' + cls + 'defunct">Service Defunct</span>';
		}
		if (PHYSICAL[item.provider]) {
			return '<span class="' + cls + item.provider + '">' + (STORE_LABELS[item.provider] || item.provider) + '</span>';
		}
		var scheme = STORE_SCHEMES[item.provider] || '#';
		var label  = BRAND_SVGS[item.provider] || STORE_LABELS[item.provider] || (item.provider || '').toUpperCase();
		return '<a href="' + scheme + '" class="' + cls + item.provider + '">' + label + '</a>';
	}

	function buildImdbBtn(item, detail) {
		if (!item.imdbId) return '';
		var url = 'https://www.imdb.com/title/' + item.imdbId + '/';
		var cls = detail ? 'btn-link btn-detail btn-imdb' : 'btn-link btn-imdb';
		return '<a href="' + url + '" class="' + cls + '">IMDb</a>';
	}

	function buildCard(item) {
		var div = document.createElement('div');
		div.className = 'item' + (item.status === 'defunct' ? ' defunct' : '');

		var posterHtml = item.posterUrl
			? '<img class="item-poster" src="' + item.posterUrl + '" alt="" loading="lazy">'
			: '';

		var runtimeStr = formatRuntime(item.runtime);
		// Precedence: your rating first, then IMDb score
		var primaryRatingStr = item.yourRating ? '⭐ ' + item.yourRating : (item.imdbRating ? '★ ' + item.imdbRating : '');
		var primaryRatingClass = item.yourRating ? 'item-your-rating' : 'item-imdb-inline';
		var metaParts  = [(item.provider || '').toUpperCase()];
		if (primaryRatingStr) metaParts.push('<span class="' + primaryRatingClass + '">' + primaryRatingStr + '</span>');

		var mainHtml =
			'<div class="item-main">' +
				posterHtml +
				'<div class="item-info">' +
					'<div class="item-year">' + (item.year || '') + '</div>' +
					'<div class="item-title">' + (item.title || '') + '</div>' +
					'<div class="item-meta">' + metaParts.join('') + '</div>' +
				'</div>' +
				'<div class="badge-stack">' +
					buildImdbBtn(item, false) +
					buildStoreBtn(item, false) +
				'</div>' +
			'</div>';

		var genreHtml = '';
		if (item.genres && item.genres.length) {
			genreHtml = '<div class="item-genres">' +
				item.genres.map(function(g) { return '<span class="genre-tag">' + g + '</span>'; }).join('') +
				'</div>';
		}
		var statsHtml = '';
		var statParts = [];
		if (item.yourRating) statParts.push('<span class="your-rating">⭐ ' + item.yourRating + ' Rated</span>');
		if (item.imdbRating) statParts.push('<span class="imdb-score">★ ' + item.imdbRating + ' IMDb</span>');
		if (runtimeStr) statParts.push('<span>⏱ ' + runtimeStr + '</span>');
		if (statParts.length) statsHtml = '<div class="item-stats">' + statParts.join('') + '</div>';

		var plotHtml = item.plot ? '<p class="item-plot">' + item.plot + '</p>' : '';

		var detailHtml =
			'<div class="item-detail">' +
				genreHtml + statsHtml + plotHtml +
			'</div>';

		div.innerHTML = mainHtml + detailHtml;

		div.addEventListener('click', function () {
			var wasExpanded = div.classList.contains('expanded');
			var all = document.querySelectorAll('.item.expanded');
			for (var i = 0; i < all.length; i++) all[i].classList.remove('expanded');
			if (!wasExpanded) div.classList.add('expanded');
		});

		return div;
	}

	// ── Render ───────────────────────────────────────────────────────────────

	function render() {
		var list = get('mediaList');
		if (!list) return;

		try {
			var clearBtn = get('clearSearch');
			var banner   = get('warningBanner');
			var detailEl = get('warningDetail');
			var query    = (get('searchInput') || {}).value || '';
			query = query.trim().toLowerCase();

			if (clearBtn) clearBtn.style.display = query.length > 0 ? 'flex' : 'none';

			var items = filteredMovies();

			if (currentSort === 'alpha') {
				items.sort(function (a, b) { return sortDir * (a.title || '').localeCompare(b.title || ''); });
			} else if (currentSort === 'imdb') {
				items.sort(function (a, b) { return sortDir * ((parseFloat(b.imdbRating) || 0) - (parseFloat(a.imdbRating) || 0)); });
			} else if (currentSort === 'runtime') {
				items.sort(function (a, b) { return sortDir * ((b.runtime || 0) - (a.runtime || 0)); });
			} else if (currentSort === 'mine') {
				// List is already filtered to films with yourRating
				items.sort(function (a, b) { return sortDir * (Number(b.yourRating) - Number(a.yourRating)); });
			} else {
				items.sort(function (a, b) { return sortDir * ((b.year || 0) - (a.year || 0)); });
			}

			updateFilterCount(items.length, movies.length);

			list.innerHTML = '';
			var frag = document.createDocumentFragment();
			items.forEach(function (item) { frag.appendChild(buildCard(item)); });
			list.appendChild(frag);

			// DO NOT REBUY banner
			var match = null;
			for (var i = 0; i < movies.length; i++) {
				if (movies[i].title && movies[i].title.toLowerCase() === query && query.length > 2) {
					match = movies[i]; break;
				}
			}
			if (banner) {
				if (match) {
					if (detailEl) detailEl.textContent = 'Owned on ' + (PROVIDER_LABELS[match.provider] || match.provider);
					banner.style.display = 'block';
				} else {
					banner.style.display = 'none';
				}
			}
		} catch (e) {
			list.innerHTML = '<p style="color:var(--text-dim);padding:20px;">Could not render list: ' + e.message + '</p>';
		}
	}

	// ── Chip click delegation ─────────────────────────────────────────────────

	function onChipClick(filterKey, value) {
		var s = activeFilters[filterKey];
		if (s.has(value)) { s.delete(value); } else { s.add(value); }
		refreshChips();
		render();
	}

	function wireChipRow(containerId, filterKey) {
		var container = get(containerId);
		if (!container) return;
		container.addEventListener('click', function (e) {
			var chip = e.target.closest('.chip');
			if (chip) onChipClick(filterKey, chip.dataset.value);
		});
	}

	// ── Init ─────────────────────────────────────────────────────────────────

	function clearInput() {
		var el = get('searchInput');
		if (el) { el.value = ''; render(); }
	}

	function setSort(s) {
		if (currentSort === s) {
			sortDir = sortDir * -1; // reverse on second tap
		} else {
			currentSort = s;
			sortDir = 1;
		}
		var sortNew     = get('sortNew');
		var sortAlpha   = get('sortAlpha');
		var sortImdb    = get('sortImdb');
		var sortRuntime = get('sortRuntime');
		var sortMine    = get('sortMine');
		var arrow = sortDir === 1 ? ' ↓' : ' ↑';
		if (sortNew)     sortNew.className     = (currentSort === 'newest')  ? 'sort-btn active' : 'sort-btn';
		if (sortAlpha)   sortAlpha.className   = (currentSort === 'alpha')   ? 'sort-btn active' : 'sort-btn';
		if (sortImdb)    sortImdb.className    = (currentSort === 'imdb')    ? 'sort-btn active' : 'sort-btn';
		if (sortRuntime) sortRuntime.className = (currentSort === 'runtime') ? 'sort-btn active' : 'sort-btn';
		if (sortMine)    sortMine.className    = (currentSort === 'mine')    ? 'sort-btn active' : 'sort-btn';
		if (sortNew)     sortNew.textContent     = '📅 Date'  + (currentSort === 'newest'  ? arrow : '');
		if (sortAlpha)   sortAlpha.textContent   = '🔤 A-Z'   + (currentSort === 'alpha'   ? arrow : '');
		if (sortImdb)    sortImdb.textContent    = '★ IMDb'   + (currentSort === 'imdb'    ? arrow : '');
		if (sortRuntime) sortRuntime.textContent = '⏱ Time'   + (currentSort === 'runtime' ? arrow : '');
		if (sortMine)    sortMine.textContent    = '⭐ Rated' + (currentSort === 'mine'    ? arrow : '');
		render();
	}

	function clearAllFilters() {
		activeFilters.format.clear();
		activeFilters.decade.clear();
		activeFilters.genre.clear();
		refreshChips();
		render();
	}

	function init() {
		var searchInput = get('searchInput');
		if (searchInput) searchInput.addEventListener('input', render);

		var clearBtn   = get('clearSearch');
		var sortNew    = get('sortNew');
		var sortAlpha  = get('sortAlpha');
		var filterTog  = get('filterToggle');
		var filterDone = get('filterDone');
		var filterClr  = get('filterClearAll');

		if (clearBtn)   clearBtn.addEventListener('click', clearInput);
		if (sortNew)    sortNew.addEventListener('click',  function () { setSort('newest'); });
		if (sortAlpha)  sortAlpha.addEventListener('click', function () { setSort('alpha'); });
		var sortImdb    = get('sortImdb');
		var sortRuntime = get('sortRuntime');
		var sortMine    = get('sortMine');
		if (sortImdb)    sortImdb.addEventListener('click',   function () { setSort('imdb'); });
		if (sortRuntime) sortRuntime.addEventListener('click', function () { setSort('runtime'); });
		if (sortMine)    sortMine.addEventListener('click',    function () { setSort('mine'); });
		if (filterTog)  filterTog.addEventListener('click', function () { setFilterOpen(!filterOpen); });
		if (filterDone) filterDone.addEventListener('click', function () { setFilterOpen(false); });
		if (filterClr)  filterClr.addEventListener('click', clearAllFilters);

		wireChipRow('chipsFormat', 'format');
		wireChipRow('chipsDecade', 'decade');
		wireChipRow('chipsGenre',  'genre');

		var btnLoadDifferent = get('btnLoadDifferent');
		if (btnLoadDifferent) {
			btnLoadDifferent.addEventListener('click', function () {
				if (statusStripHideTimer) {
					clearTimeout(statusStripHideTimer);
					statusStripHideTimer = null;
				}
				hideStatusStrip();
				localStorage.removeItem(STORAGE_KEY_MOVIES);
				var fileInput = get('moviesFileInput');
				if (fileInput) fileInput.click();
			});
		}

		updateProviderStats();
		render();
	}

	function runWithData(loadedMovies) {
		movies = Array.isArray(loadedMovies) ? loadedMovies : [];
		init();
	}

	function showError(msg) {
		var list = get('mediaList');
		if (list) list.innerHTML = '<p style="color:var(--text-dim);padding:20px;">' + msg + '</p>';
	}

	function showLanding() {
		var landing = get('landing');
		var appContent = get('appContent');
		if (landing) landing.classList.remove('hidden');
		if (appContent) appContent.classList.add('hidden');
	}

	function showMainUI() {
		var landing = get('landing');
		var appContent = get('appContent');
		if (landing) landing.classList.add('hidden');
		if (appContent) appContent.classList.remove('hidden');
	}

	function showStatusStrip(msg) {
		var strip = get('statusStrip');
		if (!strip) return;
		if (statusStripHideTimer) {
			clearTimeout(statusStripHideTimer);
			statusStripHideTimer = null;
		}
		strip.textContent = msg;
		strip.classList.add('visible');
	}

	function hideStatusStrip() {
		var strip = get('statusStrip');
		if (strip) strip.classList.remove('visible');
		statusStripHideTimer = null;
	}


	function parseMoviesPayload(parsed) {
		if (Array.isArray(parsed)) return parsed;
		if (parsed && typeof parsed === 'object') {
			if (Array.isArray(parsed.movies)) return parsed.movies;
			if (Array.isArray(parsed.films)) return parsed.films;
			if (Array.isArray(parsed.data)) return parsed.data;
		}
		return null;
	}

	// Normalise and filter: accept old or partial format; require only title; coerce types.
	function normaliseMoviesArray(arr) {
		if (!Array.isArray(arr)) return [];
		var out = [];
		for (var i = 0; i < arr.length; i++) {
			var m = arr[i];
			if (!m || typeof m !== 'object') continue;
			var title = m.title != null ? String(m.title) : (m.name != null ? String(m.name) : '');
			if (!title.trim()) continue;
			var year = m.year;
			if (typeof year !== 'number') year = typeof year === 'string' ? parseInt(year, 10) : 0;
			if (isNaN(year)) year = 0;
			var provider = m.provider != null ? String(m.provider).toLowerCase() : '';
			var imdbId = m.imdbId != null ? String(m.imdbId).trim() : '';
			out.push({
				title: title.trim(),
				year: year,
				provider: provider || 'unknown',
				imdbId: imdbId,
				status: m.status,
				posterUrl: m.posterUrl,
				plot: m.plot,
				imdbRating: m.imdbRating,
				runtime: m.runtime,
				genres: Array.isArray(m.genres) ? m.genres : undefined,
				yourRating: m.yourRating,
				dateRated: m.dateRated
			});
		}
		return out;
	}

	function loadMoviesFile(file, onSuccess, onError) {
		var reader = new FileReader();
		reader.onerror = function () {
			onError('Could not read the file.');
		};
		reader.onload = function () {
			try {
				var raw = String(reader.result || '[]').trim();
				raw = raw.replace(/^\uFEFF/, ''); // strip BOM if present
				// Allow trailing comma at end of array/object (invalid JSON but common)
				raw = raw.replace(/,\s*\]\s*$/, ']').replace(/,\s*\}\s*$/, '}');
				if (!raw) {
					onError('The file is empty.');
					return;
				}
				var parsed = JSON.parse(raw);
				var arr = parseMoviesPayload(parsed);
				if (!arr || arr.length === 0) {
					onError('Could not find a movie list. The file should be a JSON array, or an object with a "movies" (or "films") array.');
					return;
				}
				var normalised = normaliseMoviesArray(arr);
				if (normalised.length === 0) {
					onError('No valid entries found. Each item needs at least a "title" (or "name").');
					return;
				}
				onSuccess(normalised);
			} catch (e) {
				var msg = e && e.message ? e.message : String(e);
				onError('Not valid JSON: ' + msg + '. Use movies.json (a file that is one JSON array of film objects with title, year, provider, imdbId).');
			}
		};
		reader.readAsText(file);
	}

	function wireFileInputChange() {
		var fileInput = get('moviesFileInput');
		if (!fileInput) return;
		fileInput.addEventListener('change', function () {
			var file = fileInput.files && fileInput.files[0];
			if (!file) return;
			var btn = get('btnLoadMovies');
			if (btn) { btn.disabled = true; }
			showMainUI();
			showStatusStrip('Loading your collection…');
			loadMoviesFile(file, function (normalised) {
				try {
					runWithData(normalised);
					try {
						localStorage.setItem(STORAGE_KEY_MOVIES, JSON.stringify(normalised));
					} catch (e) {
						if (e.name === 'QuotaExceededError') {
							console.warn('Storage full; collection not saved.');
						}
					}
					showStatusStrip('Loaded ' + normalised.length + ' films');
					if (statusStripHideTimer) clearTimeout(statusStripHideTimer);
					statusStripHideTimer = setTimeout(function () {
						hideStatusStrip();
						statusStripHideTimer = null;
					}, 2000);
				} catch (err) {
					hideStatusStrip();
					showLanding();
					alert('Error loading movies: ' + (err && err.message ? err.message : String(err)));
					console.error('runWithData error', err);
					return;
				}
				fileInput.value = '';
				if (btn) { btn.textContent = 'Load movies JSON'; btn.disabled = false; }
			}, function (msg) {
				hideStatusStrip();
				showLanding();
				if (btn) { btn.textContent = 'Load movies JSON'; btn.disabled = false; }
				alert(msg);
				fileInput.value = '';
			});
		});
	}

	function wireFilePicker() {
		var btn = get('btnLoadMovies');
		var fileInput = get('moviesFileInput');
		if (!btn || !fileInput) return;
		btn.addEventListener('click', function () { fileInput.click(); });
	}

	function start() {
		wireFileInputChange();
		if (window.MOVIE_DATA && Array.isArray(window.MOVIE_DATA)) {
			showMainUI();
			runWithData(window.MOVIE_DATA);
			return;
		}
		var saved = localStorage.getItem(STORAGE_KEY_MOVIES);
		if (saved && saved.trim()) {
			try {
				var parsed = JSON.parse(saved);
				var arr = parseMoviesPayload(parsed);
				if (arr && arr.length > 0) {
					var normalised = normaliseMoviesArray(arr);
					if (normalised.length > 0) {
						showMainUI();
						runWithData(normalised);
						showStatusStrip('Loaded ' + normalised.length + ' films');
						if (statusStripHideTimer) clearTimeout(statusStripHideTimer);
						statusStripHideTimer = setTimeout(function () {
							hideStatusStrip();
							statusStripHideTimer = null;
						}, 2000);
						return;
					}
				}
				localStorage.removeItem(STORAGE_KEY_MOVIES);
			} catch (e) {
				localStorage.removeItem(STORAGE_KEY_MOVIES);
			}
		}
		showLanding();
		wireFilePicker();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start);
	} else {
		start();
	}
})();
