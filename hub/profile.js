/**
 * Arcade Hub — Player Profile Panel
 * Shows player stats, favorite game, achievement progress.
 */

import { getAggregateStats, getRecentlyPlayed, gameRegistry } from "./data.js";
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
    { label: "Games Tried", value: `${stats.gamesPlayed} / ${stats.totalGames}` },
    { label: "Coins Earned", value: stats.coins.toLocaleString() },
    { label: "Achievements", value: `${achProgress.earned} / ${achProgress.total}` },
    { label: "Top Game", value: stats.topGame || "None yet" },
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
