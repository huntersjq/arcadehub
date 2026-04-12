/**
 * Stellar Siege — Tower Defense
 * Place towers to stop waves of enemies traveling along a path.
 */

const HIGHSCORE_KEY = "stellar_siege_highscores";
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ── Tower Definitions ──
const TOWER_DEFS = {
  blaster: {
    cost: 25, range: 120, damage: 8, fireRate: 0.4,
    color: "#22d3ee", projColor: "#22d3ee", projSpeed: 400, splash: 0,
  },
  frost: {
    cost: 40, range: 100, damage: 4, fireRate: 0.6,
    color: "#60a5fa", projColor: "#93c5fd", projSpeed: 300, splash: 0, slow: 0.4,
  },
  cannon: {
    cost: 60, range: 130, damage: 25, fireRate: 1.2,
    color: "#f97316", projColor: "#fb923c", projSpeed: 250, splash: 50,
  },
  laser: {
    cost: 80, range: 160, damage: 15, fireRate: 0.3,
    color: "#a855f7", projColor: "#c084fc", projSpeed: 600, splash: 0,
  },
};

// ── Game State ──
let gameState = "menu"; // menu | playing | gameover
let wave = 0;
let credits = 100;
let lives = 20;
let score = 0;
let waveTimer = 0;
let spawnTimer = 0;
let enemiesToSpawn = 0;
let selectedTower = "blaster";
let towers = [];
let enemies = [];
let projectiles = [];
let particles = [];
let path = [];
let gridCols, gridRows;
const CELL = 40;
let mouseX = 0, mouseY = 0;
let lastTime = 0;

// ── Path Generation ──
function generatePath() {
  gridCols = Math.floor(canvas.width / CELL);
  gridRows = Math.floor(canvas.height / CELL);

  path = [];
  // Create a snake-like path
  let y = 2;
  let x = 0;
  let dir = 1; // 1 = right, -1 = left

  path.push({ x: -1, y });
  while (y < gridRows - 2) {
    // Horizontal segment
    const endX = dir === 1 ? gridCols - 3 : 2;
    while (x !== endX) {
      path.push({ x, y });
      x += dir;
    }
    path.push({ x, y });

    // Vertical segment (go down 3 cells)
    for (let i = 0; i < 3 && y < gridRows - 2; i++) {
      y++;
      path.push({ x, y });
    }
    dir *= -1;
  }
  // Final horizontal to edge
  const finalX = dir === 1 ? gridCols : -1;
  while (x !== finalX) {
    path.push({ x, y });
    x += dir;
  }
  path.push({ x: finalX, y });
}

function isOnPath(gx, gy) {
  return path.some((p) => p.x === gx && p.y === gy);
}

function hasTower(gx, gy) {
  return towers.some((t) => t.gx === gx && t.gy === gy);
}

// ── Path Interpolation for Enemies ──
function getPathPos(progress) {
  const idx = progress * (path.length - 1);
  const i = Math.floor(idx);
  const frac = idx - i;
  const a = path[Math.min(i, path.length - 1)];
  const b = path[Math.min(i + 1, path.length - 1)];
  return {
    x: (a.x + (b.x - a.x) * frac) * CELL + CELL / 2,
    y: (a.y + (b.y - a.y) * frac) * CELL + CELL / 2,
  };
}

// ── Enemy Spawn ──
function spawnEnemy() {
  const baseHP = 20 + wave * 12;
  const speed = 0.015 + Math.min(wave * 0.001, 0.015);
  const isBoss = enemiesToSpawn === 1 && wave % 5 === 0 && wave > 0;
  enemies.push({
    progress: 0,
    hp: isBoss ? baseHP * 4 : baseHP,
    maxHp: isBoss ? baseHP * 4 : baseHP,
    speed: isBoss ? speed * 0.6 : speed,
    baseSpeed: isBoss ? speed * 0.6 : speed,
    slowTimer: 0,
    reward: isBoss ? 30 : 5 + Math.floor(wave / 3),
    radius: isBoss ? 14 : 8,
    boss: isBoss,
    x: 0, y: 0,
  });
}

function startWave() {
  wave++;
  enemiesToSpawn = 6 + wave * 2;
  spawnTimer = 0;
  waveTimer = 0;
  updateHUD();
}

// ── Tower Placement ──
function placeTower(gx, gy) {
  const def = TOWER_DEFS[selectedTower];
  if (!def || credits < def.cost) return;
  if (isOnPath(gx, gy) || hasTower(gx, gy)) return;
  if (gx < 0 || gx >= gridCols || gy < 0 || gy >= gridRows) return;

  credits -= def.cost;
  towers.push({
    gx, gy,
    x: gx * CELL + CELL / 2,
    y: gy * CELL + CELL / 2,
    type: selectedTower,
    ...def,
    cooldown: 0,
    angle: 0,
  });
  updateHUD();
  updatePaletteState();
}

