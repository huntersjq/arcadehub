/**
 * Arcade Hub — Main Orchestrator
 * Wires up all hub modules on page load.
 */

import { getGlobalCoins, getRecentlyPlayed } from "./hub/data.js";
import { renderCards, setupCardEvents } from "./hub/cards.js";
import { setupFilters } from "./hub/filters.js";
import { renderStatsBar } from "./hub/stats-bar.js";
import { setupTransitions, navigateWithTransition } from "./hub/transitions.js";
import { setupAudio } from "./hub/audio.js";
import { checkAchievements, notifyAchievements, renderAchievementPanel } from "./hub/achievements.js";
import { setupSettings, applyTheme } from "./hub/settings.js";
import { setupProfile } from "./hub/profile.js";

function init() {
  // Apply saved theme before rendering
  applyTheme();

  // Display global coins
  const coinEl = document.getElementById("global-coins");
  if (coinEl) coinEl.textContent = getGlobalCoins().toLocaleString();

  // Welcome banner for first-time visitors
  showWelcomeBanner();

  // Render hub sections
  renderStatsBar();
  setupFilters();
  renderCards();
  setupCardEvents(navigateWithTransition);
  setupTransitions();
  setupAudio();

  // Phase 2: Platform features
  setupSettings();
  setupProfile();
  setupAchievementsPanel();

  // Check for newly earned achievements
  const newAch = checkAchievements();
  if (newAch.length > 0) {
    notifyAchievements(newAch);
    // Refresh the panel if visible
    const achPanel = document.getElementById("achievementsPanel");
    if (achPanel && achPanel.style.display !== "none") {
      renderAchievementPanel(achPanel);
    }
  }
}

function setupAchievementsPanel() {
  const btn = document.getElementById("achievementsBtn");
  const panel = document.getElementById("achievementsPanel");
  if (!btn || !panel) return;

  btn.addEventListener("click", () => {
    const isVisible = panel.style.display !== "none";
    if (isVisible) {
      panel.style.display = "none";
    } else {
      panel.style.display = "";
      renderAchievementPanel(panel);
    }
  });
}

function showWelcomeBanner() {
  const WELCOME_KEY = "arcade_hub_welcomed";
  if (localStorage.getItem(WELCOME_KEY)) return;
  if (getRecentlyPlayed().length > 0) {
    localStorage.setItem(WELCOME_KEY, "1");
    return;
  }

  const banner = document.createElement("div");
  banner.className = "welcome-banner";

  const content = document.createElement("div");
  content.className = "welcome-content";

  const icon = document.createElement("span");
  icon.className = "welcome-icon";
  icon.textContent = "\u{1F680}";
  content.appendChild(icon);

  const textWrap = document.createElement("div");
  const title = document.createElement("h2");
  title.className = "welcome-title";
  title.textContent = "Welcome to Arcade Hub!";
  textWrap.appendChild(title);

  const text = document.createElement("p");
  text.className = "welcome-text";
  text.textContent =
    "Pick any game below to start playing. Earn coins, unlock achievements, and climb the ranks!";
  textWrap.appendChild(text);
  content.appendChild(textWrap);
  banner.appendChild(content);

  const dismiss = document.createElement("button");
  dismiss.className = "welcome-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.textContent = "\u00D7";
  dismiss.addEventListener("click", () => {
    banner.classList.add("hiding");
    banner.addEventListener("animationend", () => banner.remove());
    localStorage.setItem(WELCOME_KEY, "1");
  });
  banner.appendChild(dismiss);

  const hero = document.querySelector(".hero");
  if (hero) {
    hero.after(banner);
  }
}

document.addEventListener("DOMContentLoaded", init);
