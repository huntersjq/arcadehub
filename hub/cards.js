/**
 * Arcade Hub — Card Rendering & Event Delegation
 * Dynamically renders game cards with icons, stats, and favorites.
 *
 * Note: innerHTML usage here is safe — all content comes from the
 * hardcoded gameRegistry (hub/data.js), never from user input.
 */

import {
  gameRegistry,
  CATEGORIES,
  getRecentlyPlayed,
  getFavorites,
  isFavorite,
  toggleFavorite,
  getGameStats,
} from "./data.js";
import { startIconAnimation } from "./icons.js";

const iconCleanups = [];

function formatScore(score) {
  if (score == null) return "--";
  if (typeof score === "number") return score.toLocaleString();
  return String(score);
}

function timeAgo(ts) {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function buildCardDOM(game, stats, favorited) {
  const cat = CATEGORIES[game.category];

  const inner = document.createElement("div");
  inner.className = "card-inner";

  // Top row: category pill + favorite toggle
  const topRow = document.createElement("div");
  topRow.className = "card-top-row";

  const pill = document.createElement("span");
  pill.className = "category-pill";
  pill.style.setProperty("--pill-color", cat.color);
  pill.textContent = cat.label;
  topRow.appendChild(pill);

  const favBtn = document.createElement("button");
  favBtn.className = "fav-toggle" + (favorited ? " active" : "");
  favBtn.dataset.fav = game.id;
  favBtn.setAttribute("aria-label", "Toggle favorite");
  favBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="${favorited ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  topRow.appendChild(favBtn);

  inner.appendChild(topRow);

  // Canvas icon
  const canvas = document.createElement("canvas");
  canvas.className = "game-icon-canvas";
  canvas.dataset.game = game.id;
  inner.appendChild(canvas);

  // Name
  const h3 = document.createElement("h3");
  h3.textContent = game.name;
  inner.appendChild(h3);

  // Tagline
  const p = document.createElement("p");
  p.className = "card-tagline";
  p.textContent = game.tagline;
  inner.appendChild(p);

  // Stats ribbon
  const ribbon = document.createElement("div");
  ribbon.className = "stats-ribbon";

  const statItems = [
    { icon: "\u{1F3C6}", value: formatScore(stats.bestScore), title: "Best score" },
    { icon: "\u{1F3AE}", value: String(stats.timesPlayed), title: "Times played" },
    { icon: "\u{1F550}", value: timeAgo(stats.lastPlayed), title: "Last played" },
  ];
  for (const s of statItems) {
    const span = document.createElement("span");
    span.className = "stat";
    span.title = s.title;
    span.textContent = `${s.icon} ${s.value}`;
    ribbon.appendChild(span);
  }

  inner.appendChild(ribbon);
  return inner;
}

function createCard(game) {
  const stats = getGameStats(game);
  const favorited = isFavorite(game.id);
  const recent = getRecentlyPlayed();
  const isRecent = recent.some((r) => r.id === game.id);

  const card = document.createElement("div");
  card.className = "game-card" + (isRecent ? " recently-played" : "");
  card.dataset.gameId = game.id;
  card.dataset.category = game.category;
  card.dataset.path = game.path;
  card.style.setProperty("--accent", game.accentColor);
  card.setAttribute("role", "link");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `Play ${game.name} — ${game.tagline}`);

  card.appendChild(buildCardDOM(game, stats, favorited));
  return card;
}

function renderSection(container, games, title) {
  if (games.length === 0) return;

  const section = document.createElement("div");
  section.className = "card-section";

  const heading = document.createElement("h2");
  heading.className = "section-heading";
  heading.textContent = title;
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = title === "All Games" ? "game-grid" : "game-scroll";
  if (title === "All Games") grid.id = "allGamesGrid";

  for (const game of games) {
    grid.appendChild(createCard(game));
  }

  section.appendChild(grid);
  container.appendChild(section);
}

