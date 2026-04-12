/**
 * Arcade Hub — Category Filtering & Search
 */

import { CATEGORIES } from "./data.js";
import { filterCards, searchCards } from "./cards.js";
import { t, tCat } from "./i18n.js";

let activeCategory = "all";
let searchTimeout = null;

export function setupFilters() {
  const bar = document.getElementById("filterBar");
  if (!bar) return;

  // Build filter chips
  const chipContainer = document.createElement("div");
  chipContainer.className = "filter-chips";
  chipContainer.setAttribute("role", "tablist");
  chipContainer.setAttribute("aria-label", "Filter games by category");

  const allChip = createChip("all", t("filterAll"));
  allChip.classList.add("active");
  chipContainer.appendChild(allChip);

  for (const [key] of Object.entries(CATEGORIES)) {
    chipContainer.appendChild(createChip(key, tCat(key)));
  }

  bar.appendChild(chipContainer);

  // Build search input
  const searchWrap = document.createElement("div");
  searchWrap.className = "search-wrap";

  const searchIcon = document.createElement("span");
  searchIcon.className = "search-icon";
  searchIcon.textContent = "\u{1F50D}";
  searchWrap.appendChild(searchIcon);

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "search-input";
  searchInput.placeholder = t("searchPlaceholder");
  searchInput.setAttribute("aria-label", t("searchPlaceholder"));
  searchWrap.appendChild(searchInput);

  bar.appendChild(searchWrap);

  // Chip click handler
  chipContainer.addEventListener("click", (e) => {
    const chip = e.target.closest(".filter-chip");
    if (!chip) return;

    activeCategory = chip.dataset.category;
    for (const c of chipContainer.querySelectorAll(".filter-chip")) {
      const isActive = c.dataset.category === activeCategory;
      c.classList.toggle("active", isActive);
      c.setAttribute("aria-selected", String(isActive));
    }

    // Clear search when switching categories
    searchInput.value = "";
    filterCards(activeCategory);
  });

  // Search input handler (debounced)
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const q = searchInput.value;
      if (q) {
        // Reset category filter when searching
        activeCategory = "all";
        for (const c of chipContainer.querySelectorAll(".filter-chip")) {
          c.classList.toggle("active", c.dataset.category === "all");
        }
        filterCards("all");
      }
      searchCards(q);
    }, 150);
  });
}

function createChip(category, label) {
  const btn = document.createElement("button");
  btn.className = "filter-chip";
  btn.dataset.category = category;
  btn.textContent = label;
  btn.setAttribute("role", "tab");
  btn.setAttribute("aria-selected", category === "all" ? "true" : "false");
  return btn;
}