// ── Projectile & Combat ──
function fireTower(tower, target) {
  const dx = target.x - tower.x;
  const dy = target.y - tower.y;
  const dist = Math.hypot(dx, dy);
  projectiles.push({
    x: tower.x,
    y: tower.y,
    vx: (dx / dist) * tower.projSpeed,
    vy: (dy / dist) * tower.projSpeed,
    damage: tower.damage,
    color: tower.projColor,
    splash: tower.splash,
    slow: tower.slow || 0,
    life: 2,
  });
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 80;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.3 + Math.random() * 0.3,
      color,
      radius: 2 + Math.random() * 3,
    });
  }
}

// ── Update ──
function update(dt) {
  if (gameState !== "playing") return;

  // Spawn enemies
  if (enemiesToSpawn > 0) {
    spawnTimer += dt;
    const spawnInterval = Math.max(0.3, 0.8 - wave * 0.02);
    if (spawnTimer >= spawnInterval) {
      spawnTimer -= spawnInterval;
      spawnEnemy();
      enemiesToSpawn--;
    }
  }

  // Auto-start next wave when all enemies cleared
  if (enemiesToSpawn === 0 && enemies.length === 0) {
    waveTimer += dt;
    if (waveTimer >= 2) {
      startWave();
    }
  }

  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    // Slow effect
    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      e.speed = e.baseSpeed * 0.5;
    } else {
      e.speed = e.baseSpeed;
    }

    e.progress += e.speed * dt;
    const pos = getPathPos(Math.min(e.progress, 1));
    e.x = pos.x;
    e.y = pos.y;

    if (e.progress >= 1) {
      lives -= e.boss ? 5 : 1;
      enemies.splice(i, 1);
      updateHUD();
      if (lives <= 0) {
        triggerGameOver();
        return;
      }
    }
  }

  // Update towers
  for (const t of towers) {
    t.cooldown -= dt;
    if (t.cooldown > 0) continue;

    // Find closest enemy in range
    let closest = null;
    let closestDist = Infinity;
    for (const e of enemies) {
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d <= t.range && d < closestDist) {
        closest = e;
        closestDist = d;
      }
    }

    if (closest) {
      t.angle = Math.atan2(closest.y - t.y, closest.x - t.x);
      fireTower(t, closest);
      t.cooldown = t.fireRate;
    }
  }

  // Update projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    if (p.life <= 0 || p.x < -50 || p.x > canvas.width + 50 || p.y < -50 || p.y > canvas.height + 50) {
      projectiles.splice(i, 1);
      continue;
    }

    // Hit detection
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + 4) {
        // Apply damage
        if (p.splash > 0) {
          for (const e2 of enemies) {
            if (Math.hypot(e2.x - p.x, e2.y - p.y) < p.splash) {
              e2.hp -= p.damage * 0.6;
              if (p.slow > 0) e2.slowTimer = 1.5;
            }
          }
          spawnParticles(p.x, p.y, p.color, 8);
        }
        e.hp -= p.damage;
        if (p.slow > 0) e.slowTimer = 1.5;
        spawnParticles(p.x, p.y, p.color, 3);

        if (e.hp <= 0) {
          score += e.reward;
          credits += e.reward;
          spawnParticles(e.x, e.y, "#ef4444", 12);
          enemies.splice(j, 1);
          updateHUD();
          updatePaletteState();
        }

        projectiles.splice(i, 1);
        break;
      }
    }
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 0.95;
    p.vy *= 0.95;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ── Draw ──