export function renderCards() {
  // Cleanup any running icon animations
  for (const cleanup of iconCleanups) cleanup();
  iconCleanups.length = 0;

  const container = document.getElementById("gameGrid");
  if (!container) return;
  container.textContent = "";

  // Recently Played
  const recent = getRecentlyPlayed();
  const recentIds = [...new Set(recent.map((r) => r.id))].slice(0, 4);
  const recentGames = recentIds
    .map((id) => gameRegistry.find((g) => g.id === id))
    .filter(Boolean);

  if (recentGames.length > 0) {
    renderSection(container, recentGames, "Recently Played");
  }

  // Favorites
  const favIds = getFavorites();
  const favGames = favIds
    .map((id) => gameRegistry.find((g) => g.id === id))
    .filter(Boolean);

  if (favGames.length > 0) {
    renderSection(container, favGames, "Favorites");
  } else if (recent.length > 0) {
    // Show empty state hint for favorites only if user has played before
    const hint = document.createElement("div");
    hint.className = "card-section empty-hint";

    const hintHeading = document.createElement("h2");
    hintHeading.className = "section-heading";
    hintHeading.textContent = "Favorites";
    hint.appendChild(hintHeading);

    const hintText = document.createElement("p");
    hintText.className = "empty-hint-text";
    hintText.textContent =
      "\u2B50 Click the star on any game card to add it to your favorites.";
    hint.appendChild(hintText);

    container.appendChild(hint);
  }

  // All Games
  renderSection(container, gameRegistry, "All Games");

  // Start icon animations with IntersectionObserver
  setupIconAnimations();
}

function setupIconAnimations() {
  const canvases = document.querySelectorAll(".game-icon-canvas");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const canvas = entry.target;
        if (entry.isIntersecting && !canvas._animating) {
          canvas._animating = true;
          const stop = startIconAnimation(canvas, canvas.dataset.game);
          iconCleanups.push(stop);
          canvas._stopAnim = stop;
        } else if (!entry.isIntersecting && canvas._animating) {
          canvas._animating = false;
          if (canvas._stopAnim) canvas._stopAnim();
        }
      }
    },
    { threshold: 0.1 }
  );

  for (const c of canvases) observer.observe(c);
}

export function setupCardEvents(onNavigate) {
  const container = document.getElementById("gameGrid");
  if (!container) return;

  container.addEventListener("click", (e) => {
    // Handle favorite toggle
    const favBtn = e.target.closest(".fav-toggle");
    if (favBtn) {
      e.stopPropagation();
      const gameId = favBtn.dataset.fav;
      toggleFavorite(gameId);
      renderCards();
      setupCardEvents(onNavigate);
      return;
    }

    // Handle card click → navigate to game
    const card = e.target.closest(".game-card");
    if (card) {
      const path = card.dataset.path;
      if (onNavigate) {
        onNavigate(card, path);
      } else {
        window.location.href = path;
      }
    }
  });

  // Keyboard navigation for cards
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".game-card");
    if (!card) return;
    e.preventDefault();
    card.click();
  });

  // Prefetch game assets on hover
  const prefetched = new Set();
  container.addEventListener("pointerenter", (e) => {
    const card = e.target.closest(".game-card");
    if (!card) return;
    const path = card.dataset.path;
    if (!path || prefetched.has(path)) return;
    prefetched.add(path);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = path;
    document.head.appendChild(link);
    const jsLink = document.createElement("link");
    jsLink.rel = "prefetch";
    jsLink.href = path + "main.js";
    document.head.appendChild(jsLink);
  }, true);
}

/**
 * Filter visible cards in the "All Games" grid by category.
 * Pass null or "all" to show all.
 */
export function filterCards(category) {
  const grid = document.getElementById("allGamesGrid");
  if (!grid) return;

  const cards = grid.querySelectorAll(".game-card");
  for (const card of cards) {
    if (!category || category === "all" || card.dataset.category === category) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }
  }
}

/**
 * Filter cards by search query (name + tagline substring match).
 */
export function searchCards(query) {
  const grid = document.getElementById("allGamesGrid");
  if (!grid) return;

  const q = query.toLowerCase().trim();
  const cards = grid.querySelectorAll(".game-card");

  for (const card of cards) {
    const game = gameRegistry.find((g) => g.id === card.dataset.gameId);
    if (!game) continue;
    const match =
      !q ||
      game.name.toLowerCase().includes(q) ||
      game.tagline.toLowerCase().includes(q);
    card.style.display = match ? "" : "none";
  }

  // Show/hide empty state
  const visibleCount = [...cards].filter(
    (c) => c.style.display !== "none"
  ).length;
  let emptyEl = grid.parentElement.querySelector(".empty-state");
  if (visibleCount === 0) {
    if (!emptyEl) {
      emptyEl = document.createElement("p");
      emptyEl.className = "empty-state";
      emptyEl.textContent = "No games match your search.";
      grid.parentElement.appendChild(emptyEl);
    }
    emptyEl.style.display = "";
  } else if (emptyEl) {
    emptyEl.style.display = "none";
  }
}
