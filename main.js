/**
 * Arcade Hub — Main Orchestrator
 * Wires up all hub modules on page load.
 */

import { getGlobalCoins } from "./hub/data.js";
import { renderCards, setupCardEvents } from "./hub/cards.js";
import { setupFilters } from "./hub/filters.js";
import { renderStatsBar } from "./hub/stats-bar.js";
import { setupTransitions, navigateWithTransition } from "./hub/transitions.js";
import { setupAudio } from "./hub/audio.js";
import { checkAchievements, notifyAchievements, renderAchievementPanel } from "./hub/achievements.js";
import { setupSettings } from "./hub/settings.js";
import { setupProfile } from "./hub/profile.js";

function init() {
  // Display global coins
  const coinEl = document.getElementById("global-coins");
  if (coinEl) coinEl.textContent = getGlobalCoins().toLocaleString();

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

document.addEventListener("DOMContentLoaded", init);
