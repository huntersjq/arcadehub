import { Game, Vector } from "../shared/engine.js";

class BulletHeaven extends Game {
  constructor() {
    super("gameCanvas");
    this.loadPersistentData();
    this.reset();
    this.updateMenuUI();
  }

  reset() {
    this.player = {
      pos: new Vector(this.width / 2, this.height / 2),
      speed: 240,
      radius: 12,
      hp: 100,
      maxHp: 100,
      trail: [],
      gravityRange: 150,
      gravityPull: 40,
      evolution: "none",
      satellites: [],
    };
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.stars = this.createStars(200);
    this.nebulas = this.createNebulas(5);
    this.score = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = 100;

    this.lastFireTime = 0;
    this.fireRate = 0.35;
    this.spawnTimer = 0;
    this.spawnInterval = 1.2;
    this.gameTime = 0;

    this.isPaused = false;
    this.gameState = "menu"; // "menu", "playing", "paused", "gameover"
    this.bossActive = false;
    this.nextBossTime = 60; // Every 60 seconds

    // Visual FX State
    this.screenShake = 0;
    this.shockwaves = [];
    this.particles = [];
    this.debris = [];

    // Achievement Tracking
    this.stats = {
      kills: 0,
      debris: 0,
      level: 1,
      time: 0,
    };
    this.unlockedAchievements = new Set();
    this.achievementThresholds = [
      {
        id: "first_blood",
        label: "MILESTONE: FIRST CONTACT",
        check: () => this.stats.kills >= 1,
      },
      {
        id: "survivor_1",
        label: "MILESTONE: STEADY PULSE (1 MIN)",
        check: () => this.gameTime >= 60,
      },
      {
        id: "salvager",
        label: "MILESTONE: SCRAP COLLECTOR",
        check: () => this.stats.debris >= 10,
      },
      {
        id: "boss_killer",
        label: "MILESTONE: PLANET BREAKER",
        check: () => this.stats.bossesKilled >= 1,
      },
      {
        id: "level_10",
        label: "MILESTONE: STELLAR ASCENSION",
        check: () => this.level >= 10,
      },
    ];

    this.stats.bossesKilled = 0;
    this.statsCommited = { kills: 0, debris: 0, bossesKilled: 0 };

    // Restore permanently unlocked achievements to avoid re-triggering
    this.persistentData.achievements.forEach((id) =>
      this.unlockedAchievements.add(id),
    );

    this.updateUI();
  }

  loadPersistentData() {
    const data = localStorage.getItem("neon_survivor_records");
    this.persistentData = data
      ? JSON.parse(data)
      : {
          totalKills: 0,
          totalDebris: 0,
          highestLevel: 0,
          longestSurvival: 0,
          bossesKilled: 0,
          achievements: [],
        };
  }

  savePersistentData() {
    const deltaKills = this.stats.kills - this.statsCommited.kills;
    const deltaDebris = this.stats.debris - this.statsCommited.debris;
    const deltaBosses =
      this.stats.bossesKilled - this.statsCommited.bossesKilled;

    this.persistentData.totalKills += deltaKills;
    this.persistentData.totalDebris += deltaDebris;
    this.persistentData.bossesKilled += deltaBosses;

    this.statsCommited.kills = this.stats.kills;
    this.statsCommited.debris = this.stats.debris;
    this.statsCommited.bossesKilled = this.stats.bossesKilled;

    this.persistentData.highestLevel = Math.max(
      this.persistentData.highestLevel,
      this.level,
    );
    this.persistentData.longestSurvival = Math.max(
      this.persistentData.longestSurvival,
      this.gameTime,
    );

    const currentUnlocks = Array.from(this.unlockedAchievements);
    this.persistentData.achievements = Array.from(
      new Set([...this.persistentData.achievements, ...currentUnlocks]),
    );

    localStorage.setItem(
      "neon_survivor_records",
      JSON.stringify(this.persistentData),
    );
    this.updateMenuUI();
  }

