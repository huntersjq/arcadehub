/**
 * Game Template — Arcade Hub
 * Copy this directory and customize to create a new game.
 *
 * Steps:
 * 1. Copy /games/template/ to /games/your-game-slug/
 * 2. Update index.html title and start screen text
 * 3. Implement update() and draw() below
 * 4. Add entry to gameRegistry in /hub/data.js
 * 5. Add localStorage key to statsKeys in the registry entry
 */

import { Game } from "../shared/engine.js";

const HIGHSCORE_KEY = "your_game_highscores";

class MyGame extends Game {
  constructor() {
    super("gameCanvas");
    this.score = 0;
    this.playing = false;
  }

  start() {
    this.score = 0;
    this.playing = true;
    document.getElementById("startScreen").style.display = "none";
    document.getElementById("gameOver").style.display = "none";
    document.getElementById("hud").style.display = "flex";
    this.lastTime = performance.now();
    super.start();
  }

  restart() {
    this.start();
  }

  update(dt) {
    if (!this.playing) return;

    // --- Game logic here ---
    // Use this.input for keyboard/mouse/touch
    // dt is delta time in seconds

    // Example: increment score over time
    this.score += Math.floor(dt * 10);

    this.updateUI();
  }

  draw(ctx) {
    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, this.width, this.height);

    if (!this.playing) return;

    // --- Draw game objects here ---
    // this.width and this.height are the canvas dimensions

    // Example: draw a centered circle
    ctx.fillStyle = "#6366f1";
    ctx.beginPath();
    ctx.arc(this.width / 2, this.height / 2, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  triggerGameOver() {
    this.playing = false;
    const coinsEarned = Math.floor(this.score / 100);
    if (window.ArcadeHub) window.ArcadeHub.addCoins(coinsEarned);
    this.saveHighScore();
    document.getElementById("hud").style.display = "none";
    document.getElementById("gameOver").style.display = "flex";
    document.getElementById("finalScore").innerText = this.score;
  }

  saveHighScore() {
    let scores = [];
    try {
      scores = JSON.parse(localStorage.getItem(HIGHSCORE_KEY) || "[]");
    } catch (_) {
      scores = [];
    }
    scores.push({
      score: this.score,
      date: new Date().toLocaleDateString(),
    });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(scores.slice(0, 5)));
  }

  updateUI() {
    const el = document.getElementById("score");
    if (el) el.innerText = this.score;
  }
}

const game = new MyGame();
window.game = game;