function draw() {
  ctx.fillStyle = "#05050a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid (subtle)
  ctx.strokeStyle = "rgba(255,255,255,0.02)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += CELL) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += CELL) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw path
  ctx.strokeStyle = "rgba(34, 211, 238, 0.15)";
  ctx.lineWidth = CELL * 0.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const px = path[i].x * CELL + CELL / 2;
    const py = path[i].y * CELL + CELL / 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Path center line
  ctx.strokeStyle = "rgba(34, 211, 238, 0.06)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const px = path[i].x * CELL + CELL / 2;
    const py = path[i].y * CELL + CELL / 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Draw tower range preview on hover
  if (gameState === "playing") {
    const gx = Math.floor(mouseX / CELL);
    const gy = Math.floor(mouseY / CELL);
    if (gx >= 0 && gx < gridCols && gy >= 0 && gy < gridRows) {
      const def = TOWER_DEFS[selectedTower];
      if (def && !isOnPath(gx, gy) && !hasTower(gx, gy)) {
        const cx = gx * CELL + CELL / 2;
        const cy = gy * CELL + CELL / 2;
        // Range circle
        ctx.strokeStyle = "rgba(34, 211, 238, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, def.range, 0, Math.PI * 2);
        ctx.stroke();
        // Ghost tower
        ctx.globalAlpha = 0.4;
        drawTowerShape(cx, cy, def.color, 0);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Draw towers
  for (const t of towers) {
    // Range indicator (subtle)
    ctx.strokeStyle = `${t.color}08`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
    ctx.stroke();

    drawTowerShape(t.x, t.y, t.color, t.angle);
  }

  // Draw enemies
  for (const e of enemies) {
    // Health bar background
    const barW = e.radius * 2.5;
    const barH = 3;
    const barX = e.x - barW / 2;
    const barY = e.y - e.radius - 8;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(barX, barY, barW, barH);
    // Health bar fill
    const hpRatio = Math.max(0, e.hp / e.maxHp);
    const barColor = hpRatio > 0.5 ? "#22c55e" : hpRatio > 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    // Enemy body
    ctx.fillStyle = e.boss ? "#ef4444" : (e.slowTimer > 0 ? "#93c5fd" : "#f97316");
    ctx.shadowColor = e.boss ? "#ef4444" : "#f97316";
    ctx.shadowBlur = e.boss ? 16 : 8;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (e.boss) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Draw projectiles
  for (const p of projectiles) {
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Draw particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.6);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * (p.life / 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTowerShape(x, y, color, angle) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  // Base
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();

  // Barrel
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle) * 16, y + Math.sin(angle) * 16);
  ctx.stroke();

  ctx.shadowBlur = 0;
}

// ── HUD ──
function updateHUD() {
  const el = (id) => document.getElementById(id);
  el("waveNum").textContent = wave;
  el("credits").textContent = credits;
  el("lives").textContent = lives;
  el("score").textContent = score;
}

function updatePaletteState() {
  const btns = document.querySelectorAll(".tower-btn");
  for (const btn of btns) {
    const type = btn.dataset.tower;
    const def = TOWER_DEFS[type];
    btn.classList.toggle("disabled", credits < def.cost);
    btn.classList.toggle("selected", type === selectedTower);
  }
}

// ── Game Flow ──
function triggerGameOver() {
  gameState = "gameover";
  document.getElementById("hud").style.display = "none";
  document.getElementById("towerPalette").style.display = "none";

  const coinsEarned = Math.floor(score / 50);
  if (window.ArcadeHub) window.ArcadeHub.addCoins(coinsEarned);
  saveHighScore();

  const statsEl = document.getElementById("goStats");
  statsEl.textContent = "";
  const lines = [
    `WAVE REACHED: ${wave}`,
    `ENEMIES DESTROYED: ${score}`,
    `COINS EARNED: ${coinsEarned}`,
  ];
  for (const line of lines) {
    const div = document.createElement("div");
    div.textContent = line;
    statsEl.appendChild(div);
  }

  document.getElementById("gameOver").style.display = "flex";
}

function saveHighScore() {
  let scores = [];
  try {
    scores = JSON.parse(localStorage.getItem(HIGHSCORE_KEY) || "[]");
  } catch (_) {
    scores = [];
  }
  scores.push({ score, wave, date: new Date().toLocaleDateString() });
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(scores.slice(0, 5)));
}

// ── Resize ──
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  generatePath();
}

// ── Input ──
canvas.addEventListener("click", (e) => {
  if (gameState !== "playing") return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const gx = Math.floor(x / CELL);
  const gy = Math.floor(y / CELL);
  placeTower(gx, gy);
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

// Touch support
canvas.addEventListener("touchstart", (e) => {
  if (gameState !== "playing") return;
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  mouseX = x;
  mouseY = y;
  const gx = Math.floor(x / CELL);
  const gy = Math.floor(y / CELL);
  placeTower(gx, gy);
}, { passive: false });

// Tower palette buttons
document.getElementById("towerPalette").addEventListener("click", (e) => {
  const btn = e.target.closest(".tower-btn");
  if (!btn) return;
  selectedTower = btn.dataset.tower;
  updatePaletteState();
});

// Keyboard shortcuts for tower selection
document.addEventListener("keydown", (e) => {
  const keys = { "1": "blaster", "2": "frost", "3": "cannon", "4": "laser" };
  if (keys[e.key]) {
    selectedTower = keys[e.key];
    updatePaletteState();
  }
});

window.addEventListener("resize", resize);

// ── Game Loop ──
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// ── Public API ──
const game = {
  start() {
    gameState = "playing";
    wave = 0;
    credits = 100;
    lives = 20;
    score = 0;
    towers = [];
    enemies = [];
    projectiles = [];
    particles = [];
    selectedTower = "blaster";

    document.getElementById("startScreen").style.display = "none";
    document.getElementById("gameOver").style.display = "none";
    document.getElementById("hud").style.display = "flex";
    document.getElementById("towerPalette").style.display = "flex";

    resize();
    updateHUD();
    updatePaletteState();
    startWave();
  },
};

window.game = game;

// Init
resize();
lastTime = performance.now();
requestAnimationFrame(loop);
