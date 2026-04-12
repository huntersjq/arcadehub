/**
 * Arcade Hub — Player Profile Panel
 * Shows player stats, favorite game, achievement progress.
 */

import {
  getAggregateStats,
  getRecentlyPlayed,
  gameRegistry,
  getGameStats,
} from "./data.js";
import { getAchievementProgress } from "./achievements.js";

let panelEl = null;

function createPanel() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "profileOverlay";

  const panel = document.createElement("div");
  panel.className = "modal-panel";

  // Header
  const header = document.createElement("div");
  header.className = "modal-header";

  const title = document.createElement("h2");
  title.textContent = "Player Profile";
  header.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.textContent = "\u00D7";
  closeBtn.setAttribute("aria-label", "Close profile");
  closeBtn.addEventListener("click", closeProfile);
  header.appendChild(closeBtn);

  panel.appendChild(header);

  // Profile content (populated dynamically)
  const content = document.createElement("div");
  content.className = "profile-content";
  content.id = "profileContent";
  panel.appendChild(content);

  overlay.appendChild(panel);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeProfile();
  });

  return overlay;
}

function renderProfileContent() {
  const container = document.getElementById("profileContent");
  if (!container) return;
  container.textContent = "";

  const stats = getAggregateStats();
  const achProgress = getAchievementProgress();
  const recent = getRecentlyPlayed();

  // Avatar area
  const avatar = document.createElement("div");
  avatar.className = "profile-avatar";
  avatar.textContent = "\u{1F3AE}";
  container.appendChild(avatar);

  // Rank title
  const rank = document.createElement("div");
  rank.className = "profile-rank";
  rank.textContent = getRankTitle(stats.totalPlays, achProgress.earned);
  container.appendChild(rank);

  // Stats grid
  const statsGrid = document.createElement("div");
  statsGrid.className = "profile-stats";

  const statItems = [
    { label: "Total Plays", value: stats.totalPlays.toLocaleString() },
    { label: "Play Time", value: formatPlayTime() },
    { label: "Games Tried", value: `${stats.gamesPlayed} / ${stats.totalGames}` },
    { label: "Coins Earned", value: stats.coins.toLocaleString() },
    { label: "Achievements", value: `${achProgress.earned} / ${achProgress.total}` },
    { label: "Member Since", value: getMemberSince(recent) },
  ];

  for (const item of statItems) {
    const el = document.createElement("div");
    el.className = "profile-stat";

    const val = document.createElement("span");
    val.className = "profile-stat-value";
    val.textContent = item.value;
    el.appendChild(val);

    const label = document.createElement("span");
    label.className = "profile-stat-label";
    label.textContent = item.label;
    el.appendChild(label);

    statsGrid.appendChild(el);
  }

  container.appendChild(statsGrid);

  // Leaderboard section
  renderLeaderboard(container);
}

function formatPlayTime() {
  let data = {};
  try {
    data = JSON.parse(localStorage.getItem("arcade_hub_playtime") || "{}");
  } catch (_) {
    return "0m";
  }
  let total = 0;
  for (const s of Object.values(data)) total += s;
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

function renderLeaderboard(container) {
  const heading = document.createElement("h3");
  heading.className = "profile-lb-heading";
  heading.textContent = "Leaderboard";
  container.appendChild(heading);

  const entries = gameRegistry
    .map((game) => {
      const s = getGameStats(game);
      return { name: game.name, accent: game.accentColor, score: s.bestScore };
    })
    .filter((e) => e.score != null && e.score > 0)
    .sort((a, b) => b.score - a.score);

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "profile-lb-empty";
    empty.textContent = "Play some games to see your scores here!";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "profile-lb-list";

  for (let i = 0; i < entries.length; i++) {
    const row = document.createElement("div");
    row.className = "profile-lb-row";

    const rank = document.createElement("span");
    rank.className = "profile-lb-rank";
    rank.textContent = i === 0 ? "\u{1F947}" : i === 1 ? "\u{1F948}" : i === 2 ? "\u{1F949}" : `#${i + 1}`;
    row.appendChild(rank);

    const name = document.createElement("span");
    name.className = "profile-lb-name";
    name.textContent = entries[i].name;
    name.style.color = entries[i].accent;
    row.appendChild(name);

    const score = document.createElement("span");
    score.className = "profile-lb-score";
    score.textContent = typeof entries[i].score === "number"
      ? entries[i].score.toLocaleString()
      : String(entries[i].score);
    row.appendChild(score);

    list.appendChild(row);
  }

  container.appendChild(list);
}

function getRankTitle(plays, achievements) {
  if (achievements >= 15) return "\u{1F451} Grand Master";
  if (achievements >= 10) return "\u{1F31F} Expert";
  if (plays >= 50) return "\u{1F525} Veteran";
  if (plays >= 20) return "\u{2B50} Skilled";
  if (plays >= 10) return "\u{1F3AE} Regular";
  if (plays >= 1) return "\u{1F331} Newcomer";
  return "\u{1F47B} Unknown";
}

function getMemberSince(recent) {
  if (recent.length === 0) return "Just now";
  const oldest = recent.reduce(
    (min, r) => (r.timestamp < min ? r.timestamp : min),
    recent[0].timestamp
  );
  const date = new Date(oldest);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function openProfile() {
  if (!panelEl) {
    panelEl = createPanel();
    document.body.appendChild(panelEl);
  }
  renderProfileContent();
  // Short delay ensures the browser has rendered the element before animating
  setTimeout(() => panelEl.classList.add("open"), 20);
}

export function closeProfile() {
  if (panelEl) {
    panelEl.classList.remove("open");
  }
}

export function setupProfile() {
  const btn = document.getElementById("profileBtn");
  if (btn) {
    btn.addEventListener("click", openProfile);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panelEl && panelEl.classList.contains("open")) {
      closeProfile();
    }
  });
}
