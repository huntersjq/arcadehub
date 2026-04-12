/**
 * Arcade Hub — Game Integration
 * Lightweight utility for games to interact with the hub's data layer.
 * Games include this script to earn coins, record plays, and track time.
 */

(function () {
  const COINS_KEY = "arcade_coins";
  const RECENT_KEY = "arcade_hub_recent";
  const PLAY_COUNT_KEY = "arcade_hub_play_counts";
  const MAX_RECENT = 20;

  /** Detect the current game ID from the URL path. */
  function detectGameId() {
    const slugMap = {
      "physics-merger": "cosmic-merge",
      "bullet-heaven": "neon-survivor",
      "neon-dash": "neon-dash",
      "tile-match": "stellar-match",
      "idle-clicker": "nebula-refinery",
      "vox-runner": "vox-runner",
      "word-scramble": "stellar-speller",
      "rhythm-tap": "pulse-beat",
      "tower-defense": "stellar-siege",
    };
    const path = window.location.pathname;
    for (const [slug, id] of Object.entries(slugMap)) {
      if (path.includes(slug)) return id;
    }
    return null;
  }

  /** Add coins to the global arcade coin balance. */
  function addCoins(amount) {
    if (amount <= 0) return;
    const current = parseInt(localStorage.getItem(COINS_KEY) || "0", 10);
    localStorage.setItem(COINS_KEY, String(current + Math.floor(amount)));
  }

  /** Record that this game was played (for hub's recently-played section). */
  function recordPlay(gameId) {
    const id = gameId || detectGameId();
    if (!id) return;
    let recent = [];
    try {
      recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch (_) {
      recent = [];
    }
    recent = recent.filter((r) => r.id !== id);
    recent.unshift({ id, timestamp: Date.now() });
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT))
    );
    // Increment cumulative play counter
    let counts = {};
    try {
      counts = JSON.parse(localStorage.getItem(PLAY_COUNT_KEY) || "{}");
    } catch (_) {
      counts = {};
    }
    counts[id] = (counts[id] || 0) + 1;
    localStorage.setItem(PLAY_COUNT_KEY, JSON.stringify(counts));
  }

  /** Track time played — call on game start, returns a stop function. */
  function startTimeTracking(gameId) {
    const id = gameId || detectGameId();
    const startTime = Date.now();
    const KEY = "arcade_hub_playtime";

    function save() {
      if (!id) return;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed < 1) return;
      let data = {};
      try {
        data = JSON.parse(localStorage.getItem(KEY) || "{}");
      } catch (_) {
        data = {};
      }
      data[id] = (data[id] || 0) + elapsed;
      localStorage.setItem(KEY, JSON.stringify(data));
    }

    window.addEventListener("beforeunload", save);
    return save;
  }

  // Auto-record play on page load
  const gameId = detectGameId();
  if (gameId) {
    recordPlay(gameId);
  }

  // Start time tracking automatically
  const stopTracking = startTimeTracking(gameId);

  // Expose API globally for games to call
  window.ArcadeHub = {
    addCoins,
    recordPlay,
    startTimeTracking,
    getGameId: detectGameId,
  };
})();
