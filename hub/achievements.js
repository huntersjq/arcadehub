/**
 * Arcade Hub — Achievement System
 * Cross-game achievements tracked via localStorage.
 */

import { gameRegistry, getGameStats, getAggregateStats, getGlobalCoins } from "./data.js";

const ACH_KEY = "arcade_hub_achievements";

// ── Achievement Definitions ──

export const achievementDefs = [
  // Global achievements
  { id: "first-play", name: "First Steps", desc: "Play any game for the first time", icon: "\u{1F476}", check: (s) => s.totalPlays >= 1 },
  { id: "explorer", name: "Explorer", desc: "Try all 6 games", icon: "\u{1F30D}", check: (s) => s.gamesPlayed >= 6 },
  { id: "coin-100", name: "Penny Pincher", desc: "Earn 100 Arcade Coins", icon: "\u{1FA99}", check: (s) => s.coins >= 100 },
  { id: "coin-1000", name: "Big Spender", desc: "Earn 1,000 Arcade Coins", icon: "\u{1F4B0}", check: (s) => s.coins >= 1000 },
  { id: "plays-10", name: "Regular", desc: "Play 10 total sessions", icon: "\u{1F3AE}", check: (s) => s.totalPlays >= 10 },
  { id: "plays-50", name: "Dedicated", desc: "Play 50 total sessions", icon: "\u{1F525}", check: (s) => s.totalPlays >= 50 },
  { id: "master-3", name: "Multi-Talented", desc: "Score in 3 different games", icon: "\u{1F3C6}", check: (s) => s.gamesMastered >= 3 },
  { id: "master-all", name: "Grand Master", desc: "Score in all 6 games", icon: "\u{1F451}", check: (s) => s.gamesMastered >= 6 },

  // Per-game achievements (Cosmic Merge)
  { id: "cm-play", name: "Stargazer", desc: "Play Cosmic Merge", icon: "\u{1F31F}", gameId: "cosmic-merge", check: (s, gs) => gs.timesPlayed >= 1 },
  { id: "cm-score", name: "Planetsmith", desc: "Score 500+ in Cosmic Merge", icon: "\u{1FA90}", gameId: "cosmic-merge", check: (s, gs) => gs.bestScore >= 500 },

  // Per-game achievements (Neon Survivor)
  { id: "ns-play", name: "Into the Swarm", desc: "Play Neon Survivor", icon: "\u{2694}\uFE0F", gameId: "neon-survivor", check: (s, gs) => gs.timesPlayed >= 1 },
  { id: "ns-score", name: "Swarm Slayer", desc: "Score 1,000+ in Neon Survivor", icon: "\u{1F4A5}", gameId: "neon-survivor", check: (s, gs) => gs.bestScore >= 1000 },

  // Per-game achievements (Neon Dash)
  { id: "nd-play", name: "Speed Demon", desc: "Play Neon Dash", icon: "\u{1F3CE}\uFE0F", gameId: "neon-dash", check: (s, gs) => gs.timesPlayed >= 1 },

  // Per-game achievements (Stellar Match)
  { id: "sm-play", name: "Tile Master", desc: "Play Stellar Match", icon: "\u{1F9E9}", gameId: "stellar-match", check: (s, gs) => gs.timesPlayed >= 1 },

  // Per-game achievements (Nebula Refinery)
  { id: "nr-play", name: "Miner", desc: "Play Nebula Refinery", icon: "\u{26CF}\uFE0F", gameId: "nebula-refinery", check: (s, gs) => gs.timesPlayed >= 1 },
  { id: "nr-dust", name: "Dust Baron", desc: "Collect 10,000 stardust", icon: "\u{2728}", gameId: "nebula-refinery", check: (s, gs) => gs.bestScore >= 10000 },

  // Per-game achievements (Vox Runner)
  { id: "vr-play", name: "Block Runner", desc: "Play Vox Runner", icon: "\u{1F4E6}", gameId: "vox-runner", check: (s, gs) => gs.timesPlayed >= 1 },
];

// ── Storage ──

