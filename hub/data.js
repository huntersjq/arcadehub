/**
 * Arcade Hub — Game Registry & User Data API
 * Centralizes game metadata and localStorage access.
 */

export const CATEGORIES = {
  action: { label: "Action", color: "#ef4444" },
  puzzle: { label: "Puzzle", color: "#3b82f6" },
  survival: { label: "Survival", color: "#f59e0b" },
  idle: { label: "Idle", color: "#10b981" },
};

export const gameRegistry = [
  {
    id: "cosmic-merge",
    slug: "physics-merger",
    name: "Cosmic Merge",
    tagline: "Physics-based celestial merging. Reach the sun!",
    category: "puzzle",
    accentColor: "#6366f1",
    path: "games/physics-merger/",
    statsKeys: { highScores: "cm_highscores", stars: "cm_stars" },
  },
  {
    id: "neon-survivor",
    slug: "bullet-heaven",
    name: "Neon Survivor",
    tagline: "Endless bullet-hell survival against the swarm.",
    category: "survival",
    accentColor: "#ef4444",
    path: "games/bullet-heaven/",
    statsKeys: { records: "neon_survivor_records" },
  },
  {
    id: "neon-dash",
    slug: "neon-dash",
    name: "Neon Dash",
    tagline: "Procedural high-speed infinite runner. Stay in the flow!",
    category: "action",
    accentColor: "#00f2ff",
    path: "games/neon-dash/",
    statsKeys: { highScores: "neon_dash_highscores" },
  },
  {
    id: "stellar-match",
    slug: "tile-match",
    name: "Stellar Match",
    tagline: "2048-style puzzle meets cosmic RPG. Merge to attack!",
    category: "puzzle",
    accentColor: "#a855f7",
    path: "games/tile-match/",
    statsKeys: { highScores: "stellar_match_highscores" },
  },
  {
    id: "nebula-refinery",
    slug: "idle-clicker",
    name: "Nebula Refinery",
    tagline: "Harvest stardust and build a cosmic empire.",
    category: "idle",
    accentColor: "#fbbf24",
    path: "games/idle-clicker/",
    statsKeys: { save: "nebula_refinery_save" },
  },
  {
    id: "vox-runner",
    slug: "vox-runner",
    name: "Vox Runner",
    tagline: "Infinite runner in a voxel-style pseudo-3D world.",
    category: "action",
    accentColor: "#ec4899",
    path: "games/vox-runner/",
    statsKeys: { highScores: "vox_runner_highscores" },
  },
  {
    id: "stellar-speller",
    slug: "word-scramble",
    name: "Stellar Speller",
    tagline: "Unscramble cosmic words against the clock. Build streaks!",
    category: "puzzle",
    accentColor: "#8b5cf6",
    path: "games/word-scramble/",
    statsKeys: { highScores: "word_scramble_highscores" },
  },
  {
    id: "pulse-beat",
    slug: "rhythm-tap",
    name: "Pulse Beat",
    tagline: "Rhythm-action with procedural beats. Tap to the pulse!",
    category: "action",
    accentColor: "#f43f5e",
    path: "games/rhythm-tap/",
    statsKeys: { highScores: "pulse_beat_highscores" },
  },
  {
    id: "stellar-siege",
    slug: "tower-defense",
    name: "Stellar Siege",
    tagline: "Strategic tower defense against cosmic invaders.",
    category: "action",
    accentColor: "#22d3ee",
    path: "games/tower-defense/",
    statsKeys: { highScores: "stellar_siege_highscores" },
  },
  {
    id: "texas-holdem",
    slug: "texas-holdem",
    name: "德州扑克",
    tagline: "中文版无限注德州扑克 · 支持 AI 与跨设备联机",
    category: "puzzle",
    accentColor: "#f5c518",
    path: "games/texas-holdem/",
    statsKeys: { highScores: "holdem_highscores" },
  },
];

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Recently Played ──

const RECENT_KEY = "arcade_hub_recent";
const MAX_RECENT = 20;

