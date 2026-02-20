import { Game, Vector } from "../shared/engine.js";

const LANES = [-150, 0, 150];
const PLAYER_Y = 500;
const OBSTACLE_SPEED_BASE = 600;

class NeonDash extends Game {
  constructor() {
    super("gameCanvas");
    this.reset();
  }

  reset() {
    this.score = 0;
    this.distance = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.currentLane = 1; // Middle lane
    this.targetX = this.width / 2 + LANES[this.currentLane];
    this.playerX = this.targetX;

    this.obstacles = [];
    this.particles = [];
    this.collectible = [];
    this.speedMult = 1.0;
    this.gameOver = false;
    this.spawnTimer = 0;
    this.lastTime = performance.now();

    // Grid lines for perspective
    this.gridOffset = 0;

    const goOverlay = document.getElementById("gameOver");
    if (goOverlay) goOverlay.style.display = "none";

    const hint = document.getElementById("controlsHint");
    if (hint) hint.style.opacity = "1";

    this.updateUI();
  }

  handleInput() {
    if (this.gameOver) return;

    if (this.input.isPressed("a") || this.input.isPressed("ArrowLeft")) {
      if (!this.leftPressed) {
        this.currentLane = Math.max(0, this.currentLane - 1);
        this.hideHint();
      }
      this.leftPressed = true;
    } else {
      this.leftPressed = false;
    }

    if (this.input.isPressed("d") || this.input.isPressed("ArrowRight")) {
      if (!this.rightPressed) {
        this.currentLane = Math.min(2, this.currentLane + 1);
        this.hideHint();
      }
      this.rightPressed = true;
    } else {
      this.rightPressed = false;
    }

    this.targetX = this.width / 2 + LANES[this.currentLane];
  }

  hideHint() {
    const hint = document.getElementById("controlsHint");
    if (hint) hint.style.opacity = "0";
  }

  update(dt) {
    if (this.gameOver) return;

    this.handleInput();

    // Smooth lane transition
    this.playerX += (this.targetX - this.playerX) * 0.15;

    // Progression
    this.distance += dt * 50 * this.speedMult;
    this.speedMult = 1.0 + (this.distance / 1000) * 0.5;
    this.gridOffset =
      (this.gridOffset + dt * OBSTACLE_SPEED_BASE * this.speedMult) % 100;

    // Spawn obstacles
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnWave();
      this.spawnTimer = Math.max(0.4, 1.2 - this.distance / 2000);
    }

    // Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.y += OBSTACLE_SPEED_BASE * this.speedMult * dt;

      // Collision check
      const dx = Math.abs(obs.x - this.playerX);
      const dy = Math.abs(obs.y - PLAYER_Y);

      if (dx < 40 && dy < 40 && !obs.hit) {
        this.takeDamage(25);
        obs.hit = true;
        this.createExplosion(obs.x, obs.y, "#ff007f", 10);
      }

      if (obs.y > this.height + 100) {
        this.obstacles.splice(i, 1);
        if (!obs.hit) this.score += 10;
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    this.updateUI();
  }

  spawnWave() {
    const lane = Math.floor(Math.random() * 3);
    const x = this.width / 2 + LANES[lane];
    this.obstacles.push({
      x: x,
      y: -50,
      width: 60,
      height: 60,
      hit: false,
    });

    // Chance for double obstacles at higher speeds
    if (this.speedMult > 1.5 && Math.random() > 0.7) {
      let secondLane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
      this.obstacles.push({
        x: this.width / 2 + LANES[secondLane],
        y: -50,
        width: 60,
        height: 60,
        hit: false,
      });
    }
  }

  takeDamage(amt) {
    this.health -= amt;
    this.screenShake = 10;
    if (this.health <= 0) {
      this.health = 0;
      this.triggerGameOver();
    }
  }

  triggerGameOver() {
    this.gameOver = true;
    document.getElementById("gameOver").style.display = "flex";
    document.getElementById("finalDist").innerText = Math.floor(this.distance);
    document.getElementById("finalScore").innerText = this.score;
  }

  updateUI() {
    const scoreEl = document.getElementById("score");
    const distEl = document.getElementById("distVal");
    const healthFill = document.getElementById("healthFill");

    if (scoreEl) scoreEl.innerText = this.score.toString().padStart(4, "0");
    if (distEl) distEl.innerText = Math.floor(this.distance);
    if (healthFill) healthFill.style.width = this.health + "%";
  }

  createExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 200 + 100;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        color: color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#05050a";
    ctx.fillRect(0, 0, this.width, this.height);

    // Grid Perspective
    this.drawWorld(ctx);

    // Draw Particles
    this.particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Obstacles
    this.obstacles.forEach((obs) => {
      this.drawObstacle(ctx, obs);
    });

    // Draw Player
    this.drawPlayer(ctx);

    ctx.globalAlpha = 1.0;
  }

  drawWorld(ctx) {
    ctx.strokeStyle = "rgba(0, 242, 255, 0.15)";
    ctx.lineWidth = 1;

    const centerX = this.width / 2;

    // Vertical lanes
    LANES.forEach((offset) => {
      ctx.beginPath();
      ctx.moveTo(centerX + offset - 80, 0);
      ctx.lineTo(centerX + offset - 80, this.height);
      ctx.moveTo(centerX + offset + 80, 0);
      ctx.lineTo(centerX + offset + 80, this.height);
      ctx.stroke();
    });

    // Horizontal moving grid
    for (let y = this.gridOffset; y < this.height; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Vanishing point glow
    const grad = ctx.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, "rgba(188, 19, 254, 0.2)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, 300);
  }

  drawPlayer(ctx) {
    const x = this.playerX;
    const y = PLAYER_Y;

    // Trail
    const trailGrad = ctx.createLinearGradient(x, y, x, y + 100);
    trailGrad.addColorStop(0, "rgba(0, 242, 255, 0.5)");
    trailGrad.addColorStop(1, "transparent");
    ctx.fillStyle = trailGrad;
    ctx.fillRect(x - 15, y, 30, 80);

    // Body
    ctx.save();
    ctx.translate(x, y);

    // Simple lean effect
    const lean = (this.targetX - this.playerX) * 0.05;
    ctx.rotate(lean);

    // Glow
    const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 40);
    glow.addColorStop(0, "rgba(0, 242, 255, 0.8)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(20, 15);
    ctx.lineTo(-20, 15);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#00f2ff";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  drawObstacle(ctx, obs) {
    ctx.save();
    ctx.translate(obs.x, obs.y);

    const color = obs.hit ? "#333" : "#ff007f";

    // Outer Glow
    if (!obs.hit) {
      const glow = ctx.createRadialGradient(0, 0, 20, 0, 0, 60);
      glow.addColorStop(0, "rgba(255, 0, 127, 0.3)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.rotate(performance.now() * 0.005);

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(-25, -25, 50, 50);

    ctx.fillStyle = "rgba(255, 0, 127, 0.1)";
    ctx.fillRect(-25, -25, 50, 50);

    // Inner pulsing square
    const pulse = Math.sin(performance.now() * 0.01) * 5;
    ctx.strokeRect(-10 - pulse, -10 - pulse, 20 + pulse * 2, 20 + pulse * 2);

    ctx.restore();
  }
}

const game = new NeonDash();
window.game = game;
game.start();
