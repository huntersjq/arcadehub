/**
 * Arcade Hub — Global Stats Dashboard
 * Compact stats strip with countUp animation.
 */

import { getAggregateStats } from "./data.js";
import { t } from "./i18n.js";

function countUp(el, target, duration) {
  if (target === 0) {
    el.textContent = "0";
    return;
  }
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.floor(eased * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString();
  }
  requestAnimationFrame(step);
}

export function renderStatsBar() {
  const container = document.getElementById("statsStrip");
  if (!container) return;

  const stats = getAggregateStats();

  // Hide if no play history
  if (stats.totalPlays === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "";
  container.textContent = "";

  const items = [
    { label: t("statTotalPlays"), value: stats.totalPlays, isNumber: true },
    { label: t("statTopGame"), value: stats.topGame || "--", isNumber: false },
    { label: t("statCoinsEarned"), value: stats.coins, isNumber: true },
    {
      label: t("statGamesMastered"),
      value: `${stats.gamesMastered}/${stats.totalGames}`,
      isNumber: false,
    },
  ];

  for (const item of items) {
    const el = document.createElement("div");
    el.className = "stat-item";

    const label = document.createElement("span");
    label.className = "stat-label";
    label.textContent = item.label;
    el.appendChild(label);

    const value = document.createElement("span");
    value.className = "stat-value";
    el.appendChild(value);

    if (item.isNumber && typeof item.value === "number") {
      countUp(value, item.value, 800);
    } else {
      value.textContent = item.value;
    }

    container.appendChild(el);
  }
}
