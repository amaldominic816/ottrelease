document.addEventListener('DOMContentLoaded', () => {
  // Replace with your personal TMDB API Key (v3)
  const TMDB_API_KEY = '952e7b20d619d3157e526949b222a49d';
  const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
  const LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

  // DOM Elements
  const grid = document.getElementById('movie-grid');
  const languageSelect = document.getElementById('language-filter');
  const sortSelect = document.getElementById('sort-filter');
  const modal = document.getElementById('trailer-modal');
  const modalClose = document.getElementById('modal-close');
  const modalOverlay = document.getElementById('modal-overlay');
  const iframe = document.getElementById('trailer-iframe');

  async function loadMovies() {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">Querying verified OTT premieres & platform logos...</p>';

    const lang = languageSelect ? languageSelect.value : 'ml';
    const sort = sortSelect ? sortSelect.value : 'primary_release_date.desc';

    const discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=${lang}&sort_by=${sort}&page=1`;

    try {
      const res = await fetch(discoverUrl);
      if (!res.ok) throw new Error(`TMDB error: ${res.status}`);

      const data = await res.json();
      const basicMovies = (data.results || []).slice(0, 12);

      if (basicMovies.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No movies found for this filter selection.</p>';
        return;
      }

      // Fetch digital dates, platform providers, and logos concurrently
      const detailedMovies = await Promise.all(
        basicMovies.map(async (movie) => {
          try {
            const detailRes = await fetch(
              `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=release_dates,watch/providers`
            );
            if (!detailRes.ok) return { ...movie, ottDate: null, ottPlatform: null, ottLogo: null };
            const detailData = await detailRes.json();

            // Extract Type 4 (Digital/OTT) release date
            let ottDate = null;
            const countryReleases = detailData.release_dates ? detailData.release_dates.results : [];
            const targetedCountry = countryReleases.find(c => c.iso_3166_1 === 'IN') || countryReleases[0];

            if (targetedCountry && targetedCountry.release_dates) {
              const digitalEntry = targetedCountry.release_dates.find(r => r.type === 4);
              if (digitalEntry && digitalEntry.release_date) {
                ottDate = digitalEntry.release_date.split('T')[0];
              }
            }

            // Extract OTT platform name and CDN logo path
            let ottPlatform = null;
            let ottLogo = null;
            const providers = detailData['watch/providers'] ? detailData['watch/providers'].results : null;
            const targetRegion = providers && (providers.IN || providers.US);

            if (targetRegion && targetRegion.flatrate && targetRegion.flatrate.length > 0) {
              const primaryProvider = targetRegion.flatrate[0];
              ottPlatform = primaryProvider.provider_name;
              ottLogo = primaryProvider.logo_path ? `${LOGO_BASE}${primaryProvider.logo_path}` : null;
            }

            return { ...movie, ottDate, ottPlatform, ottLogo };
          } catch {
            return { ...movie, ottDate: null, ottPlatform: null, ottLogo: null };
          }
        })
      );

      renderCardsWithAds(detailedMovies);
      updateSchemaOrg(detailedMovies);
    } catch (err) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444;">Could not load releases. Check TMDB API key configuration.</p>';
      console.error('Fetch error:', err);
    }
  }

  function renderCardsWithAds(movies) {
    grid.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];

    movies.forEach((movie, index) => {
      // In-Grid Native Ad placement after 6th movie card
      if (index === 6) {
        const adCard = document.createElement('article');
        adCard.className = 'card-native-ad';
        adCard.innerHTML = `
          <span class="ad-label">Sponsored</span>
          <div style="font-size:0.85rem; color:#94a3b8; margin: 1rem 0;">Adsterra In-Feed Recommendation</div>
          <!-- PASTE ADSTERRA 300x250 RECTANGLE CODE BELOW -->
          <div style="width:250px; height:250px; background:#1e2433; display:flex; align-items:center; justify-content:center; font-size:0.75rem; color:#64748b; border: 1px dashed #334155;">
            Adsterra Native Ad
          </div>
        `;
        grid.appendChild(adCard);
      }

      const poster = movie.poster_path
        ? `${IMAGE_BASE}${movie.poster_path}`
        : 'https://via.placeholder.com/500x750?text=No+Poster';

      const safeTitle = (movie.title || 'Untitled').replace(/"/g, '&quot;');
      const theatrical = movie.release_date || 'In Theaters';

      // Evaluate OTT timing status
      let statusClass = 'tba';
      let ottDisplayDate = 'Announcing Soon';

      if (movie.ottDate) {
        if (movie.ottDate <= today) {
          statusClass = 'live';
          ottDisplayDate = movie.ottDate;
        } else {
          statusClass = 'upcoming';
          ottDisplayDate = movie.ottDate;
        }
      } else if (movie.ottPlatform) {
        statusClass = 'live';
        ottDisplayDate = 'Now Streaming';
      }

      // Streaming service badge with TMDB logo
      let platformBadge = '';
      if (movie.ottLogo) {
        platformBadge = `
          <div class="platform-pill">
            <img src="${movie.ottLogo}" alt="${movie.ottPlatform}" loading="lazy">
            <span>${movie.ottPlatform}</span>
          </div>`;
      } else if (movie.ottPlatform) {
        platformBadge = `
          <div class="platform-pill">
            <span>${movie.ottPlatform}</span>
          </div>`;
      }

      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <a href="movie.html?id=${movie.id}" class="poster-box" style="display:block; text-decoration:none;" aria-label="View details for ${safeTitle}">
          <img src="${poster}" alt="${safeTitle} poster" loading="lazy">
          ${platformBadge}
        </a>
        <div class="card-content">
          <h2 class="card-title">
            <a href="movie.html?id=${movie.id}" style="color: inherit; text-decoration: none;">
              ${movie.title}
            </a>
          </h2>
          <div class="card-meta">Rating: ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}/10 &bull; ${(movie.original_language || '').toUpperCase()}</div>

          <div class="date-schedule">
            <div class="schedule-row">
              <span class="label-muted">Theater:</span>
              <span>${theatrical}</span>
            </div>
            <div class="schedule-row">
              <span class="label-muted">OTT Premiere:</span>
              <span class="val-ott ${statusClass}">${ottDisplayDate}</span>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; margin-top: auto;">
            <a href="movie.html?id=${movie.id}" class="btn-trailer" style="flex:1; background: var(--bg-elevated); border: 1px solid var(--border-card); text-decoration:none; text-align:center;">
              Details
            </a>
            <button class="btn-trailer" data-id="${movie.id}" data-title="${safeTitle}" style="flex:1;">
              ▶ Trailer
            </button>
          </div>
        </div>
      `;

      grid.appendChild(card);
    });

    // Attach click listeners to trailer modal buttons
    document.querySelectorAll('button.btn-trailer').forEach(btn => {
      btn.addEventListener('click', () => {
        openTrailer(btn.getAttribute('data-id'), btn.getAttribute('data-title'));
      });
    });
  }

  // Open trailer modal or fallback to direct YouTube search
  async function openTrailer(movieId, movieTitle) {
    try {
      const endpoint = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${TMDB_API_KEY}&include_video_language=ml,ta,hi,en,null`;
      const res = await fetch(endpoint);
      const data = await res.json();
      const videos = data.results || [];

      const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer')
                   || videos.find(v => v.site === 'YouTube' && v.type === 'Teaser')
                   || videos.find(v => v.site === 'YouTube');

      if (trailer && trailer.key) {
        iframe.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1`;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
      } else {
        const query = encodeURIComponent(`${movieTitle} official trailer`);
        window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener,noreferrer');
      }
    } catch {
      const query = encodeURIComponent(`${movieTitle} official trailer`);
      window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener,noreferrer');
    }
  }

  function closeModal() {
    iframe.src = '';
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalOverlay) modalOverlay.addEventListener('click', closeModal);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });

  // Dynamic ItemList JSON-LD generation
  function updateSchemaOrg(movies) {
    const script = document.getElementById('movie-schema');
    if (!script) return;

    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Latest Movie OTT Release Dates",
      "itemListElement": movies.map((m, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": "Movie",
          "name": m.title,
          "datePublished": m.ottDate || m.release_date,
          "image": m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : undefined
        }
      }))
    });
  }

  if (languageSelect) languageSelect.addEventListener('change', loadMovies);
  if (sortSelect) sortSelect.addEventListener('change', loadMovies);

  loadMovies();
});
