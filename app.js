document.addEventListener('DOMContentLoaded', () => {
  // Replace with your personal TMDB API Read Key (v3)
  const TMDB_API_KEY = '952e7b20d619d3157e526949b222a49d';
  const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

  const grid = document.getElementById('movie-grid');
  const languageSelect = document.getElementById('language-filter');
  const sortSelect = document.getElementById('sort-filter');
  const modal = document.getElementById('trailer-modal');
  const modalClose = document.getElementById('modal-close');
  const modalOverlay = document.getElementById('modal-overlay');
  const iframe = document.getElementById('trailer-iframe');

  let currentMovies = [];

  async function loadMovies() {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">Loading upcoming & recent OTT releases...</p>';

    const lang = languageSelect.value;
    const sort = sortSelect.value;

    // TMDB discover endpoint filtered by original language
    const endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=${lang}&sort_by=${sort}&page=1`;

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('API communication error');
      const data = await res.json();
      currentMovies = data.results.slice(0, 12);

      renderCards(currentMovies);
      updateSchemaOrg(currentMovies);
    } catch (err) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444;">Unable to load movies. Verify your TMDB API Key.</p>';
      console.error(err);
    }
  }

  function renderCards(movies) {
    grid.innerHTML = '';

    movies.forEach(movie => {
      const poster = movie.poster_path
        ? `${IMAGE_BASE}${movie.poster_path}`
        : 'https://via.placeholder.com/500x750?text=No+Poster';

      const releaseDate = movie.release_date || 'Date Pending';

      const card = document.createElement('article');
      card.className = 'card';
      card.setAttribute('itemscope', '');
      card.setAttribute('itemtype', 'https://schema.org/Movie');

      card.innerHTML = `
        <div class="poster-container">
          <img src="${poster}" alt="${movie.title} official poster" loading="lazy" itemprop="image">
          <span class="badge-ott">OTT Premiering</span>
        </div>
        <div class="card-body">
          <h2 class="movie-title" itemprop="name">${movie.title}</h2>
          <div class="meta-info">Score: ${movie.vote_average.toFixed(1)}/10 &bull; Language: ${movie.original_language.toUpperCase()}</div>
          <div class="release-badge">
            📅 <span itemprop="datePublished">${releaseDate}</span>
          </div>
          <button class="btn-trailer" data-movie-id="${movie.id}" aria-label="Watch trailer for ${movie.title}">
            ▶ Watch Trailer
          </button>
        </div>
      `;

      grid.appendChild(card);
    });

    // Attach listeners to trailer buttons
    document.querySelectorAll('.btn-trailer').forEach(btn => {
      btn.addEventListener('click', () => {
        const movieId = btn.getAttribute('data-movie-id');
        openTrailer(movieId);
      });
    });
  }

  // Fetch YouTube trailer key via TMDB Movie Videos Endpoint
  async function openTrailer(movieId) {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${TMDB_API_KEY}`);
      const data = await res.json();

      // Find official trailer or teaser hosted on YouTube
      const trailer = data.results.find(vid => vid.site === 'YouTube' && (vid.type === 'Trailer' || vid.type === 'Teaser'));

      if (trailer && trailer.key) {
        iframe.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1`;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
      } else {
        alert('Official trailer video is not currently available for this title.');
      }
    } catch (err) {
      console.error('Error fetching trailer:', err);
    }
  }

  function closeModal() {
    iframe.src = '';
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', closeModal);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });

  // Updates Schema.org JSON-LD dynamically for search engine bots
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
          "datePublished": m.release_date,
          "image": m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : undefined
        }
      }))
    };

    script.textContent = JSON.stringify(schemaData);
  }

  languageSelect.addEventListener('change', loadMovies);
  sortSelect.addEventListener('change', loadMovies);

  loadMovies();
});