function getUnlocked() {
  try {
    const raw = localStorage.getItem(ACH_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUnlocked(data) {
  localStorage.setItem(ACH_KEY, JSON.stringify(data));
}

// ── Core API ──

/**
 * Check all achievements and unlock any newly earned ones.
 * Returns an array of newly unlocked achievement defs.
 */
export function checkAchievements() {
  const unlocked = getUnlocked();
  const stats = getAggregateStats();
  const newlyUnlocked = [];

  for (const ach of achievementDefs) {
    if (unlocked[ach.id]) continue;

    let earned = false;
    if (ach.gameId) {
      const game = gameRegistry.find((g) => g.id === ach.gameId);
      if (game) {
        const gs = getGameStats(game);
        earned = ach.check(stats, gs);
      }
    } else {
      earned = ach.check(stats);
    }

    if (earned) {
      unlocked[ach.id] = Date.now();
      newlyUnlocked.push(ach);
    }
  }

  if (newlyUnlocked.length > 0) {
    saveUnlocked(unlocked);
  }

  return newlyUnlocked;
}

/**
 * Get all achievements with their unlock status.
 */
export function getAllAchievements() {
  const unlocked = getUnlocked();
  return achievementDefs.map((ach) => ({
    ...ach,
    unlockedAt: unlocked[ach.id] || null,
    isUnlocked: !!unlocked[ach.id],
  }));
}

/**
 * Get unlock counts.
 */
export function getAchievementProgress() {
  const unlocked = getUnlocked();
  const total = achievementDefs.length;
  const earned = Object.keys(unlocked).length;
  return { earned, total };
}

// ── Achievement Toast Notification ──

let toastQueue = [];
let toastShowing = false;

function showNextToast() {
  if (toastQueue.length === 0) {
    toastShowing = false;
    return;
  }

  toastShowing = true;
  const ach = toastQueue.shift();

  const toast = document.createElement("div");
  toast.className = "ach-toast";

  const icon = document.createElement("span");
  icon.className = "ach-toast-icon";
  icon.textContent = ach.icon;
  toast.appendChild(icon);

  const info = document.createElement("div");
  info.className = "ach-toast-info";

  const label = document.createElement("span");
  label.className = "ach-toast-label";
  label.textContent = "Achievement Unlocked!";
  info.appendChild(label);

  const name = document.createElement("span");
  name.className = "ach-toast-name";
  name.textContent = ach.name;
  info.appendChild(name);

  toast.appendChild(info);
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add("show"));

  // Remove after 3s
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => {
      toast.remove();
      showNextToast();
    }, { once: true });
    // Fallback removal
    setTimeout(() => { toast.remove(); showNextToast(); }, 400);
  }, 3000);
}

/**
 * Show toast notifications for newly unlocked achievements.
 */
export function notifyAchievements(newlyUnlocked) {
  for (const ach of newlyUnlocked) {
    toastQueue.push(ach);
  }
  if (!toastShowing) showNextToast();
}

// ── Achievement Panel ──

/**
 * Render the achievements panel into a container element.
 */
export function renderAchievementPanel(container) {
  container.textContent = "";

  const header = document.createElement("div");
  header.className = "ach-panel-header";

  const title = document.createElement("h2");
  title.textContent = "Achievements";
  header.appendChild(title);

  const progress = getAchievementProgress();
  const counter = document.createElement("span");
  counter.className = "ach-counter";
  counter.textContent = `${progress.earned} / ${progress.total}`;
  header.appendChild(counter);

  container.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "ach-grid";

  const allAch = getAllAchievements();
  // Show unlocked first, then locked
  const sorted = [...allAch].sort((a, b) => {
    if (a.isUnlocked && !b.isUnlocked) return -1;
    if (!a.isUnlocked && b.isUnlocked) return 1;
    return 0;
  });

  for (const ach of sorted) {
    const card = document.createElement("div");
    card.className = "ach-card" + (ach.isUnlocked ? " unlocked" : " locked");

    const achIcon = document.createElement("span");
    achIcon.className = "ach-icon";
    achIcon.textContent = ach.isUnlocked ? ach.icon : "\u{1F512}";
    card.appendChild(achIcon);

    const achInfo = document.createElement("div");
    achInfo.className = "ach-info";

    const achName = document.createElement("span");
    achName.className = "ach-name";
    achName.textContent = ach.name;
    achInfo.appendChild(achName);

    const achDesc = document.createElement("span");
    achDesc.className = "ach-desc";
    achDesc.textContent = ach.desc;
    achInfo.appendChild(achDesc);

    card.appendChild(achInfo);
    grid.appendChild(card);
  }

  container.appendChild(grid);
}