export function getRecentlyPlayed() {
  return readJSON(RECENT_KEY, []);
}

const PLAY_COUNT_KEY = "arcade_hub_play_counts";

export function recordPlay(gameId) {
  const recent = getRecentlyPlayed().filter((r) => r.id !== gameId);
  recent.unshift({ id: gameId, timestamp: Date.now() });
  writeJSON(RECENT_KEY, recent.slice(0, MAX_RECENT));
  // Increment cumulative play counter
  const counts = readJSON(PLAY_COUNT_KEY, {});
  counts[gameId] = (counts[gameId] || 0) + 1;
  writeJSON(PLAY_COUNT_KEY, counts);
}

export function getPlayCounts() {
  return readJSON(PLAY_COUNT_KEY, {});
}

// ── Favorites ──

const FAV_KEY = "arcade_hub_favorites";

export function getFavorites() {
  return readJSON(FAV_KEY, []);
}

export function toggleFavorite(gameId) {
  const favs = getFavorites();
  const idx = favs.indexOf(gameId);
  if (idx === -1) {
    favs.push(gameId);
  } else {
    favs.splice(idx, 1);
  }
  writeJSON(FAV_KEY, favs);
  return idx === -1; // returns true if now favorited
}

export function isFavorite(gameId) {
  return getFavorites().includes(gameId);
}

// ── Global Coins ──

export function getGlobalCoins() {
  return parseInt(localStorage.getItem("arcade_coins") || "0", 10);
}

// ── Per-Game Stats ──

export function getGameStats(game) {
  const stats = { bestScore: null, timesPlayed: 0, lastPlayed: null };
  const keys = game.statsKeys;

  if (keys.highScores) {
    const scores = readJSON(keys.highScores, []);
    if (scores.length > 0) {
      const best = typeof scores[0] === "object" ? scores[0].score : scores[0];
      stats.bestScore = best;
    }
  }

  if (keys.records) {
    const records = readJSON(keys.records, null);
    if (records && records.bestScore != null) {
      stats.bestScore = records.bestScore;
    }
  }

  if (keys.save) {
    const save = readJSON(keys.save, null);
    if (save) {
      stats.bestScore = save.stardust || save.totalStardust || null;
    }
  }

  // Play count from cumulative counter
  const counts = getPlayCounts();
  stats.timesPlayed = counts[game.id] || 0;
  // Last played from recent list
  const recentEntry = getRecentlyPlayed().find((r) => r.id === game.id);
  if (recentEntry) {
    stats.lastPlayed = recentEntry.timestamp;
  }

  return stats;
}

// ── Aggregate Stats ──

export function getAggregateStats() {
  const recent = getRecentlyPlayed();
  const counts = getPlayCounts();
  const coins = getGlobalCoins();

  // Total plays from cumulative counter
  let totalPlays = 0;
  for (const c of Object.values(counts)) totalPlays += c;

  // Count unique games played
  const uniqueGames = new Set(recent.map((r) => r.id));
  const gamesPlayed = uniqueGames.size;

  // Find most played game from cumulative counter
  let topGameId = null;
  let topCount = 0;
  for (const [id, count] of Object.entries(counts)) {
    if (count > topCount) {
      topGameId = id;
      topCount = count;
    }
  }
  const topGame = topGameId
    ? gameRegistry.find((g) => g.id === topGameId)
    : null;

  // Count games with high scores
  let gamesMastered = 0;
  for (const game of gameRegistry) {
    const s = getGameStats(game);
    if (s.bestScore != null && s.bestScore > 0) gamesMastered++;
  }

  return {
    totalPlays,
    coins,
    gamesPlayed,
    totalGames: gameRegistry.length,
    gamesMastered,
    topGame: topGame ? topGame.name : null,
  };
}

// ── Sound Preference ──

const SOUND_KEY = "arcade_hub_sound";

export function getSoundEnabled() {
  return localStorage.getItem(SOUND_KEY) !== "false";
}

export function setSoundEnabled(enabled) {
  localStorage.setItem(SOUND_KEY, String(enabled));
}
