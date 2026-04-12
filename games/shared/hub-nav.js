/**
 * Arcade Hub — Shared Back-to-Hub Navigation
 * Auto-injects a consistent back button and Escape key handler into any game page.
 */

(function () {
  // Detect base path (works on both local and GitHub Pages)
  const basePath = detectBasePath();

  // Inject back button
  const btn = document.createElement("a");
  btn.href = basePath;
  btn.className = "hub-back-btn";
  btn.setAttribute("aria-label", "Back to Arcade Hub");
  btn.textContent = "\u2190 Hub";
  document.body.appendChild(btn);

  // Escape key handler
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      window.location.href = basePath;
    }
  });

  // Page fade-in effect
  document.body.style.opacity = "0";
  document.body.style.transition = "opacity 0.2s ease-out";
  requestAnimationFrame(() => {
    document.body.style.opacity = "1";
  });

  function detectBasePath() {
    // If we're in /games/something/, go up two levels
    const path = window.location.pathname;
    const gamesIdx = path.indexOf("/games/");
    if (gamesIdx !== -1) {
      return path.substring(0, gamesIdx + 1);
    }
    return "/";
  }
})();
