import os
import requests

TMDB_API_KEY = os.environ.get("TMDB_API_KEY")
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")
WEBSITE_URL = os.environ.get("WEBSITE_URL", "https://amaldominic816.github.io/ottrelease/")
WEBSITE_URL = RAW_WEBSITE_URL.rstrip('/') + '/'
HISTORY_FILE = "posted_ids.txt"



def get_posted_ids():
    if not os.path.exists(HISTORY_FILE):
        return set()
    with open(HISTORY_FILE, "r", encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())

def save_posted_id(movie_id):
    with open(HISTORY_FILE, "a", encoding="utf-8") as f:
        f.write(f"{movie_id}\n")

def fetch_candidates():
    # Query popular and recent Malayalam releases from TMDB
    url = (
        f"https://api.themoviedb.org/3/discover/movie"
        f"?api_key={TMDB_API_KEY}&with_original_language=ml"
        f"&sort_by=popularity.desc&page=1"
    )
    res = requests.get(url).json()
    return res.get("results", [])[:15]

def get_movie_details(movie_id):
    url = (
        f"https://api.themoviedb.org/3/movie/{movie_id}"
        f"?api_key={TMDB_API_KEY}&append_to_response=release_dates,watch/providers"
    )
    return requests.get(url).json()

def send_telegram_post(movie, ott_date, platform):
    movie_id = movie.get("id")
    poster_path = movie.get("poster_path")
    poster_url = f"https://image.tmdb.org/t/p/w780{poster_path}" if poster_path else None
    title = movie.get("title", "Untitled")
    rating = movie.get("vote_average", 0)

    # Direct link to the dedicated movie detail page
    movie_detail_url = f"{WEBSITE_URL}movie.html?id={movie_id}"

    caption = (
        f"🎬 <b>{title}</b>\n"
        f"⭐ Rating: {rating:.1f}/10\n"
        f"📺 Platform: <b>{platform}</b>\n"
        f"📅 OTT Status: <b>{ott_date}</b>\n\n"
        f"🔗 <a href='{movie_detail_url}'>View Details, Cast & Watch Trailer</a>\n"
        f"🌐 <a href='{WEBSITE_URL}'>Browse All OTT Releases</a>"
    )

    telegram_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    payload = {
        "chat_id": CHAT_ID,
        "photo": poster_url,
        "caption": caption,
        "parse_mode": "HTML"
    }

    try:
        response = requests.post(telegram_url, data=payload)
        res_data = response.json()
        if not res_data.get("ok"):
            print(f"Telegram API Error for '{title}': {res_data.get('description')}")
            return False
        return True
    except Exception as e:
        print(f"Network error sending '{title}' to Telegram: {e}")
        return False

def main():
    if not TMDB_API_KEY or not BOT_TOKEN or not CHAT_ID:
        print("Error: Missing required environment variables (TMDB_API_KEY, TELEGRAM_BOT_TOKEN, or TELEGRAM_CHAT_ID).")
        return

    posted_ids = get_posted_ids()
    candidates = fetch_candidates()
    print(f"Fetched {len(candidates)} movie candidates from TMDB.")

    posted_count = 0

    for movie in candidates:
        movie_id = str(movie["id"])
        title = movie.get("title", "Untitled")

        if movie_id in posted_ids:
            print(f"Skipping (already posted): {title}")
            continue

        details = get_movie_details(movie_id)

        # 1. Look for Digital/OTT release date (Type 4)
        ott_date = None
        release_countries = details.get("release_dates", {}).get("results", [])
        india_release = next((c for c in release_countries if c.get("iso_3166_1") == "IN"), None) or (release_countries[0] if release_countries else None)

        if india_release:
            digital_entry = next((r for r in india_release.get("release_dates", []) if r.get("type") == 4), None)
            if digital_entry and digital_entry.get("release_date"):
                ott_date = digital_entry["release_date"].split("T")[0]

        # 2. Check for active streaming provider (India or Global)
        providers_data = details.get("watch/providers", {}).get("results", {})
        providers = providers_data.get("IN") or providers_data.get("US") or {}
        flatrate = providers.get("flatrate", [])
        platform = flatrate[0]["provider_name"] if flatrate else None

        print(f"Inspecting: {title} | OTT Date: {ott_date} | Platform: {platform}")

        # Post if either an OTT date or streaming platform is found
        if ott_date or platform:
            display_date = ott_date if ott_date else "Now Streaming"
            display_platform = platform if platform else "Announcing Soon"

            print(f"-> Broadcasting to Telegram: {title} ({display_platform})")
            success = send_telegram_post(movie, display_date, display_platform)
            if success:
                save_posted_id(movie_id)
                posted_ids.add(movie_id)
                posted_count += 1
                # Limit to 2 posts per automatic run to prevent channel rate-limiting
                if posted_count >= 2:
                    break

    if posted_count == 0:
        print("No new confirmed OTT titles met posting criteria in this execution.")

if __name__ == "__main__":
    main()
