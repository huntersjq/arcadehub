/**
 * Arcade Hub — Procedural Canvas Icon Animations
 * Each game gets a unique mini-animation drawn on a 64x64 canvas.
 */

const TAU = Math.PI * 2;

// ── Cosmic Merge: orbiting planets ──
function drawCosmicMerge(ctx, t, w, h) {
  const cx = w / 2;
  const cy = h / 2;

  // Central sun glow
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14);
  grad.addColorStop(0, "#fbbf24");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, TAU);
  ctx.fill();

  // Sun core
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, TAU);
  ctx.fill();

  // Orbiting planets
  const orbits = [
    { r: 16, speed: 1.2, size: 3, color: "#6366f1" },
    { r: 22, speed: 0.7, size: 2.5, color: "#a855f7" },
    { r: 28, speed: -0.5, size: 2, color: "#00f2ff" },
  ];
  for (const o of orbits) {
    const angle = t * o.speed;
    const px = cx + Math.cos(angle) * o.r;
    const py = cy + Math.sin(angle) * o.r;
    ctx.fillStyle = o.color;
    ctx.beginPath();
    ctx.arc(px, py, o.size, 0, TAU);
    ctx.fill();
  }
}

// ── Neon Survivor: particle swarm ──
function drawNeonSurvivor(ctx, t, w, h) {
  const cx = w / 2;
  const cy = h / 2;

  // Player core
  ctx.fillStyle = "#00f2ff";
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, TAU);
  ctx.fill();

  // Pulsing shield
  const pulseR = 8 + Math.sin(t * 3) * 2;
  ctx.strokeStyle = "rgba(0, 242, 255, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, pulseR, 0, TAU);
  ctx.stroke();

  // Enemy particles swirling
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU + t * 0.8;
    const r = 18 + Math.sin(t * 2 + i) * 4;
    const ex = cx + Math.cos(angle) * r;
    const ey = cy + Math.sin(angle) * r;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(ex, ey, 1.5, 0, TAU);
    ctx.fill();
  }

  // Bullet lines
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * TAU + t * 1.5;
    const bx = cx + Math.cos(angle) * 12;
    const by = cy + Math.sin(angle) * 12;
    ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 6, cy + Math.sin(angle) * 6);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
}

// ── Neon Dash: speeding lanes ──
function drawNeonDash(ctx, t, w, h) {
  // Perspective lines
  const cx = w / 2;
  const horizon = h * 0.3;
  const speed = t * 80;

  ctx.strokeStyle = "rgba(0, 242, 255, 0.3)";
  ctx.lineWidth = 0.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 3, horizon);
    ctx.lineTo(cx + i * 18, h);
    ctx.stroke();
  }

  // Moving horizontal lines (road markers)
  for (let i = 0; i < 5; i++) {
    const progress = ((speed / 60 + i * 0.2) % 1);
    const y = horizon + progress * (h - horizon);
    const spread = progress * 0.8;
    const alpha = 0.15 + progress * 0.3;
    ctx.strokeStyle = `rgba(0, 242, 255, ${alpha})`;
    ctx.lineWidth = 0.5 + progress;
    ctx.beginPath();
    ctx.moveTo(cx - spread * w * 0.4, y);
    ctx.lineTo(cx + spread * w * 0.4, y);
    ctx.stroke();
  }

  // Runner dot
  const laneX = cx + Math.sin(t * 1.5) * 8;
  ctx.fillStyle = "#00f2ff";
  ctx.fillRect(laneX - 2, h - 14, 4, 6);

  // Glow behind runner
  const glow = ctx.createRadialGradient(laneX, h - 11, 1, laneX, h - 11, 8);
  glow.addColorStop(0, "rgba(0, 242, 255, 0.3)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(laneX - 10, h - 20, 20, 16);
}