  updateMenuUI() {
    const container = document.getElementById("globalStats");
    if (!container) return;

    const time = Math.floor(this.persistentData.longestSurvival);
    const mins = Math.floor(time / 60)
      .toString()
      .padStart(2, "0");
    const secs = (time % 60).toString().padStart(2, "0");

    container.innerHTML = `
      <div>TOTAL NEUTRALIZED: <b>${this.persistentData.totalKills}</b></div>
      <div>HIGHEST SYSTEM LEVEL: <b>${this.persistentData.highestLevel}</b></div>
      <div>LONGEST SURVIVAL: <b>${mins}:${secs}</b></div>
      <div class="achievement-grid">
        ${this.achievementThresholds
          .map(
            (ach) => `
          <div class="ach-icon ${this.persistentData.achievements.includes(ach.id) ? "unlocked" : ""}" title="${ach.label}">
            ${this.persistentData.achievements.includes(ach.id) ? "★" : "○"}
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  startGame() {
    this.reset();
    this.gameState = "playing";
    document.getElementById("mainMenu").style.display = "none";
    document.getElementById("pauseMenu").style.display = "none";
    document.getElementById("ui").style.display = "flex";
    document.getElementById("xpBar").style.display = "block";
    document.getElementById("menuToggle").style.display = "block";

    const toast = document.getElementById("controlsToast");
    toast.style.display = "block";
    setTimeout(() => (toast.style.display = "none"), 5000);
  }

  togglePause() {
    if (this.gameState === "playing") {
      this.isPaused = true;
      this.gameState = "paused";
      document.getElementById("pauseMenu").style.display = "flex";
    } else if (this.gameState === "paused") {
      this.resumeGame();
    }
  }

  resumeGame() {
    this.isPaused = false;
    this.gameState = "playing";
    document.getElementById("pauseMenu").style.display = "none";
    this.lastTime = performance.now();
  }

  quitToMenu() {
    this.savePersistentData();
    this.gameState = "menu";
    document.getElementById("pauseMenu").style.display = "none";
    document.getElementById("ui").style.display = "none";
    document.getElementById("xpBar").style.display = "none";
    document.getElementById("menuToggle").style.display = "none";
    document.getElementById("mainMenu").style.display = "flex";
    document.getElementById("upgradeOverlay").style.display = "none";
  }

  createStars(count) {
    let stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2,
        opacity: Math.random() * 0.8 + 0.2,
        parallax: Math.random() * 0.5 + 0.1,
      });
    }
    return stars;
  }

  createNebulas(count) {
    let nebulas = [];
    const colors = [
      "rgba(0, 71, 255, 0.05)", // Deep Blue
      "rgba(168, 85, 247, 0.05)", // Purple
      "rgba(0, 242, 255, 0.05)", // Cyan
      "rgba(236, 72, 153, 0.05)", // Pink
    ];
    for (let i = 0; i < count; i++) {
      nebulas.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: 200 + Math.random() * 300,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    return nebulas;
  }

  updateUI() {
    document.getElementById("lvlValue").innerText = this.level
      .toString()
      .padStart(2, "0");
    document.getElementById("killValue").innerText = this.score
      .toString()
      .padStart(3, "0");

    const xpPercent = (this.xp / this.xpToNext) * 100;
    document.getElementById("xpBar").style.width = `${xpPercent}%`;

    const mins = Math.floor(this.gameTime / 60);
    const secs = Math.floor(this.gameTime % 60);
    document.getElementById("timer").innerText = `${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  showEvolutionChoices() {
    this.isPaused = true;
    const overlay = document.getElementById("upgradeOverlay");
    const choicesContainer = document.getElementById("upgradeChoices");
    overlay.style.display = "flex";
    choicesContainer.innerHTML = "";

    const paths = [
      {
        id: "gravity",
        name: "Singularity",
        desc: "Increase gravitational pull range and strength. Sucks enemies into your atmosphere.",
        icon: "🕳️",
      },
      {
        id: "satellites",
        name: "Orbital Ring",
        desc: "Add a defensive satellite that orbits you and damages nearby enemies.",
        icon: "🛰️",
      },
      {
        id: "nova",
        name: "Supernova",
        desc: "Your fire rate reaches critical levels. High risk, high reward.",
        icon: "💥",
      },
    ];

    paths.forEach((path) => {
      const card = document.createElement("div");
      card.className = "upgrade-card";
      card.innerHTML = `
                <div style="font-size: 3rem; margin-bottom: 1rem;">${path.icon}</div>
                <h3>${path.name}</h3>
                <p>${path.desc}</p>
            `;
      card.onclick = () => this.evolve(path.id);
      choicesContainer.appendChild(card);
    });
  }

  evolve(pathId) {
    if (pathId === "gravity") {
      this.player.gravityRange += 50;
      this.player.gravityPull += 20;
    } else if (pathId === "satellites") {
      this.player.satellites.push({
        angle: Math.random() * Math.PI * 2,
        dist: 40 + this.player.satellites.length * 15,
        radius: 5,
        speed: 3 + Math.random() * 2,
      });
    } else if (pathId === "nova") {
      this.fireRate *= 0.7;
      this.player.speed *= 1.1;
    }

    document.getElementById("upgradeOverlay").style.display = "none";
    this.isPaused = false;
    this.lastTime = performance.now(); // Reset time to avoid huge DT jump
  }

  spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    const offset = 100;

    if (side === 0) {
      x = Math.random() * this.width;
      y = -offset;
    } else if (side === 1) {
      x = this.width + offset;
      y = Math.random() * this.height;
    } else if (side === 2) {
      x = Math.random() * this.width;
      y = this.height + offset;
    } else {
      x = -offset;
      y = Math.random() * this.height;
    }

    const isBoss = !this.bossActive && this.gameTime > this.nextBossTime;

    if (isBoss) {
      this.bossActive = true;
      this.nextBossTime += 60;
      const alert = document.getElementById("bossAlert");
      alert.style.display = "block";
      setTimeout(() => (alert.style.display = "none"), 3000);

      this.enemies.push({
        pos: new Vector(x, y),
        speed: 40,
        radius: 45,
        hp: 60 + this.level * 25,
        maxHp: 60 + this.level * 25,
        isBoss: true,
        trail: [],
        color: "#FF00E5",
        features: ["ring", "atmosphere"],
      });
    } else {
      // Enemy variety: different classes
      const roll = Math.random();
      let type;
      if (roll < 0.15) {
        // Tank
        type = {
          radius: 15,
          speed: 40,
          hp: 3,
          color: "#FF4D00",
          label: "TANK",
          features: ["atmosphere"],
        };
      } else if (roll < 0.3) {
        // Scout
        type = {
          radius: 5,
          speed: 120,
          hp: 1,
          color: "#FFCC00",
          label: "SCOUT",
          features: [],
        };
      } else {
        // Standard
        const colors = ["#FF00E5", "#A855F7", "#ec4899"];
        type = {
          radius: 8 + Math.random() * 5,
          speed: 60 + this.level * 5,
          hp: 1 + Math.floor(this.level / 5),
          color: colors[Math.floor(Math.random() * colors.length)],
          features: Math.random() > 0.8 ? ["ring"] : [],
        };
      }

      this.enemies.push({
        pos: new Vector(x, y),
        speed: type.speed,
        radius: type.radius,
        hp: type.hp,
        trail: [],
        color: type.color,
        features: type.features,
        angle: Math.random() * Math.PI * 2, // For visual rotation
      });
    }
  }

  fireBullet() {
    if (this.enemies.length === 0) return;

    let nearest = null;
    let minDist = 700;

    this.enemies.forEach((en) => {
      const d = Vector.dist(this.player.pos, en.pos);
      if (d < minDist) {
        minDist = d;
        nearest = en;
      }
    });

    if (nearest) {
      const dir = new Vector(
        nearest.pos.x - this.player.pos.x,
        nearest.pos.y - this.player.pos.y,
      ).normalize();
      this.bullets.push({
        pos: new Vector(this.player.pos.x, this.player.pos.y),
        vel: dir.mult(600),
        radius: 4,
        trail: [],
        color: "#00F2FF",
      });

      // Muzzle flash
      this.createExplosion(
        this.player.pos.x,
        this.player.pos.y,
        "#00F2FF",
        5,
        0.5,
      );
    }
  }

  createExplosion(x, y, color, count = 15, sizeMult = 2) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 200 + 100;
      this.particles.push({
        pos: new Vector(x, y),
        vel: new Vector(Math.cos(angle) * speed, Math.sin(angle) * speed),
        life: 1.0,
        color: color,
        size: (Math.random() * 3 + 1) * sizeMult,
      });
    }

    // Add shockwave
    this.shockwaves.push({
      pos: new Vector(x, y),
      radius: 0,
      maxRadius: 100 * (sizeMult / 2),
      life: 1.0,
      color: color,
    });

    // Screen shake for large explosions
    if (sizeMult > 1.5)
      this.screenShake = Math.min(12, this.screenShake + sizeMult * 3);
  }

  update(dt) {
    if (this.gameState === "menu") return;
    if (this.input.isPressed("Escape")) {
      if (this.gameState === "playing") {
        this.isPaused = true;
        this.gameState = "paused";
        document.getElementById("pauseMenu").style.display = "flex";
      }
    }

    if (this.isPaused) return;
    this.gameTime += dt;

    // Player movement
    const move = new Vector(0, 0);
    if (this.input.isPressed("w") || this.input.isPressed("ArrowUp"))
      move.y -= 1;
    if (this.input.isPressed("s") || this.input.isPressed("ArrowDown"))
      move.y += 1;
    if (this.input.isPressed("a") || this.input.isPressed("ArrowLeft"))
      move.x -= 1;
    if (this.input.isPressed("d") || this.input.isPressed("ArrowRight"))
      move.x += 1;

    if (move.mag() > 0) {
      this.player.pos.add(move.normalize().mult(this.player.speed * dt));
    } else if (this.input.mouse.isDown) {
      // Touch/Mouse movement
      const target = new Vector(this.input.mouse.x, this.input.mouse.y);
      const toMouse = new Vector(
        target.x - this.player.pos.x,
        target.y - this.player.pos.y,
      );
      if (toMouse.mag() > 5) {
        this.player.pos.add(toMouse.normalize().mult(this.player.speed * dt));
      }
    }

    this.player.pos.x = Math.max(0, Math.min(this.width, this.player.pos.x));
    this.player.pos.y = Math.max(0, Math.min(this.height, this.player.pos.y));

    this.updateTrail(this.player);

    // Satellites
    this.player.satellites.forEach((sat) => {
      sat.angle += sat.speed * dt;
    });

    // Spawning
    this.spawnTimer += dt;
    if (this.spawnTimer > this.spawnInterval) {
      this.spawnEnemy();
      this.spawnTimer = 0;
      this.spawnInterval = Math.max(0.15, 1.2 - (this.gameTime / 60) * 0.4);
    }

    // Auto-fire
    this.lastFireTime += dt;
    if (this.lastFireTime > this.fireRate) {
      this.fireBullet();
      this.lastFireTime = 0;
    }

    // Update Bullets
    this.bullets.forEach((b, i) => {
      b.pos.add(new Vector(b.vel.x * dt, b.vel.y * dt));
      this.updateTrail(b);
      if (
        b.pos.x < -100 ||
        b.pos.x > this.width + 100 ||
        b.pos.y < -100 ||
        b.pos.y > this.height + 100
      ) {
        this.bullets.splice(i, 1);
      }
    });

    // Update Enemies
    this.enemies.forEach((en, i) => {
      let moveDir = new Vector(
        this.player.pos.x - en.pos.x,
        this.player.pos.y - en.pos.y,
      );
      let distToPlayer = moveDir.mag();
      moveDir = moveDir.normalize();

      // Native Movement
      en.pos.add(moveDir.mult(en.speed * dt));

      // Gravity Pull Effect
      if (distToPlayer < this.player.gravityRange) {
        const pullStrength =
          (1 - distToPlayer / this.player.gravityRange) *
          this.player.gravityPull;
        en.pos.add(
          new Vector(
            moveDir.x * pullStrength * dt,
            moveDir.y * pullStrength * dt,
          ),
        );

        // Add tiny particles for visual "pull"
        if (Math.random() < 0.1) {
          this.particles.push({
            pos: new Vector(en.pos.x, en.pos.y),
            vel: moveDir.mult(100),
            life: 0.3,
            color: "#00F2FF",
            size: 1,
          });
        }
      }

      this.updateTrail(en);

      // Satellite Collision
      this.player.satellites.forEach((sat) => {
        const satX = this.player.pos.x + Math.cos(sat.angle) * sat.dist;
        const satY = this.player.pos.y + Math.sin(sat.angle) * sat.dist;
        if (
          Vector.dist(en.pos, new Vector(satX, satY)) <
          en.radius + sat.radius + 5
        ) {
          en.hp -= 0.1; // Continuous burn
          if (en.hp <= 0) this.killEnemy(en, i);
        }
      });

      // Bullet collision
      this.bullets.forEach((b, bi) => {
        if (Vector.dist(en.pos, b.pos) < en.radius + b.radius + 10) {
          en.hp--;
          en.hitFlash = 0.1; // Momentary color change
          this.bullets.splice(bi, 1);
          if (en.hp <= 0) {
            this.killEnemy(en, i);
          } else {
            // Impact spark
            this.createExplosion(b.pos.x, b.pos.y, "#FFFFFF", 3, 0.4);
          }
        }
      });

      // Player collision (GameOver/Reset)
      if (distToPlayer < en.radius + this.player.radius + 5) {
        this.savePersistentData();
        this.createExplosion(
          this.player.pos.x,
          this.player.pos.y,
          "#00F2FF",
          40,
          4,
        );
        setTimeout(() => this.startGame(), 100); // Small delay to see explosion
      }
    });

    // Update debris (float and pull)
    this.debris.forEach((d, i) => {
      d.pos.add(new Vector(d.vel.x * dt, d.vel.y * dt));
      d.angle += d.rotSpeed * dt;

      const dist = Vector.dist(this.player.pos, d.pos);
      if (dist < this.player.gravityRange) {
        const pull = (1 - dist / this.player.gravityRange) * 150;
        const dir = new Vector(
          this.player.pos.x - d.pos.x,
          this.player.pos.y - d.pos.y,
        ).normalize();
        d.pos.add(dir.mult(pull * dt));

        if (dist < this.player.radius + 15) {
          this.collectDebris(i);
        }
      }

      // Border cleanup
      if (
        d.pos.x < -100 ||
        d.pos.x > this.width + 100 ||
        d.pos.y < -100 ||
        d.pos.y > this.height + 100
      ) {
        this.debris.splice(i, 1);
      }
    });

    // Update shockwaves
    this.shockwaves.forEach((sw, i) => {
      sw.life -= dt * 2.5;
      sw.radius += (sw.maxRadius - sw.radius) * 0.15;
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    });

    this.screenShake *= 0.9; // Decay shake factor
    if (this.screenShake < 0.1) this.screenShake = 0;

    // Update Particles
    this.particles.forEach((p, i) => {
      p.pos.add(new Vector(p.vel.x * dt, p.vel.y * dt));
      p.life -= dt * 1.5;
      if (p.life <= 0) this.particles.splice(i, 1);
    });

    this.checkAchievements();
    this.updateUI();
  }

  collectDebris(index) {
    const d = this.debris[index];
    this.debris.splice(index, 1);
    this.xp += 15;
    this.stats.debris++;
    this.createExplosion(d.pos.x, d.pos.y, "#FFFFFF", 5, 0.3);

    // Tiny UI feedback
    if (this.xp >= this.xpToNext) {
      this.levelUp();
    }
  }

  checkAchievements() {
    this.achievementThresholds.forEach((ach) => {
      if (!this.unlockedAchievements.has(ach.id) && ach.check()) {
        this.unlockedAchievements.add(ach.id);
        this.showAchievement(ach.label);
      }
    });
  }

  showAchievement(label) {
    const toast = document.getElementById("achievementNotify");
    toast.innerText = label;
    toast.style.display = "block";
    this.savePersistentData();
    setTimeout(() => {
      toast.style.display = "none";
    }, 4000);
  }

  levelUp() {
    this.level++;
    this.xp = 0;
    this.xpToNext *= 1.4;
    this.showEvolutionChoices();
  }

  killEnemy(en, index) {
    this.createExplosion(
      en.pos.x,
      en.pos.y,
      en.isBoss ? "#FF00E5" : "#FF00E5",
      en.isBoss ? 40 : 15,
      en.isBoss ? 5 : 2,
    );
    if (en.isBoss) {
      this.bossActive = false;
      this.xp += 500;
      this.screenShake = 15;
      this.stats.bossesKilled++;
    } else {
      this.xp += 25;
      // Drop debris
      if (Math.random() < 0.4) {
        this.spawnDebris(en.pos.x, en.pos.y);
      }
    }
    this.enemies.splice(index, 1);
    this.score++;
    this.stats.kills++;
    if (this.xp >= this.xpToNext) {
      this.levelUp();
    }
  }

  spawnDebris(x, y) {
    this.debris.push({
      pos: new Vector(x, y),
      vel: new Vector((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40),
      angle: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 2,
      size: 4 + Math.random() * 6,
    });
  }

  updateTrail(ent) {
    ent.trail.push({ x: ent.pos.x, y: ent.pos.y });
    if (ent.trail.length > 8) ent.trail.shift();
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    // Screen Shake Offset
    if (this.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake,
      );
    }

    // Background
    ctx.fillStyle = "#05050C";
    ctx.fillRect(-10, -10, this.width + 20, this.height + 20);

    // Nebulas
    ctx.globalCompositeOperation = "screen";
    this.nebulas.forEach((neb) => {
      const grad = ctx.createRadialGradient(
        neb.x,
        neb.y,
        0,
        neb.x,
        neb.y,
        neb.radius,
      );
      grad.addColorStop(0, neb.color);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Stars
    ctx.globalCompositeOperation = "source-over";
    this.stars.forEach((s) => {
      const sx =
        (s.x - (this.player.pos.x - this.width / 2) * s.parallax) % this.width;
      const sy =
        (s.y - (this.player.pos.y - this.height / 2) * s.parallax) %
        this.height;
      ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
      ctx.fillRect(
        sx < 0 ? sx + this.width : sx,
        sy < 0 ? sy + this.height : sy,
        s.size,
        s.size,
      );
    });

    // Shockwaves
    ctx.globalCompositeOperation = "lighter";
    this.shockwaves.forEach((sw) => {
      ctx.beginPath();
      ctx.arc(sw.pos.x, sw.pos.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = sw.life * 0.5;
      ctx.lineWidth = 4;
      ctx.stroke();
    });
    ctx.globalAlpha = 1.0;

    // Gravity Distortion Visual (Subtle)
    if (this.player.gravityPull > 40) {
      const grad = ctx.createRadialGradient(
        this.player.pos.x,
        this.player.pos.y,
        this.player.radius,
        this.player.pos.x,
        this.player.pos.y,
        this.player.gravityRange,
      );
      grad.addColorStop(0, "rgba(0, 242, 255, 0.08)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(
        this.player.pos.x,
        this.player.pos.y,
        this.player.gravityRange,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // Bullets & Trails
    this.bullets.forEach((b) => {
      this.drawTrail(ctx, b.trail, b.color || "#FFFFFF", b.radius);
      this.drawGlow(ctx, b.pos, b.radius + 8, b.color || "#FFFFFF");
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Enemies & Trails
    this.enemies.forEach((en) => {
      let color = en.color || "#FF00E5";
      if (en.hitFlash > 0) color = "#FFFFFF";

      this.drawTrail(ctx, en.trail, color, en.radius);
      this.drawPlanet(ctx, en.pos, en.radius, color, en.features, en.isBoss);

      if (en.isBoss) {
        // Boss HP Bar
        const barW = 100;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(en.pos.x - barW / 2, en.pos.y - en.radius - 25, barW, 8);
        ctx.fillStyle = en.color;
        ctx.fillRect(
          en.pos.x - barW / 2,
          en.pos.y - en.radius - 25,
          barW * (en.hp / en.maxHp),
          8,
        );
      }
    });

    // Satellites
    this.player.satellites.forEach((sat) => {
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = "#00F2FF";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.player.pos.x, this.player.pos.y, sat.dist, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      const sx = this.player.pos.x + Math.cos(sat.angle) * sat.dist;
      const sy = this.player.pos.y + Math.sin(sat.angle) * sat.dist;
      this.drawGlow(ctx, { x: sx, y: sy }, sat.radius * 3, "#00F2FF");
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(sx, sy, sat.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Player (Holo Core Planet)
    let pColor = "#00F2FF";
    if (this.player.evolution === "nova") pColor = "#FFCC00";
    if (this.player.evolution === "gravity") pColor = "#A855F7";

    this.drawPlanet(
      ctx,
      this.player.pos,
      this.player.radius,
      pColor,
      ["atmosphere", "core_ripple"],
      false,
    );

    // Particles
    this.particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.size || 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Debris
    this.debris.forEach((d) => {
      ctx.save();
      ctx.translate(d.pos.x, d.pos.y);
      ctx.rotate(d.angle);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      // Jagged triangle/shard
      ctx.moveTo(0, -d.size);
      ctx.lineTo(d.size, d.size);
      ctx.lineTo(-d.size, d.size);
      ctx.closePath();
      ctx.stroke();

      // Core glow for debris
      this.drawGlow(ctx, { x: 0, y: 0 }, d.size * 2, "#00F2FF44");
      ctx.restore();
    });

    ctx.restore();

    // Scanline / Interference Holo Overlay
    this.drawHoloOverlay(ctx);
  }

  drawHoloOverlay(ctx) {
    if (this.gameState !== "playing") return;
    const time = performance.now() / 1000;

    // Horizontal Scanlines
    ctx.fillStyle = "rgba(0, 242, 255, 0.04)";
    for (let i = 0; i < this.height; i += 5) {
      const drift = Math.sin(time * 2 + i * 0.05) * 5;
      ctx.fillRect(0, i + drift, this.width, 1);
    }

    // Technical Margin Grain (Subtle)
    if (Math.random() > 0.97) {
      ctx.fillStyle = "rgba(0, 242, 255, 0.08)";
      ctx.fillRect(0, Math.random() * this.height, this.width, 1);
    }
  }

  drawPlanet(ctx, pos, radius, color, features = [], isBoss = false) {
    const time = performance.now() / 1000;

    // 1. Atmosphere / Glow
    if (features.includes("atmosphere")) {
      const grad = ctx.createRadialGradient(
        pos.x,
        pos.y,
        radius,
        pos.x,
        pos.y,
        radius * 2.5,
      );
      grad.addColorStop(0, color + "44");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      this.drawGlow(ctx, pos, radius + 15, color);
    }

    // 2. Rings
    if (features.includes("ring")) {
      ctx.strokeStyle = color + "88";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(
        pos.x,
        pos.y,
        radius * 2.2,
        radius * 0.6,
        Math.PI / 4,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }

    // 3. Core Ripple
    if (features.includes("core_ripple")) {
      ctx.strokeStyle = color + "66";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + Math.sin(time * 5) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Solid Body
    const bodyGrad = ctx.createRadialGradient(
      pos.x - radius * 0.3,
      pos.y - radius * 0.3,
      0,
      pos.x,
      pos.y,
      radius,
    );
    bodyGrad.addColorStop(0, "#FFFFFF");
    bodyGrad.addColorStop(0.2, color);
    bodyGrad.addColorStop(1, "#000000");

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // 5. Boss Detail
    if (isBoss) {
      ctx.strokeStyle = "#FFFFFF44";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * (0.4 + i * 0.2), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  drawTrail(ctx, trail, color, width) {
    if (trail.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < trail.length; i++) {
      const alpha = i / trail.length;
      ctx.globalAlpha = alpha * 0.4;
      if (i === 0) ctx.moveTo(trail[i].x, trail[i].y);
      else ctx.lineTo(trail[i].x, trail[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  drawGlow(ctx, pos, radius, color) {
    const grad = ctx.createRadialGradient(
      pos.x,
      pos.y,
      0,
      pos.x,
      pos.y,
      radius,
    );
    grad.addColorStop(0, color);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

const game = new BulletHeaven();
window.game = game; // Make accessible globally for debugging
game.start();
