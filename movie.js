document.addEventListener('DOMContentLoaded', async () => {
  // Insert your TMDB API Key
  const TMDB_API_KEY = '952e7b20d619d3157e526949b222a49d';
  const IMAGE_BASE = 'https://image.tmdb.org/t/p/w780';
  const LOGO_BASE = 'https://image.tmdb.org/t/p/w92';
  const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

  const container = document.getElementById('detail-container');
  const urlParams = new URLSearchParams(window.location.search);
  const movieId = urlParams.get('id');

  if (!movieId) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <h2>Movie Not Found</h2>
        <p style="color: var(--text-secondary); margin: 1rem 0;">No movie ID was specified in the link.</p>
        <a href="index.html" class="btn-trailer" style="text-decoration:none; display:inline-block;">Return Home</a>
      </div>
    `;
    return;
  }

  try {
    // Single call fetching details, cast, digital release dates, watch providers, and trailers
    const endpoint = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=release_dates,watch/providers,credits,videos&include_video_language=ml,ta,hi,en,null`;
    const res = await fetch(endpoint);

    if (!res.ok) throw new Error(`Movie not found (${res.status})`);
    const data = await res.json();

    // 1. Update Head metadata dynamically for browser tabs and social sharing
    document.title = `${data.title} OTT Release Date, Trailer & Streaming Platform | OTTRadar`;
    const metaDesc = document.getElementById('meta-desc');
    if (metaDesc) metaDesc.setAttribute('content', `Streaming details, trailer, and OTT release date for ${data.title}. ${data.overview ? data.overview.slice(0, 120) : ''}`);

    // 2. Parse Digital / OTT Premiere Date
    let ottDate = null;
    const countryReleases = data.release_dates ? data.release_dates.results : [];
    const targetedRegion = countryReleases.find(c => c.iso_3166_1 === 'IN') || countryReleases[0];
    if (targetedRegion && targetedRegion.release_dates) {
      const digitalEntry = targetedRegion.release_dates.find(r => r.type === 4);
      if (digitalEntry && digitalEntry.release_date) {
        ottDate = digitalEntry.release_date.split('T')[0];
      }
    }

    // 3. Parse Streaming Provider and Watch Link
    let platform = null;
    let platformLogo = null;
    let streamUrl = null;
    const providers = data['watch/providers'] ? data['watch/providers'].results : null;
    const watchRegion = providers && (providers.IN || providers.US);
    if (watchRegion) {
      streamUrl = watchRegion.link;
      if (watchRegion.flatrate && watchRegion.flatrate.length > 0) {
        platform = watchRegion.flatrate[0].provider_name;
        platformLogo = watchRegion.flatrate[0].logo_path ? `${LOGO_BASE}${watchRegion.flatrate[0].logo_path}` : null;
      }
    }

    // 4. Find YouTube Trailer Key
    const videos = data.videos ? data.videos.results : [];
    const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer')
                 || videos.find(v => v.site === 'YouTube' && v.type === 'Teaser')
                 || videos.find(v => v.site === 'YouTube');

    // 5. Build Top Cast List (up to 5 actors)
    const castList = (data.credits && data.credits.cast)
      ? data.credits.cast.slice(0, 5).map(c => c.name).join(', ')
      : 'N/A';

    // 6. Format Dates and Badges
    const today = new Date().toISOString().split('T')[0];
    let ottBadgeStatus = 'tba';
    let ottDisplayText = 'Expected Soon';

    if (ottDate) {
      if (ottDate <= today) {
        ottBadgeStatus = 'live';
        ottDisplayText = `Now Streaming (${ottDate})`;
      } else {
        ottBadgeStatus = 'upcoming';
        ottDisplayText = `Premieres on ${ottDate}`;
      }
    } else if (platform) {
      ottBadgeStatus = 'live';
      ottDisplayText = `Now Streaming on ${platform}`;
    }

    const posterUrl = data.poster_path ? `${IMAGE_BASE}${data.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster';
    const backdropUrl = data.backdrop_path ? `${BACKDROP_BASE}${data.backdrop_path}` : '';
    const genres = (data.genres || []).map(g => g.name).join(' &bull; ');
    const runtime = data.runtime ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m` : 'N/A';

    // Render detailed layout
    container.innerHTML = `
      ${backdropUrl ? `<div class="movie-backdrop" style="background-image: linear-gradient(180deg, rgba(10,12,16,0.2) 0%, #0a0c10 100%), url('${backdropUrl}');"></div>` : ''}

      <div class="detail-header">
        <div class="detail-poster">
          <img src="${posterUrl}" alt="${data.title} poster">
        </div>

        <div class="detail-info">
          <h1>${data.title}</h1>
          <div class="detail-meta">
            <span>⭐ ${data.vote_average ? data.vote_average.toFixed(1) : 'N/A'}/10</span>
            <span>&bull;</span>
            <span>${runtime}</span>
            <span>&bull;</span>
            <span>${(data.original_language || '').toUpperCase()}</span>
          </div>

          <p class="detail-genres">${genres}</p>

          <div class="ott-callout-box">
            <div class="ott-status-line">
              <span class="label-muted">OTT Digital Status:</span>
              <strong class="val-ott ${ottBadgeStatus}">${ottDisplayText}</strong>
            </div>

            ${platform ? `
              <div class="platform-indicator">
                ${platformLogo ? `<img src="${platformLogo}" alt="${platform}">` : ''}
                <span>Official Partner: <strong>${platform}</strong></span>
              </div>
            ` : ''}

            ${streamUrl ? `
              <a href="${streamUrl}" target="_blank" rel="noopener noreferrer" class="btn-stream">
                Stream on ${platform || 'Platform'} &rarr;
              </a>
            ` : ''}
          </div>

          <div class="meta-field">
            <strong>Theatrical Premiere:</strong> <span>${data.release_date || 'N/A'}</span>
          </div>
          <div class="meta-field">
            <strong>Starring:</strong> <span>${castList}</span>
          </div>
        </div>
      </div>

      <!-- Synopsis Section -->
      <section class="detail-section">
        <h2>Storyline</h2>
        <p class="overview-text">${data.overview || 'No synopsis provided for this release.'}</p>
      </section>

      <!-- Embedded Trailer Player Section -->
      <section class="detail-section">
        <h2>Official Trailer</h2>
        ${trailer ? `
          <div class="video-responsive">
            <iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen title="${data.title} Official Trailer"></iframe>
          </div>
        ` : `
          <div class="trailer-fallback">
            <p>Direct video player is not embedded for this title.</p>
            <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(data.title + ' official trailer')}" target="_blank" rel="noopener noreferrer" class="btn-trailer" style="display:inline-block; text-decoration:none; margin-top:0.75rem;">
              Search Trailer on YouTube &rarr;
            </a>
          </div>
        `}
      </section>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: #ef4444;">
        <h2>Failed to load movie</h2>
        <p>Could not load the details. Verify your TMDB API Key.</p>
        <a href="index.html" class="btn-trailer" style="display:inline-block; text-decoration:none; margin-top:1rem;">Back to Home</a>
      </div>
    `;
  }
});
