/**
 * Arcade Hub — Sound Toggle & Web Audio
 * Minimal audio system using Web Audio API (no audio files).
 */

import { getSoundEnabled, setSoundEnabled } from "./data.js";

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Play a short UI click tone.
 */
export function playClick() {
  if (!getSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // Audio not available — fail silently
  }
}

/**
 * Set up the sound toggle button in the header.
 */
export function setupAudio() {
  const btn = document.getElementById("soundToggle");
  if (!btn) return;

  function updateIcon() {
    const enabled = getSoundEnabled();
    btn.textContent = enabled ? "\u{1F50A}" : "\u{1F507}";
    btn.setAttribute(
      "aria-label",
      enabled ? "Mute sound" : "Unmute sound"
    );
  }

  updateIcon();

  btn.addEventListener("click", () => {
    const nowEnabled = !getSoundEnabled();
    setSoundEnabled(nowEnabled);
    updateIcon();
    if (nowEnabled) playClick();
  });
}
