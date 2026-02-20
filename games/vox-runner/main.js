import { Game, Vector } from "../shared/engine.js";

const VANISH_Y = 150;
const FLOOR_Y = 600;

class VoxRunner extends Game {
  constructor() {
    super("gameCanvas");
    this.reset();
  }

  reset() {
    this.distance = 0;
    this.speed = 400; // units per second
    this.player = {
      x: this.width / 2,
      z: 0, // Height off ground (jump)
      zVel: 0,
      width: 40,
      height: 60,
      isGrounded: true,
    };

    this.obstacles = [];
    this.particles = [];
    this.gridOffset = 0;
    this.spawnTimer = 0;
    this.gameOver = false;

    document.getElementById("game-over").style.display = "none";
    document.getElementById("hint").style.opacity = "1";
    this.updateUI();
  }

  update(dt) {
    if (this.gameOver) return;

    // Movement & Speed
    this.distance += (this.speed * dt) / 50;
    this.speed += dt * 5; // Gradually increase speed
    this.gridOffset = (this.gridOffset + this.speed * dt) % 100;

    // Jumping
    if (
      this.player.isGrounded &&
      (this.input.isPressed(" ") ||
        this.input.isPressed("ArrowUp") ||
        this.input.isDown ||
        this.input.mouse.isDown)
    ) {
      this.player.zVel = 600;
      this.player.isGrounded = false;
      document.getElementById("hint").style.opacity = "0";
    }

    if (!this.player.isGrounded) {
      this.player.z += this.player.zVel * dt;
      this.player.zVel -= 1800 * dt; // Gravity
      if (this.player.z <= 0) {
        this.player.z = 0;
        this.player.zVel = 0;
        this.player.isGrounded = true;
      }
    }

    // Spawn Obstacles
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      this.spawnTimer = Math.max(0.6, 1.5 - this.speed / 1000);
    }

    // Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      let obs = this.obstacles[i];
      obs.y += this.speed * dt;

      // Collision check (simple AABB at the "floor" line)
      if (obs.y > FLOOR_Y - 50 && obs.y < FLOOR_Y + 20) {
        // If player is not jumping high enough
        if (this.player.z < obs.height - 20) {
          this.triggerGameOver();
        }
      }

      if (obs.y > this.height + 100) {
        this.obstacles.splice(i, 1);
      }
    }

    this.updateUI();
  }

  spawnObstacle() {
    this.obstacles.push({
      y: VANISH_Y,
      width: 60 + Math.random() * 40,
      height: 40 + Math.random() * 60,
      color: Math.random() > 0.5 ? "#22c55e" : "#06b6d4",
    });
  }

  triggerGameOver() {
    this.gameOver = true;

    // Calculate Coins
    const dist = Math.floor(this.distance);
    const coinsEarned = Math.floor(dist / 10);

    document.getElementById("game-over").style.display = "flex";
    document.getElementById("finalScore").innerText = dist;
    document.getElementById("rewardText").innerText =
      `+${coinsEarned} Arcade Coins Earned!`;

    // Add to global coins if parent structure allows it
    if (window.parent && window.parent.addArcadeCoins) {
      window.parent.addArcadeCoins(coinsEarned);
    } else {
      // Fallback if not inside iframe or shared global context
      let currentCoins = parseInt(
        localStorage.getItem("arcade_coins") || "0",
        10,
      );
      localStorage.setItem("arcade_coins", currentCoins + coinsEarned);
    }
  }

  updateUI() {
    document.getElementById("score").innerText =
      `${Math.floor(this.distance)}m`;
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw Floor Grid (Pseudo 3D)
    this.drawGrid(ctx);

    // Sort obstacles back to front (z-sorting)
    const sorted = [...this.obstacles].sort((a, b) => a.y - b.y);

    sorted.forEach((obs) => {
      this.drawObstacle(ctx, obs);
    });

    // Draw Player
    this.drawPlayer(ctx);
  }

  drawGrid(ctx) {
    ctx.strokeStyle = "rgba(6, 182, 212, 0.15)";
    ctx.lineWidth = 1;

    // Horizon line
    ctx.beginPath();
    ctx.moveTo(0, VANISH_Y);
    ctx.lineTo(this.width, VANISH_Y);
    ctx.stroke();

    const cx = this.width / 2;

    // Perspective lines
    for (let x = -1000; x <= 1000; x += 100) {
      ctx.beginPath();
      ctx.moveTo(cx, VANISH_Y);
      ctx.lineTo(cx + x, this.height);
      ctx.stroke();
    }

    // Horizontal Lines (moving)
    for (let y = this.gridOffset; y < this.height - VANISH_Y; y += 80) {
      // Perspective scaling for horizontal lines
      const scale = y / (this.height - VANISH_Y);
      const drawY = VANISH_Y + y * scale;

      ctx.beginPath();
      ctx.moveTo(0, drawY);
      ctx.lineTo(this.width, drawY);
      ctx.stroke();
    }
  }

  drawObstacle(ctx, obs) {
    // Calculate scale based on distance from Horizon
    const p = Math.max(0, (obs.y - VANISH_Y) / (this.height - VANISH_Y));
    const scale = 0.2 + p * 1.5;

    const w = obs.width * scale;
    const h = obs.height * scale;
    const x = this.width / 2; // Center lane only for simplicity
    const y = obs.y;

    this.drawCube(ctx, x, y, w, h, obs.color);
  }

  drawPlayer(ctx) {
    const x = this.player.x;
    const y = FLOOR_Y;
    const zOffset = this.player.z;
    const w = this.player.width;
    const h = this.player.height;

    // Player Shadow
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.ellipse(x, y, w / 1.5, w / 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player Cube
    this.drawCube(ctx, x, y - zOffset, w, h, "#f43f5e");

    // Trail engine glow
    if (this.player.isGrounded) {
      ctx.fillStyle = "rgba(244, 63, 94, 0.5)";
      ctx.beginPath();
      ctx.arc(x, y - zOffset + 10, 15 + Math.random() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCube(ctx, x, y, width, height, color) {
    ctx.save();
    ctx.translate(x, y);

    // Front Face
    ctx.fillStyle = color;
    ctx.fillRect(-width / 2, -height, width, height);

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-width / 2, -height, width, height);

    // Top Face (Isometric hack)
    ctx.fillStyle = this.adjustColor(color, 40); // Lighter
    ctx.beginPath();
    ctx.moveTo(-width / 2, -height);
    ctx.lineTo(-width / 2 + 15, -height - 10);
    ctx.lineTo(width / 2 + 15, -height - 10);
    ctx.lineTo(width / 2, -height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Face
    ctx.fillStyle = this.adjustColor(color, -40); // Darker
    ctx.beginPath();
    ctx.moveTo(width / 2, -height);
    ctx.lineTo(width / 2 + 15, -height - 10);
    ctx.lineTo(width / 2 + 15, -10);
    ctx.lineTo(width / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  adjustColor(color, amount) {
    return color; // Simplification, in a real env use HSL parsing or hex parsing
  }
}

const game = new VoxRunner();
window.game = game;
game.start();
