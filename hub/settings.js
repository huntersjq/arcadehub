/**
 * Arcade Hub — Settings Panel
 * Modal overlay with sound toggle, data reset, and about info.
 */

import { getSoundEnabled, setSoundEnabled } from "./data.js";

let panelEl = null;

function createPanel() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "settingsOverlay";

  const panel = document.createElement("div");
  panel.className = "modal-panel";

  // Header
  const header = document.createElement("div");
  header.className = "modal-header";

  const title = document.createElement("h2");
  title.textContent = "Settings";
  header.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.textContent = "\u00D7";
  closeBtn.setAttribute("aria-label", "Close settings");
  closeBtn.addEventListener("click", closeSettings);
  header.appendChild(closeBtn);

  panel.appendChild(header);

  // Sound setting
  const soundRow = document.createElement("div");
  soundRow.className = "setting-row";

  const soundLabel = document.createElement("div");
  soundLabel.className = "setting-label";

  const soundTitle = document.createElement("span");
  soundTitle.className = "setting-title";
  soundTitle.textContent = "Sound Effects";
  soundLabel.appendChild(soundTitle);

  const soundDesc = document.createElement("span");
  soundDesc.className = "setting-desc";
  soundDesc.textContent = "UI click sounds and notifications";
  soundLabel.appendChild(soundDesc);

  soundRow.appendChild(soundLabel);

  const toggle = document.createElement("button");
  toggle.className = "setting-toggle" + (getSoundEnabled() ? " active" : "");
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-checked", String(getSoundEnabled()));

  const toggleKnob = document.createElement("span");
  toggleKnob.className = "toggle-knob";
  toggle.appendChild(toggleKnob);

  toggle.addEventListener("click", () => {
    const now = !getSoundEnabled();
    setSoundEnabled(now);
    toggle.classList.toggle("active", now);
    toggle.setAttribute("aria-checked", String(now));
    // Update the header sound button too
    const headerBtn = document.getElementById("soundToggle");
    if (headerBtn) {
      headerBtn.textContent = now ? "\u{1F50A}" : "\u{1F507}";
    }
  });

  soundRow.appendChild(toggle);
  panel.appendChild(soundRow);

  // Divider
  panel.appendChild(createDivider());

  // Theme setting
  const themeRow = document.createElement("div");
  themeRow.className = "setting-row";

  const themeLabel = document.createElement("div");
  themeLabel.className = "setting-label";

  const themeTitle = document.createElement("span");
  themeTitle.className = "setting-title";
  themeTitle.textContent = "Light Theme";
  themeLabel.appendChild(themeTitle);

  const themeDesc = document.createElement("span");
  themeDesc.className = "setting-desc";
  themeDesc.textContent = "Switch between dark and light appearance";
  themeLabel.appendChild(themeDesc);

  themeRow.appendChild(themeLabel);

  const isLight = getTheme() === "light";
  const themeToggle = document.createElement("button");
  themeToggle.className = "setting-toggle" + (isLight ? " active" : "");
  themeToggle.id = "themeToggle";
  themeToggle.setAttribute("role", "switch");
  themeToggle.setAttribute("aria-checked", String(isLight));

  const themeKnob = document.createElement("span");
  themeKnob.className = "toggle-knob";
  themeToggle.appendChild(themeKnob);

  themeToggle.addEventListener("click", () => {
    const nowLight = getTheme() !== "light";
    setTheme(nowLight ? "light" : "dark");
    themeToggle.classList.toggle("active", nowLight);
    themeToggle.setAttribute("aria-checked", String(nowLight));
  });

  themeRow.appendChild(themeToggle);
  panel.appendChild(themeRow);

  // Divider
  panel.appendChild(createDivider());

  // Reset data
  const resetRow = document.createElement("div");
  resetRow.className = "setting-row";

  const resetLabel = document.createElement("div");
  resetLabel.className = "setting-label";

  const resetTitle = document.createElement("span");
  resetTitle.className = "setting-title";
  resetTitle.textContent = "Reset All Data";
  resetLabel.appendChild(resetTitle);

  const resetDesc = document.createElement("span");
  resetDesc.className = "setting-desc";
  resetDesc.textContent = "Clear all scores, achievements, and preferences";
  resetLabel.appendChild(resetDesc);

  resetRow.appendChild(resetLabel);

  const resetBtn = document.createElement("button");
  resetBtn.className = "setting-btn danger";
  resetBtn.textContent = "Reset";
  resetBtn.addEventListener("click", () => {
    if (confirm("This will delete all your game data, scores, and achievements. Are you sure?")) {
      localStorage.clear();
      window.location.reload();
    }
  });

  resetRow.appendChild(resetBtn);
  panel.appendChild(resetRow);

  // Divider
  panel.appendChild(createDivider());

  // About
  const about = document.createElement("div");
  about.className = "setting-about";

  const aboutTitle = document.createElement("h3");
  aboutTitle.textContent = "About Arcade Hub";
  about.appendChild(aboutTitle);

  const aboutText = document.createElement("p");
  aboutText.textContent = "A curated collection of lightning-fast, high-quality HTML5 mini-games. No frameworks, no build tools \u2014 just pure vanilla JavaScript and Canvas.";
  about.appendChild(aboutText);

  const version = document.createElement("span");
  version.className = "setting-version";
  version.textContent = "v2.0.0";
  about.appendChild(version);

  panel.appendChild(about);

  overlay.appendChild(panel);

  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSettings();
  });

  return overlay;
}

const THEME_KEY = "arcade_hub_theme";

function getTheme() {
  return localStorage.getItem(THEME_KEY) || "dark";
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
}

function createDivider() {
  const div = document.createElement("div");
  div.className = "setting-divider";
  return div;
}

export function openSettings() {
  if (!panelEl) {
    panelEl = createPanel();
    document.body.appendChild(panelEl);
  }
  // Update sound toggle state
  const toggle = panelEl.querySelector(".setting-toggle");
  if (toggle) {
    toggle.classList.toggle("active", getSoundEnabled());
    toggle.setAttribute("aria-checked", String(getSoundEnabled()));
  }
  // Short delay ensures the browser has rendered the element before animating
  setTimeout(() => panelEl.classList.add("open"), 20);
}

export function closeSettings() {
  if (panelEl) {
    panelEl.classList.remove("open");
  }
}

export function applyTheme() {
  const theme = getTheme();
  if (theme !== "dark") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export function setupSettings() {
  const btn = document.getElementById("settingsBtn");
  if (btn) {
    btn.addEventListener("click", openSettings);
  }

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panelEl && panelEl.classList.contains("open")) {
      closeSettings();
    }
  });
}
