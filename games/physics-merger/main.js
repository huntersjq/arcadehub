import { Game, Vector } from "../shared/engine.js";

const PLANET_TYPES = [
  { radius: 15, color: "#FFFFFF", name: "MOON", mass: 1, xp: 10 },
  { radius: 25, color: "#FFA500", name: "MARS", mass: 1.5, xp: 20 },
  { radius: 35, color: "#00F2FF", name: "EARTH", mass: 2, xp: 40 },
  { radius: 45, color: "#BC13FE", name: "NEPTUNE", mass: 3, xp: 80 },
  { radius: 60, color: "#FFD700", name: "SATURN", mass: 4.5, xp: 160 },
  { radius: 75, color: "#FF4500", name: "JUPITER", mass: 6, xp: 320 },
  { radius: 95, color: "#FF1493", name: "SUPERNOVA", mass: 9, xp: 640 },
  { radius: 120, color: "#00FF00", name: "GALAXY", mass: 13, xp: 1280 },
];

class CosmicMerge extends Game {
  constructor() {
    super("gameCanvas");
    this.reset();
  }

  reset() {
    this.score = 0;
    this.entities = [];
    this.particles = [];
    this.floatingTexts = [];
    this.nextTypeIndex = this.getRandomStartType();
    this.dropCooldown = 0;
    this.gameOver = false;
    this.mousePos = new Vector(this.width / 2, 100);

    const starsJson = localStorage.getItem("cm_stars");
    this.stars = starsJson ? JSON.parse(starsJson) : this.createStars(150);
    if (!starsJson)
      localStorage.setItem("cm_stars", JSON.stringify(this.stars));

    this.nebulas = this.createNebulas(3);

    this.containerWidth = Math.min(600, this.width - 40);
    this.containerX = (this.width - this.containerWidth) / 2;
    this.containerY = 100;
    this.containerHeight = this.height - 150;

    this.gravity = 1000;
    this.updateUI();
    this.drawPreview();

    const goOverlay = document.getElementById("gameOver");
    if (goOverlay) goOverlay.style.display = "none";

    const toast = document.getElementById("controlsToast");
    if (toast) toast.style.opacity = "1";

    this.blackHoleCharge = 0;
    this.blackHoleMaxCharge = 100;
    this.blackHoleActive = false;
    this.blackHolePos = new Vector(0, 0);
    this.screenShake = 0;
    this.highScores = JSON.parse(localStorage.getItem("cm_highscores") || "[]");

    // Upgrades state
    this.upgrades = {
      fusion_bonus: 0,
      singularity_boost: 0,
      orbital_efficiency: 0,
      mass_reduction: 0,
    };
    this.initUpgrades();

    this.sessionTime = 0;
    this.supernovaMaxTime = 180;
    this.debrisTimer = 15;
    this.difficultyScale = 1.0;
  }

  initUpgrades() {
    this.upgradeDefinitions = [
      {
        id: "fusion_bonus",
        name: "Sub-atomic Fusion",
        desc: "+20% Merge Revenue",
        baseCost: 1500,
      },
      {
        id: "singularity_boost",
        name: "Stable Singularity",
        desc: "+15% Recharge Speed",
        baseCost: 1000,
      },
      {
        id: "orbital_efficiency",
        name: "Cosmic Magnet",
        desc: "+25% Orbital Revenue",
        baseCost: 500,
      },
      {
        id: "mass_reduction",
        name: "Mass Optimization",
        desc: "-5% Planetary Mass",
        baseCost: 2000,
      },
    ];
  }

  getRandomStartType() {
    return Math.floor(Math.random() * 3);
  }

  createStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2,
        opacity: Math.random(),
        speed: 5 + Math.random() * 15,
      });
    }
    return stars;
  }

  createNebulas(count) {
    const nebulas = [];
    for (let i = 0; i < count; i++) {
      nebulas.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: 200 + Math.random() * 300,
        color: i % 2 === 0 ? "#bc13fe11" : "#00f2ff11",
      });
    }
    return nebulas;
  }

  update(dt) {
    if (this.gameOver) return;

    // Clamp dt to avoid physics blowups
    dt = Math.min(dt, 0.033);

    this.dropCooldown -= dt;

    // Mouse tracking
    this.mousePos.x = this.input.mouse.x;
    const currentRadius = PLANET_TYPES[this.nextTypeIndex].radius;
    this.mousePos.x = Math.max(
      this.containerX + currentRadius,
      Math.min(
        this.containerX + this.containerWidth - currentRadius,
        this.mousePos.x,
      ),
    );

    if (this.input.mouse.isDown && this.dropCooldown <= 0) {
      this.dropPlanet();
      this.dropCooldown = Math.max(0.3, 0.6 - (this.sessionTime / 180) * 0.3);
    }

    this.sessionTime += dt;
    this.difficultyScale = 1 + (this.sessionTime / this.supernovaMaxTime) * 1.5;

    // Update Meters
    const stability = this.getStability();
    const stabFill = document.getElementById("stabilityFill");
    if (stabFill) {
      stabFill.style.width = stability * 100 + "%";
      stabFill.style.background =
        stability < 0.3 ? "#f43f5e" : stability < 0.6 ? "#fbbf24" : "#10b981";
    }

    const snFill = document.getElementById("supernovaFill");
    if (snFill)
      snFill.style.width =
        Math.min(100, (this.sessionTime / this.supernovaMaxTime) * 100) + "%";

    // Debris Spawning
    this.debrisTimer -= dt;
    if (this.debrisTimer <= 0) {
      this.spawnSpaceDebris();
      this.debrisTimer = Math.max(7, 20 - (this.sessionTime / 60) * 5);
    }

    const toast = document.getElementById("warningToast");
    if (this.debrisTimer < 2.5) {
      if (toast) toast.style.display = "block";
    } else {
      if (toast) toast.style.display = "none";
    }

    this.gravity = 1000 * (1 + (this.sessionTime / 300) * 1.0);

    this.updatePhysics(dt);
    this.updateParticles(dt);
    this.updateOrbitalXP(dt);
    this.updateFloatingTexts(dt);
    this.updatePowerups(dt);
    this.checkGameOver();

    if (this.screenShake > 0) this.screenShake -= dt * 10;
  }

  updatePowerups(dt) {
    if (!this.blackHoleActive) {
      const rechargeRate =
        10 * (1 + (this.upgrades?.singularity_boost || 0) * 0.15);
      this.blackHoleCharge = Math.min(
        this.blackHoleMaxCharge,
        this.blackHoleCharge + dt * rechargeRate,
      );
      const btn = document.getElementById("blackHoleBtn");
      const bar = document.getElementById("blackHoleCharge");
      if (btn && bar) {
        const pct = (this.blackHoleCharge / this.blackHoleMaxCharge) * 100;
        bar.style.width = pct + "%";
        btn.disabled = this.blackHoleCharge < this.blackHoleMaxCharge;
      }
    } else {
      this.blackHoleTimer -= dt;
      if (this.blackHoleTimer <= 0) {
        this.blackHoleActive = false;
      }

      // Pull entities
      this.entities.forEach((ent) => {
        const dx = this.blackHolePos.x - ent.pos.x;
        const dy = this.blackHolePos.y - ent.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 300) {
          const force = (300 - dist) * 10;
          ent.vel.x += (dx / dist) * force * dt;
          ent.vel.y += (dy / dist) * force * dt;

          // Consume if very close
          if (dist < 40) {
            ent.toConsume = true;
            this.score += 5;
            this.updateUI();
          }
        }
      });

      // Remove consumed
      for (let i = this.entities.length - 1; i >= 0; i--) {
        if (this.entities[i].toConsume) {
          this.createExplosion(
            this.entities[i].pos.x,
            this.entities[i].pos.y,
            "#bc13fe",
            5,
          );
          this.entities.splice(i, 1);
        }
      }
    }
  }

  getStability() {
    let overCount = 0;
    this.entities.forEach((ent) => {
      if (ent.pos.y - ent.radius < this.containerY + 100) overCount++;
    });
    return Math.max(0, 1 - overCount / 5);
  }

  spawnSpaceDebris() {
    this.screenShake = 10;
    const count = 1 + Math.floor(this.sessionTime / 90);
    for (let i = 0; i < count; i++) {
      const x = this.containerX + Math.random() * this.containerWidth;
      const radius = 15 + Math.random() * 15;
      this.entities.push({
        pos: new Vector(x, -50),
        vel: new Vector((Math.random() - 0.5) * 100, 200 + Math.random() * 300),
        radius: radius,
        typeIndex: -1, // -1 means Debris
        color: "#4e4e4e",
        mass: radius * 0.1,
        angle: Math.random() * Math.PI * 2,
        angularVel: (Math.random() - 0.5) * 10,
        inertia: (2 / 5) * (radius * 0.1) * radius * radius,
        decalAngle: Math.random() * Math.PI * 2,
        isDebris: true,
      });
    }
  }

  activateBlackHole() {
    if (this.blackHoleCharge >= this.blackHoleMaxCharge) {
      this.blackHoleActive = true;
      this.blackHoleCharge = 0;
      this.blackHoleTimer = 3.0; // 3 seconds of active pull
      this.blackHolePos = new Vector(
        this.containerX + this.containerWidth / 2,
        this.containerY + this.containerHeight / 2,
      );
      this.screenShake = 5;
      this.spawnFloatingText(
        this.blackHolePos.x,
        this.blackHolePos.y,
        "SINGULARITY ACTIVE",
        "#bc13fe",
      );
    }
  }

  updateOrbitalXP(dt) {
    this.entities.forEach((ent) => {
      const rotSpeed = Math.abs(ent.angularVel);
      if (rotSpeed > 1.5) {
        if (!ent.orbitalXPAccumulator) ent.orbitalXPAccumulator = 0;
        const efficiency = 1 + (this.upgrades?.orbital_efficiency || 0) * 0.25;
        ent.orbitalXPAccumulator += rotSpeed * dt * 0.5 * efficiency;

        if (ent.orbitalXPAccumulator >= 1) {
          const gain = Math.floor(ent.orbitalXPAccumulator);
          this.score += gain;
          ent.orbitalXPAccumulator -= gain;

          // Chance to spawn a floating "+1" or similar
          if (Math.random() < 0.1) {
            this.spawnFloatingText(
              ent.pos.x,
              ent.pos.y - ent.radius,
              `+${gain} ORBITAL`,
              "#00f2ff",
            );
          }
          this.updateUI();
        }
      } else {
        ent.orbitalXPAccumulator = 0;
      }
    });
  }

  spawnFloatingText(x, y, text, color) {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: 1.0,
      velY: -40,
    });
  }

  updateFloatingTexts(dt) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.velY * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  dropPlanet() {
    const toast = document.getElementById("controlsToast");
    if (toast) toast.style.opacity = "0";

    const typeIndex = this.nextTypeIndex;
    const type = PLANET_TYPES[typeIndex];

    const massReduction = 1 - (this.upgrades?.mass_reduction || 0) * 0.05;
    const mass = type.mass * massReduction;

    this.entities.push({
      pos: new Vector(this.mousePos.x, this.containerY + 20),
      vel: new Vector(0, 0),
      radius: type.radius,
      typeIndex: typeIndex,
      color: type.color,
      mass: mass,
      angle: 0,
      angularVel: 0,
      inertia: (2 / 5) * mass * type.radius * type.radius,
      decalAngle: Math.random() * Math.PI * 2,
      orbitalXPAccumulator: 0,
    });

    this.nextTypeIndex = this.getRandomStartType();
    this.drawPreview();
  }

  updatePhysics(dt) {
    const substeps = 8;
    const sdt = dt / substeps;

    for (let s = 0; s < substeps; s++) {
      // Integration
      for (let i = 0; i < this.entities.length; i++) {
        const ent = this.entities[i];

        ent.vel.y += this.gravity * sdt;
        ent.pos.x += ent.vel.x * sdt;
        ent.pos.y += ent.vel.y * sdt;
        ent.angle += ent.angularVel * sdt;

        // Damping (Increased angular damping for smoothness)
        ent.vel.x *= Math.pow(0.995, sdt * 60);
        ent.angularVel *= Math.pow(0.92, sdt * 60);

        // Cap angular velocity
        const maxAngular = 15;
        if (Math.abs(ent.angularVel) > maxAngular) {
          ent.angularVel = Math.sign(ent.angularVel) * maxAngular;
        }

        // Wall collisions
        if (ent.pos.x - ent.radius < this.containerX) {
          ent.pos.x = this.containerX + ent.radius;
          ent.vel.x *= -0.3;
          ent.angularVel += ent.vel.y * 0.005; // Reduced wall torque
        } else if (
          ent.pos.x + ent.radius >
          this.containerX + this.containerWidth
        ) {
          ent.pos.x = this.containerX + this.containerWidth - ent.radius;
          ent.vel.x *= -0.3;
          ent.angularVel -= ent.vel.y * 0.005; // Reduced wall torque
        }

        // Floor collision
        if (ent.pos.y + ent.radius > this.containerY + this.containerHeight) {
          ent.pos.y = this.containerY + this.containerHeight - ent.radius;
          ent.vel.y *= -0.15;
          ent.vel.x *= 0.95;
          ent.angularVel += ent.vel.x * 0.01; // Reduced floor torque
        }
      }

      // Circle collisions
      for (let i = 0; i < this.entities.length; i++) {
        for (let j = i + 1; j < this.entities.length; j++) {
          const a = this.entities[i];
          const b = this.entities[j];

          const dx = b.pos.x - a.pos.x;
          const dy = b.pos.y - a.pos.y;
          const distSq = dx * dx + dy * dy;
          const minSafeDist = a.radius + b.radius;

          if (distSq < minSafeDist * minSafeDist) {
            // Merge Check
            if (
              a.typeIndex === b.typeIndex &&
              a.typeIndex !== -1 &&
              a.typeIndex < PLANET_TYPES.length - 1
            ) {
              this.merge(i, j);
              return; // End sub-step
            }

            const dist = Math.sqrt(distSq) || 0.001;
            const nx = dx / dist;
            const ny = dy / dist;

            // Separation
            const overlap = minSafeDist - dist;
            const mSum = a.mass + b.mass;
            const ratioA = b.mass / mSum;
            const ratioB = a.mass / mSum;

            a.pos.x -= nx * overlap * ratioA;
            a.pos.y -= ny * overlap * ratioA;
            b.pos.x += nx * overlap * ratioB;
            b.pos.y += ny * overlap * ratioB;

            // Simple collision response for better stability
            // Relative velocity at contact point
            // V_contact = V + omega cross r
            // In 2D: V_contact = (V_x - omega*r_y, V_y + omega*r_x)
            // r for a is (nx*ra, ny*ra), for b is (-nx*rb, -ny*rb)
            const rax = nx * a.radius,
              ray = ny * a.radius;
            const rbx = -nx * b.radius,
              rby = -ny * b.radius;

            const vax = a.vel.x - a.angularVel * ray;
            const vay = a.vel.y + a.angularVel * rax;
            const vbx = b.vel.x - b.angularVel * rby;
            const vby = b.vel.y + b.angularVel * rbx;

            const rvx = vbx - vax;
            const rvy = vby - vay;

            const velAlongNormal = rvx * nx + rvy * ny;
            if (velAlongNormal > 0) continue;

            const e = 0.1; // Restitution
            let jImpulse = -(1 + e) * velAlongNormal;
            jImpulse /= 1 / a.mass + 1 / b.mass;

            const ix = nx * jImpulse;
            const iy = ny * jImpulse;

            a.vel.x -= ix / a.mass;
            a.vel.y -= iy / a.mass;
            b.vel.x += ix / b.mass;
            b.vel.y += iy / b.mass;

            // Friction/Torque
            const tx = -ny,
              ty = nx;
            const velAlongTangent = rvx * tx + rvy * ty;
            const mu = 0.06; // Significant reduction for smoothness
            let fImpulse = -velAlongTangent * mu;
            fImpulse /= 1 / a.mass + 1 / b.mass;

            const fIx = tx * fImpulse;
            const fIy = ty * fImpulse;

            a.vel.x -= fIx / a.mass;
            a.vel.y -= fIy / a.mass;
            b.vel.x += fIx / b.mass;
            b.vel.y += fIy / b.mass;

            a.angularVel -= (fImpulse * a.radius) / a.inertia;
            b.angularVel += (fImpulse * b.radius) / b.inertia;
          }
        }
      }
    }
  }

  merge(i, j) {
    const a = this.entities[i];
    const b = this.entities[j];
    const newX = (a.pos.x + b.pos.x) / 2;
    const newY = (a.pos.y + b.pos.y) / 2;
    const newTypeIndex = a.typeIndex + 1;

    const bonus = 1 + this.upgrades.fusion_bonus * 0.2;
    this.score += Math.floor(PLANET_TYPES[newTypeIndex].xp * bonus);
    this.updateUI();

    if (newTypeIndex >= 7) {
      // Galaxy fusion
      this.screenShake = 15;
      this.createExplosion(newX, newY, "#00f2ff", 50);
      this.spawnFloatingText(newX, newY, "GALAXY FORMED", "#00f2ff");
      // Supernova effect
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 200 + Math.random() * 400;
        this.particles.push({
          pos: new Vector(newX, newY),
          vel: new Vector(Math.cos(angle) * speed, Math.sin(angle) * speed),
          life: 2.0,
          color: "#FFFFFF",
          size: 4 + Math.random() * 6,
        });
      }
    } else {
      this.createExplosion(newX, newY, PLANET_TYPES[newTypeIndex].color, 15);
    }

    this.entities.splice(Math.max(i, j), 1);
    this.entities.splice(Math.min(i, j), 1);

    const type = PLANET_TYPES[newTypeIndex];
    const massReduction = 1 - (this.upgrades?.mass_reduction || 0) * 0.05;
    const mass = type.mass * massReduction;

    this.entities.push({
      pos: new Vector(newX, newY),
      vel: new Vector(0, 0),
      radius: type.radius,
      typeIndex: newTypeIndex,
      color: type.color,
      mass: mass,
      angle: Math.random() * Math.PI * 2,
      angularVel: 0,
      inertia: (2 / 5) * mass * type.radius * type.radius,
      decalAngle: Math.random() * Math.PI * 2,
      orbitalXPAccumulator: 0,
    });
  }

  createExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      this.particles.push({
        pos: new Vector(x, y),
        vel: new Vector(Math.cos(angle) * speed, Math.sin(angle) * speed),
        life: 1.0,
        color: color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  checkGameOver() {
    let gameOverTriggered = false;
    this.entities.forEach((ent) => {
      if (ent.pos.y < this.containerY + 50) {
        if (!ent.dangerStartTime) ent.dangerStartTime = performance.now();
        if ((performance.now() - ent.dangerStartTime) / 1000 > 2.0) {
          gameOverTriggered = true;
        }
      } else {
        ent.dangerStartTime = null;
      }
    });

    if (gameOverTriggered && !this.gameOver) {
      this.gameOver = true;
      this.saveHighScore();
      document.getElementById("gameOver").style.display = "flex";
      document.getElementById("finalScoreVal").innerText =
        this.score.toLocaleString();
    }
  }

  saveHighScore() {
    this.highScores.push({
      score: this.score,
      date: new Date().toLocaleDateString(),
    });
    this.highScores.sort((a, b) => b.score - a.score);
    this.highScores = this.highScores.slice(0, 5);
    localStorage.setItem("cm_highscores", JSON.stringify(this.highScores));
  }

  toggleShop(show) {
    const modal = document.getElementById("shopModal");
    if (modal) {
      modal.style.display = show ? "flex" : "none";
      if (show) this.renderShop();
    }
  }

  renderShop() {
    const list = document.getElementById("shopList");
    if (!list) return;
    list.innerHTML = "";

    this.upgradeDefinitions.forEach((up) => {
      const level = this.upgrades[up.id] || 0;
      const cost = Math.floor(up.baseCost * Math.pow(1.5, level));

      const item = document.createElement("div");
      item.className = "shop-item";
      item.innerHTML = `
            <div class="item-info">
                <div class="item-name">${up.name} [Lv ${level}]</div>
                <div class="item-desc">${up.desc}</div>
            </div>
            <button class="buy-btn" ${this.score < cost ? "disabled" : ""} onclick="game.buyUpgrade('${up.id}', ${cost})">
                ${cost} CR
            </button>
        `;
      list.appendChild(item);
    });
  }

  buyUpgrade(id, cost) {
    if (this.score >= cost) {
      this.score -= cost;
      this.upgrades[id]++;
      this.updateUI();
      this.renderShop();
      this.spawnFloatingText(
        this.width / 2,
        this.height / 2,
        "UPGRADE ACQUIRED",
        "#bc13fe",
      );
    }
  }

  toggleLeaderboard(show) {
    const modal = document.getElementById("leaderboardModal");
    if (modal) {
      modal.style.display = show ? "flex" : "none";
      if (show) this.renderLeaderboard();
    }
  }

  renderLeaderboard() {
    const list = document.getElementById("leaderboardList");
    if (!list) return;
    list.innerHTML = "";

    if (this.highScores.length === 0) {
      list.innerHTML =
        '<div style="text-align:center; opacity:0.5; padding: 20px;">NO DATA RECORDED</div>';
      return;
    }

    this.highScores.forEach((s, i) => {
      const entry = document.createElement("div");
      entry.className = "leaderboard-entry";
      entry.innerHTML = `
            <div><span class="rank">#${i + 1}</span> ${s.date}</div>
            <div class="score">${s.score.toLocaleString()} CR</div>
        `;
      list.appendChild(entry);
    });
  }

  updateUI() {
    const s = document.getElementById("score");
    if (s) s.innerText = this.score.toLocaleString();
  }

  drawPreview() {
    const canvas = document.getElementById("previewCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const type = PLANET_TYPES[this.nextTypeIndex];
    this.drawPlanet(
      ctx,
      canvas.width / 2,
      canvas.height / 2,
      type.radius * 0.5,
      type.color,
    );
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake,
      );
    }

    ctx.fillStyle = "#05050a";
    ctx.fillRect(0, 0, this.width, this.height);

    this.nebulas.forEach((n) => {
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
      grad.addColorStop(0, n.color);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    });

    this.stars.forEach((s) => {
      s.y += s.speed * 0.016;
      if (s.y > this.height) s.y = 0;
      ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = "rgba(0, 242, 255, 0.1)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.containerX,
      this.containerY,
      this.containerWidth,
      this.containerHeight,
    );

    if (this.dropCooldown <= 0 && !this.gameOver) {
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(this.mousePos.x, this.containerY);
      ctx.lineTo(this.mousePos.x, this.containerY + this.containerHeight);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.globalAlpha = 0.4;
      const type = PLANET_TYPES[this.nextTypeIndex];
      this.drawPlanet(
        ctx,
        this.mousePos.x,
        this.containerY + 20,
        type.radius,
        type.color,
      );
      ctx.globalAlpha = 1.0;
    }
    // Entities
    this.entities.forEach((ent) => {
      const isSpinning = Math.abs(ent.angularVel) > 1.5;
      this.drawPlanet(
        ctx,
        ent.pos.x,
        ent.pos.y,
        ent.radius,
        ent.color,
        ent.angle,
        ent.decalAngle,
        isSpinning,
        ent.isDebris,
      );
    });

    this.particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    this.floatingTexts.forEach((ft) => {
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = "bold 12px 'JetBrains Mono'";
      ctx.textAlign = "center";
      ctx.fillText(ft.text, ft.x, ft.y);
    });

    // Draw Black Hole
    if (this.blackHoleActive) {
      const x = this.blackHolePos.x;
      const y = this.blackHolePos.y;
      const radius = 60 + Math.sin(performance.now() * 0.01) * 10;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, "#000");
      grad.addColorStop(0.2, "#000");
      grad.addColorStop(0.5, "#bc13fe33");
      grad.addColorStop(1, "transparent");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#bc13fe";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.8, 0, Math.PI * 2);
      ctx.rotate(performance.now() * 0.002);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  drawPlanet(
    ctx,
    x,
    y,
    radius,
    color,
    angle = 0,
    decalAngle = 0,
    isSpinning = false,
    isDebris = false,
  ) {
    ctx.save();
    ctx.translate(x, y);

    // Orbital Aura if spinning
    if (isSpinning) {
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 242, 255, 0.3)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.rotate(performance.now() * 0.005);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Atmosphere
    const glow = ctx.createRadialGradient(0, 0, radius, 0, 0, radius * 1.5);
    glow.addColorStop(0, color + "33");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);

    // Body
    if (isDebris) {
      ctx.fillStyle = "#333";
      ctx.beginPath();
      // Jagged asteroid shape
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = radius * (0.8 + Math.random() * 0.4);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      const bodyGrad = ctx.createRadialGradient(
        -radius * 0.3,
        -radius * 0.3,
        radius * 0.1,
        0,
        0,
        radius,
      );
      bodyGrad.addColorStop(0, "#FFFFFF");
      bodyGrad.addColorStop(0.3, color);
      bodyGrad.addColorStop(1, "#000000");
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Surface (Softer craters for smoother visual appearance)
      ctx.rotate(decalAngle);
      const surfaceAlpha = 0.08;
      ctx.fillStyle = `rgba(0, 0, 0, ${surfaceAlpha})`;
      for (let i = 0; i < 3; i++) {
        const dAngle = (i / 3) * Math.PI * 2;
        const d = radius * 0.4;
        ctx.beginPath();
        ctx.arc(
          Math.cos(dAngle) * d,
          Math.sin(dAngle) * d,
          radius * 0.2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

const game = new CosmicMerge();
window.game = game;
game.start();
