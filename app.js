document.addEventListener('DOMContentLoaded', () => {
  // Replace with your personal TMDB API Key (v3)
  const TMDB_API_KEY = '952e7b20d619d3157e526949b222a49d';
  const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

  // DOM Elements
  const grid = document.getElementById('movie-grid');
  const languageSelect = document.getElementById('language-filter');
  const sortSelect = document.getElementById('sort-filter');
  const modal = document.getElementById('trailer-modal');
  const modalClose = document.getElementById('modal-close');
  const modalOverlay = document.getElementById('modal-overlay');
  const iframe = document.getElementById('trailer-iframe');

  // Fetch movies and attach precise OTT digital release data
  async function loadMovies() {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">Checking OTT premiere dates & platforms...</p>';

    const lang = languageSelect ? languageSelect.value : 'ml';
    const sort = sortSelect ? sortSelect.value : 'primary_release_date.desc';

    const endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=${lang}&sort_by=${sort}&page=1`;

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`TMDB HTTP error: ${res.status}`);

      const data = await res.json();
      const basicMovies = (data.results || []).slice(0, 12);

      if (basicMovies.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No movies found for this selection.</p>';
        return;
      }

      // Fetch deep release data (Digital type 4 + Watch Providers) in parallel
      const detailedMovies = await Promise.all(
        basicMovies.map(async (movie) => {
          try {
            const detailRes = await fetch(
              `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=release_dates,watch/providers`
            );
            if (!detailRes.ok) return { ...movie, ottDate: null, ottPlatform: null };
            const detailData = await detailRes.json();

            // 1. Extract Digital / OTT Release Date (TMDB Type 4)
            let ottDate = null;
            const releaseData = detailData.release_dates ? detailData.release_dates.results : [];
            // Target India ('IN') region first, then fallback to global releases
            const countryRelease = releaseData.find(c => c.iso_3166_1 === 'IN') || releaseData[0];
            
            if (countryRelease && countryRelease.release_dates) {
              const digitalRelease = countryRelease.release_dates.find(r => r.type === 4);
              if (digitalRelease && digitalRelease.release_date) {
                ottDate = digitalRelease.release_date.split('T')[0];
              }
            }

            // 2. Extract Streaming Platform Name (e.g. Disney+ Hotstar, Netflix, JioCinema)
            let ottPlatform = null;
            const providers = detailData['watch/providers'] ? detailData['watch/providers'].results : null;
            const targetRegion = providers && (providers.IN || providers.US);
            if (targetRegion && targetRegion.flatrate && targetRegion.flatrate.length > 0) {
              ottPlatform = targetRegion.flatrate[0].provider_name;
            }

            return { ...movie, ottDate, ottPlatform };
          } catch {
            return { ...movie, ottDate: null, ottPlatform: null };
          }
        })
      );

      renderCards(detailedMovies);
      updateSchemaOrg(detailedMovies);
    } catch (err) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444;">Unable to load movies. Please check your TMDB API key.</p>';
      console.error('Fetch error:', err);
    }
  }

  // Render cards with OTT & Theatrical badges
  function renderCards(movies) {
    grid.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];

    movies.forEach(movie => {
      const poster = movie.poster_path
        ? `${IMAGE_BASE}${movie.poster_path}`
        : 'https://via.placeholder.com/500x750?text=No+Poster';

      const safeTitle = (movie.title || 'Untitled').replace(/"/g, '&quot;');
      const theatricalDate = movie.release_date || 'Date TBA';
      const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';

      // Determine OTT Status, Badge, and Display Text
      let ottBadgeText = 'OTT: TBA';
      let ottStatusClass = 'status-tba';
      let ottDetailText = 'OTT Release: Expected Soon';

      if (movie.ottDate) {
        if (movie.ottDate <= today) {
          ottBadgeText = movie.ottPlatform ? `Streaming on ${movie.ottPlatform}` : 'Now Streaming';
          ottStatusClass = 'status-live';
          ottDetailText = `Available on OTT (${movie.ottDate})`;
        } else {
          ottBadgeText = `OTT: ${movie.ottDate}`;
          ottStatusClass = 'status-upcoming';
          ottDetailText = `OTT Premiere: ${movie.ottDate}`;
        }
      } else if (movie.ottPlatform) {
        ottBadgeText = `Streaming on ${movie.ottPlatform}`;
        ottStatusClass = 'status-live';
        ottDetailText = `Streaming on ${movie.ottPlatform}`;
      }

      const card = document.createElement('article');
      card.className = 'card';
      card.setAttribute('itemscope', '');
      card.setAttribute('itemtype', 'https://schema.org/Movie');

      card.innerHTML = `
        <div class="poster-container">
          <img src="${poster}" alt="${safeTitle} poster" loading="lazy" itemprop="image">
          <span class="badge-ott ${ottStatusClass}">${ottBadgeText}</span>
        </div>
        <div class="card-body">
          <h2 class="movie-title" itemprop="name">${movie.title}</h2>
          <div class="meta-info">Rating: ${rating}/10 &bull; ${(movie.original_language || '').toUpperCase()}</div>

          <div class="dates-container">
            <div class="release-row">
              <span class="date-label">Theatrical:</span>
              <span class="date-val">${theatricalDate}</span>
            </div>
            <div class="release-row ott-row">
              <span class="date-label">OTT Date:</span>
              <span class="date-val ${ottStatusClass}">${movie.ottDate || 'Announcing Soon'}</span>
            </div>
          </div>

          <button class="btn-trailer" data-movie-id="${movie.id}" data-movie-title="${safeTitle}" aria-label="Watch trailer for ${safeTitle}">
            ▶ Watch Trailer
          </button>
        </div>
      `;

      grid.appendChild(card);
    });

    // Attach click handlers to trailer buttons
    document.querySelectorAll('.btn-trailer').forEach(btn => {
      btn.addEventListener('click', () => {
        const movieId = btn.getAttribute('data-movie-id');
        const movieTitle = btn.getAttribute('data-movie-title');
        openTrailer(movieId, movieTitle);
      });
    });
  }

  // Fetch trailer from TMDB; fallback to YouTube direct search
  async function openTrailer(movieId, movieTitle) {
    try {
      const endpoint = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${TMDB_API_KEY}&include_video_language=ml,en,null`;
      const res = await fetch(endpoint);
      const data = await res.json();
      const videos = data.results || [];

      const matchedVideo = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer')
                        || videos.find(v => v.site === 'YouTube' && v.type === 'Teaser')
                        || videos.find(v => v.site === 'YouTube');

      if (matchedVideo && matchedVideo.key) {
        iframe.src = `https://www.youtube.com/embed/${matchedVideo.key}?autoplay=1`;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
      } else {
        const ytQuery = encodeURIComponent(`${movieTitle} official trailer`);
        window.open(`https://www.youtube.com/results?search_query=${ytQuery}`, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Error fetching trailer:', err);
      const ytQuery = encodeURIComponent(`${movieTitle} official trailer`);
      window.open(`https://www.youtube.com/results?search_query=${ytQuery}`, '_blank', 'noopener,noreferrer');
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

  function updateSchemaOrg(movies) {
    const script = document.querySelector('script[type="application/ld+json"]');
    if (!script) return;

    const schemaData = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Upcoming & Current OTT Releases",
      "itemListElement": movies.map((m, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "Movie",
          "name": m.title,
          "datePublished": m.ottDate || m.release_date,
          "image": m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : undefined
        }
      }))
    };

    script.textContent = JSON.stringify(schemaData);
  }

  if (languageSelect) languageSelect.addEventListener('change', loadMovies);
  if (sortSelect) sortSelect.addEventListener('change', loadMovies);

  loadMovies();
});
