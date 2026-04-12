/**
 * Arcade Hub — Page Transition System
 * Smooth clip-path overlay transitions between hub and games.
 */

export function setupTransitions() {
  const overlay = document.getElementById("transitionOverlay");
  if (!overlay) return;

  // Fade in on page load
  document.body.classList.add("page-enter");
  requestAnimationFrame(() => {
    document.body.classList.add("page-enter-active");
  });
}

/**
 * Animate from a card element to full-screen, then navigate.
 * Called as the onNavigate callback from cards.js.
 */
export function navigateWithTransition(cardEl, path) {
  const overlay = document.getElementById("transitionOverlay");
  if (!overlay) {
    window.location.href = path;
    return;
  }

  const accent = cardEl.style.getPropertyValue("--accent") || "#6366f1";
  overlay.style.background = accent;

  // Get card center for clip-path origin
  const rect = cardEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // Calculate max distance from origin to any viewport corner
  const maxDist = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(window.innerWidth - cx, cy),
    Math.hypot(cx, window.innerHeight - cy),
    Math.hypot(window.innerWidth - cx, window.innerHeight - cy)
  );

  overlay.style.setProperty("--cx", `${cx}px`);
  overlay.style.setProperty("--cy", `${cy}px`);
  overlay.style.setProperty("--max-r", `${maxDist}px`);

  // Skip animation for reduced motion preference
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.location.href = path;
    return;
  }

  overlay.classList.add("active");

  // Navigate after animation completes
  overlay.addEventListener(
    "animationend",
    () => {
      window.location.href = path;
    },
    { once: true }
  );

  // Fallback in case animationend doesn't fire
  setTimeout(() => {
    window.location.href = path;
  }, 500);
}