// ── Stellar Match: merging tiles ──
function drawStellarMatch(ctx, t, w, h) {
  const gridSize = 3;
  const cellSize = 12;
  const offset = (w - gridSize * cellSize) / 2;

  const colors = ["#6366f1", "#a855f7", "#ec4899", "#3b82f6"];
  const animTile = Math.floor(t * 0.8) % (gridSize * gridSize);

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const idx = r * gridSize + c;
      const x = offset + c * cellSize + 1;
      const y = offset + r * cellSize + 6;
      const isAnimating = idx === animTile;
      const scale = isAnimating ? 1 + Math.sin(t * 4) * 0.15 : 1;
      const size = (cellSize - 2) * scale;
      const adj = (cellSize - 2 - size) / 2;

      ctx.fillStyle = colors[idx % colors.length];
      ctx.globalAlpha = isAnimating ? 1 : 0.6;
      ctx.beginPath();
      ctx.roundRect(x + adj, y + adj, size, size, 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ── Nebula Refinery: stardust particles rising ──
function drawNebulaRefinery(ctx, t, w, h) {
  const cx = w / 2;

  // Refinery base
  ctx.fillStyle = "rgba(251, 191, 36, 0.3)";
  ctx.fillRect(cx - 8, h - 16, 16, 12);
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(cx - 6, h - 18, 12, 4);

  // Chimney
  ctx.fillStyle = "rgba(251, 191, 36, 0.5)";
  ctx.fillRect(cx - 2, h - 26, 4, 10);

  // Rising stardust particles
  for (let i = 0; i < 12; i++) {
    const seed = i * 137.5;
    const px = cx + Math.sin(seed + t * 0.5) * 14;
    const progress = ((t * 0.4 + i * 0.08) % 1);
    const py = (h - 26) - progress * (h - 10);
    const alpha = 1 - progress;
    const size = 1 + (1 - progress) * 1.5;

    ctx.fillStyle =
      i % 3 === 0
        ? `rgba(251, 191, 36, ${alpha})`
        : `rgba(168, 85, 247, ${alpha * 0.7})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, TAU);
    ctx.fill();
  }
}

// ── Vox Runner: pseudo-3D blocks ──
function drawVoxRunner(ctx, t, w, h) {
  const cx = w / 2;
  const horizon = h * 0.35;

  // Ground grid lines
  ctx.strokeStyle = "rgba(236, 72, 153, 0.2)";
  ctx.lineWidth = 0.5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 2, horizon);
    ctx.lineTo(cx + i * 16, h);
    ctx.stroke();
  }

  // Obstacles (blocks)
  const speed = t * 40;
  for (let i = 0; i < 3; i++) {
    const progress = ((speed / 60 + i * 0.33) % 1);
    const y = horizon + progress * (h - horizon) - 8;
    const scale = 0.3 + progress * 0.7;
    const bw = 6 * scale;
    const bh = 8 * scale;
    const bx = cx + (i % 2 === 0 ? -1 : 1) * 8 * scale;
    ctx.fillStyle = `rgba(236, 72, 153, ${0.3 + progress * 0.5})`;
    ctx.fillRect(bx - bw / 2, y - bh, bw, bh);
    // Top face
    ctx.fillStyle = `rgba(236, 72, 153, ${0.5 + progress * 0.4})`;
    ctx.fillRect(bx - bw / 2, y - bh - 2 * scale, bw, 2 * scale);
  }

  // Player cube
  const jumpY = Math.abs(Math.sin(t * 3)) * 6;
  ctx.fillStyle = "#ec4899";
  ctx.fillRect(cx - 3, h - 12 - jumpY, 6, 6);
  ctx.fillStyle = "#f472b6";
  ctx.fillRect(cx - 3, h - 12 - jumpY - 2, 6, 2);
}

// ── Stellar Speller: floating letter tiles ──
function drawStellarSpeller(ctx, t, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const letters = "SPELL";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < letters.length; i++) {
    const angle = (TAU / letters.length) * i + t * 0.8;
    const r = 16 + Math.sin(t * 2 + i) * 4;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const hue = 260 + i * 15;

    // Tile background
    ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.25)`;
    ctx.beginPath();
    ctx.roundRect(x - 6, y - 6, 12, 12, 2);
    ctx.fill();

    // Letter
    ctx.fillStyle = `hsl(${hue}, 80%, 75%)`;
    ctx.fillText(letters[i], x, y + 1);
  }

  // Central glow
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
  grad.addColorStop(0, "rgba(139, 92, 246, 0.3)");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, TAU);
  ctx.fill();
}

// ── Pulse Beat: falling note lanes ──
function drawPulseBeat(ctx, t, w, h) {
  const laneW = w / 4;
  const colors = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];

  // Lane dividers
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(laneW * i, 0);
    ctx.lineTo(laneW * i, h);
    ctx.stroke();
  }

  // Hit line
  const hitY = h - 12;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, hitY);
  ctx.lineTo(w, hitY);
  ctx.stroke();

  // Hit zone dots
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = colors[i] + "40";
    ctx.beginPath();
    ctx.arc(laneW * i + laneW / 2, hitY, 3, 0, TAU);
    ctx.fill();
  }

  // Falling notes
  const speed = t * 30;
  for (let i = 0; i < 6; i++) {
    const lane = (i * 7 + Math.floor(t * 2)) % 4;
    const y = ((speed + i * 15) % (h + 10)) - 5;
    const cx = laneW * lane + laneW / 2;
    const color = colors[lane];

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, y, 3.5, 0, TAU);
    ctx.fill();

    // Glow
    const grad = ctx.createRadialGradient(cx, y, 1, cx, y, 7);
    grad.addColorStop(0, color + "40");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, y, 7, 0, TAU);
    ctx.fill();
  }
}

// ── Icon Registry ──

const iconDrawers = {
  "cosmic-merge": drawCosmicMerge,
  "neon-survivor": drawNeonSurvivor,
  "neon-dash": drawNeonDash,
  "stellar-match": drawStellarMatch,
  "nebula-refinery": drawNebulaRefinery,
  "vox-runner": drawVoxRunner,
  "stellar-speller": drawStellarSpeller,
  "pulse-beat": drawPulseBeat,
};

/**
 * Start animating an icon canvas for a given game.
 * Returns a stop function to cancel the animation.
 */
export function startIconAnimation(canvas, gameId) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = 64;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  ctx.scale(dpr, dpr);

  const drawFn = iconDrawers[gameId];
  if (!drawFn) return () => {};

  let rafId = null;
  const startTime = performance.now();

  function frame(now) {
    const t = (now - startTime) / 1000;
    ctx.clearRect(0, 0, size, size);
    drawFn(ctx, t, size, size);
    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return () => {
    if (rafId != null) cancelAnimationFrame(rafId);
  };
}
