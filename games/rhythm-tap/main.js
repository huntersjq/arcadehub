/**
 * Pulse Beat — Rhythm Tap Game
 * Procedurally generated notes fall in 4 lanes. Tap on beat for points.
 * Uses Web Audio API for sound synthesis — no audio files needed.
 */

const LANE_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];
const LANE_KEYS = ["d", "f", "j", "k"];
const HIGHSCORE_KEY = "pulse_beat_highscores";

class PulseBeat {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.playing = false;
    this.audioCtx = null;

    this.resize();
    window.addEventListener("resize", () => this.resize());

    document.getElementById("playBtn").addEventListener("click", () => this.startGame());
    document.getElementById("retryBtn").addEventListener("click", () => this.startGame());

    // Keyboard input
    document.addEventListener("keydown", (e) => {
      const lane = LANE_KEYS.indexOf(e.key.toLowerCase());
      if (lane !== -1 && this.playing) this.hitLane(lane);
    });

    // Touch/mouse input
    this.canvas.addEventListener("pointerdown", (e) => {
      if (!this.playing) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * this.canvas.width;
      const laneWidth = this.canvas.width / 4;
      const lane = Math.min(3, Math.floor(x / laneWidth));
      this.hitLane(lane);
    });

    this.drawIdle();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.displayWidth = rect.width;
    this.displayHeight = rect.height;
  }

  drawIdle() {
    const ctx = this.ctx;
    ctx.fillStyle = "#08080e";
    ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);
  }

  startGame() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hits = 0;
    this.misses = 0;
    this.totalNotes = 0;
    this.notes = [];
    this.particles = [];
    this.flashLanes = [0, 0, 0, 0]; // flash intensity per lane
    this.judgments = []; // floating judgment text
    this.playing = true;
    this.gameTime = 0;
    this.songDuration = 60; // 60 second song
    this.bpm = 120;
    this.noteSpeed = 350; // pixels per second
    this.lastSpawnBeat = -1;
    this.lastTime = performance.now();

    // Generate note pattern
    this.generateSong();

    document.getElementById("startScreen").style.display = "none";
    document.getElementById("gameOverScreen").style.display = "none";
    document.getElementById("hud").style.display = "flex";

    this.loop();
  }

  generateSong() {
    // Procedural pattern: spawn notes on beats with increasing complexity
    const beatInterval = 60 / this.bpm;
    const totalBeats = Math.floor(this.songDuration / beatInterval);
    this.spawnQueue = [];

    for (let beat = 4; beat < totalBeats; beat++) {
      const time = beat * beatInterval;
      const difficulty = Math.min(time / this.songDuration, 1);

      // Base: one note per beat on random lane
      if (Math.random() < 0.6 + difficulty * 0.3) {
        const lane = Math.floor(Math.random() * 4);
        this.spawnQueue.push({ time, lane });
        this.totalNotes++;

        // Sometimes add a second note (doubles) as difficulty increases
        if (Math.random() < difficulty * 0.3) {
          let lane2 = (lane + 1 + Math.floor(Math.random() * 3)) % 4;
          this.spawnQueue.push({ time, lane: lane2 });
          this.totalNotes++;
        }
      }

      // Off-beat notes at higher difficulty
      if (difficulty > 0.4 && Math.random() < difficulty * 0.25) {
        const halfBeatTime = time + beatInterval / 2;
        if (halfBeatTime < this.songDuration) {
          const lane = Math.floor(Math.random() * 4);
          this.spawnQueue.push({ time: halfBeatTime, lane });
          this.totalNotes++;
        }
      }
    }

    this.spawnQueue.sort((a, b) => a.time - b.time);
    this.spawnIndex = 0;
  }

  loop() {
    if (!this.playing) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.gameTime += dt;

    this.update(dt);
    this.draw();

    if (this.gameTime >= this.songDuration + 2) {
      this.endGame();
      return;
    }

    requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    const hitY = this.displayHeight - 80;
    const spawnLeadTime = hitY / this.noteSpeed;

    // Spawn notes from queue
    while (
      this.spawnIndex < this.spawnQueue.length &&
      this.spawnQueue[this.spawnIndex].time - spawnLeadTime <= this.gameTime
    ) {
      const note = this.spawnQueue[this.spawnIndex];
      this.notes.push({
        lane: note.lane,
        targetTime: note.time,
        y: 0,
        hit: false,
        missed: false,
      });
      this.spawnIndex++;
    }

    // Move notes
    for (const note of this.notes) {
      const timeDiff = note.targetTime - this.gameTime;
      note.y = hitY - timeDiff * this.noteSpeed;

      // Miss detection
      if (!note.hit && !note.missed && note.y > hitY + 60) {
        note.missed = true;
        this.misses++;
        this.combo = 0;
        this.addJudgment(note.lane, "MISS", "#ef4444");
      }
    }

    // Remove notes far past the hit zone
    this.notes = this.notes.filter((n) => n.y < this.displayHeight + 50);

    // Decay lane flash
    for (let i = 0; i < 4; i++) {
      this.flashLanes[i] = Math.max(0, this.flashLanes[i] - dt * 5);
    }

    // Update judgments
    this.judgments = this.judgments.filter((j) => {
      j.age += dt;
      j.y -= dt * 40;
      j.opacity = Math.max(0, 1 - j.age / 0.8);
      return j.age < 0.8;
    });

    // Update particles
    this.particles = this.particles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      return p.life > 0;
    });

    this.updateHUD();
  }

  hitLane(lane) {
    const hitY = this.displayHeight - 80;
    let closestNote = null;
    let closestDist = Infinity;

    for (const note of this.notes) {
      if (note.hit || note.missed || note.lane !== lane) continue;
      const dist = Math.abs(note.y - hitY);
      if (dist < closestDist) {
        closestDist = dist;
        closestNote = note;
      }
    }

    this.flashLanes[lane] = 1;

    if (closestNote && closestDist < 80) {
      closestNote.hit = true;
      this.hits++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      // Judgment based on accuracy
      let judgment, points, color;
      if (closestDist < 15) {
        judgment = "PERFECT";
        points = 300;
        color = "#fbbf24";
      } else if (closestDist < 35) {
        judgment = "GREAT";
        points = 200;
        color = "#22c55e";
      } else if (closestDist < 55) {
        judgment = "GOOD";
        points = 100;
        color = "#3b82f6";
      } else {
        judgment = "OK";
        points = 50;
        color = "#8888a0";
      }

      // Combo multiplier
      const multiplier = 1 + Math.floor(this.combo / 10) * 0.25;
      this.score += Math.floor(points * multiplier);

      this.addJudgment(lane, judgment, color);
      this.spawnHitParticles(lane, color);
      this.playHitSound(lane);
    } else {
      // Empty hit
      this.combo = 0;
    }
  }

  addJudgment(lane, text, color) {
    const laneWidth = this.displayWidth / 4;
    this.judgments.push({
      x: laneWidth * lane + laneWidth / 2,
      y: this.displayHeight - 120,
      text,
      color,
      age: 0,
      opacity: 1,
    });
  }

  spawnHitParticles(lane, color) {
    const laneWidth = this.displayWidth / 4;
    const cx = laneWidth * lane + laneWidth / 2;
    const cy = this.displayHeight - 80;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.3;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  playHitSound(lane) {
    if (!this.audioCtx) return;
    const frequencies = [261.6, 329.6, 392.0, 523.3]; // C4, E4, G4, C5
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequencies[lane];
    gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.15);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;
    const laneWidth = w / 4;
    const hitY = h - 80;

    // Background
    ctx.fillStyle = "#08080e";
    ctx.fillRect(0, 0, w, h);

    // Lane dividers
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(laneWidth * i, 0);
      ctx.lineTo(laneWidth * i, h);
      ctx.stroke();
    }

    // Lane flash
    for (let i = 0; i < 4; i++) {
      if (this.flashLanes[i] > 0) {
        ctx.fillStyle = LANE_COLORS[i] + Math.floor(this.flashLanes[i] * 25).toString(16).padStart(2, "0");
        ctx.fillRect(laneWidth * i, 0, laneWidth, h);
      }
    }

    // Hit zone line
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(w, hitY);
    ctx.stroke();

    // Hit zone indicators
    for (let i = 0; i < 4; i++) {
      const cx = laneWidth * i + laneWidth / 2;
      ctx.strokeStyle = LANE_COLORS[i] + "60";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, hitY, 20, 0, Math.PI * 2);
      ctx.stroke();

      // Key label
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = "600 12px 'JetBrains Mono'";
      ctx.textAlign = "center";
      ctx.fillText(LANE_KEYS[i].toUpperCase(), cx, hitY + 45);
    }

    // Notes
    for (const note of this.notes) {
      if (note.hit || note.missed) continue;
      const cx = laneWidth * note.lane + laneWidth / 2;
      const color = LANE_COLORS[note.lane];

      // Glow
      const grad = ctx.createRadialGradient(cx, note.y, 5, cx, note.y, 25);
      grad.addColorStop(0, color + "60");
      grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 25, note.y - 25, 50, 50);

      // Note circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, note.y, 14, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight
      ctx.fillStyle = "#ffffff40";
      ctx.beginPath();
      ctx.arc(cx, note.y - 3, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / 0.7;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Judgments
    for (const j of this.judgments) {
      ctx.globalAlpha = j.opacity;
      ctx.fillStyle = j.color;
      ctx.font = "800 16px 'Outfit'";
      ctx.textAlign = "center";
      ctx.fillText(j.text, j.x, j.y);
      if (this.combo > 1 && j.text !== "MISS") {
        ctx.font = "600 11px 'JetBrains Mono'";
        ctx.fillText(`${this.combo}x`, j.x, j.y + 18);
      }
    }
    ctx.globalAlpha = 1;

    // Progress bar at top
    const progress = Math.min(this.gameTime / this.songDuration, 1);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 0, w, 3);
    const grad = ctx.createLinearGradient(0, 0, w * progress, 0);
    grad.addColorStop(0, LANE_COLORS[0]);
    grad.addColorStop(1, LANE_COLORS[3]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w * progress, 3);
  }

  updateHUD() {
    document.getElementById("score").textContent = this.score.toLocaleString();
    document.getElementById("combo").textContent = this.combo;
    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    document.getElementById("accuracy").textContent = acc + "%";
  }

  endGame() {
    this.playing = false;
    const total = this.hits + this.misses;
    const accuracy = total > 0 ? Math.round((this.hits / total) * 100) : 0;

    // Grade
    let grade;
    if (accuracy >= 95 && this.misses <= 2) grade = "S";
    else if (accuracy >= 90) grade = "A";
    else if (accuracy >= 80) grade = "B";
    else if (accuracy >= 70) grade = "C";
    else grade = "D";

    const coinsEarned = Math.floor(this.score / 200);
    if (window.ArcadeHub) window.ArcadeHub.addCoins(coinsEarned);
    this.saveHighScore(accuracy, grade);

    document.getElementById("hud").style.display = "none";
    document.getElementById("gameOverScreen").style.display = "flex";
    document.getElementById("finalScore").textContent = this.score.toLocaleString();
    document.getElementById("maxCombo").textContent = this.maxCombo;
    document.getElementById("finalAccuracy").textContent = accuracy + "%";
    document.getElementById("gradeDisplay").textContent = "Grade: " + grade;
  }

  saveHighScore(accuracy, grade) {
    let scores = [];
    try {
      scores = JSON.parse(localStorage.getItem(HIGHSCORE_KEY) || "[]");
    } catch (_) {
      scores = [];
    }
    scores.push({
      score: this.score,
      accuracy,
      grade,
      date: new Date().toLocaleDateString(),
    });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(scores.slice(0, 5)));
  }
}

new PulseBeat();
