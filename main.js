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
}

document.addEventListener("DOMContentLoaded", init);
