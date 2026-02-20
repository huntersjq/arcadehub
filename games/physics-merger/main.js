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
    this.nextTypeIndex = this.getRandomStartType();
    this.isDropping = false;
    this.dropCooldown = 0;
    this.gameOver = false;
    this.mousePos = new Vector(this.width / 2, 100);

    this.stars = this.createStars(150);
    this.nebulas = this.createNebulas(3);

    this.containerWidth = Math.min(600, this.width - 40);
    this.containerX = (this.width - this.containerWidth) / 2;
    this.containerY = 100;
    this.containerHeight = this.height - 150;

    this.gravity = 800;
    this.updateUI();
    this.drawPreview();
    document.getElementById("gameOver").style.display = "none";
  }

  getRandomStartType() {
    // Only drop the first 3 types
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
        speed: Math.random() * 0.05,
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

    this.dropCooldown -= dt;

    // Mouse tracking
    this.mousePos.x = this.input.mouse.x;
    // Clamp mouse inside container
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
      this.dropCooldown = 0.6;
    }

    // Physics
    this.updatePhysics(dt);
    this.updateParticles(dt);
    this.checkGameOver();
  }

  dropPlanet() {
    const typeIndex = this.nextTypeIndex;
    const type = PLANET_TYPES[typeIndex];

    this.entities.push({
      pos: new Vector(this.mousePos.x, this.containerY + 20),
      vel: new Vector(0, 0),
      radius: type.radius,
      typeIndex: typeIndex,
      color: type.color,
      mass: type.mass,
      id: Math.random(),
    });

    this.nextTypeIndex = this.getRandomStartType();
    this.drawPreview();
  }

  updatePhysics(dt) {
    const substeps = 8;
    const sdt = dt / substeps;

    for (let s = 0; s < substeps; s++) {
      // Gravity and movement
      this.entities.forEach((ent) => {
        ent.vel.y += this.gravity * sdt;
        ent.pos.add(new Vector(ent.vel.x * sdt, ent.vel.y * sdt));

        // Wall collisions
        if (ent.pos.x - ent.radius < this.containerX) {
          ent.pos.x = this.containerX + ent.radius;
          ent.vel.x *= -0.3;
        }
        if (ent.pos.x + ent.radius > this.containerX + this.containerWidth) {
          ent.pos.x = this.containerX + this.containerWidth - ent.radius;
          ent.vel.x *= -0.3;
        }
        if (ent.pos.y + ent.radius > this.containerY + this.containerHeight) {
          ent.pos.y = this.containerY + this.containerHeight - ent.radius;
          ent.vel.y *= -0.2;
          ent.vel.x *= 0.95; // Friction
        }
      });

      // Circle collisions
      for (let i = 0; i < this.entities.length; i++) {
        for (let j = i + 1; j < this.entities.length; j++) {
          const a = this.entities[i];
          const b = this.entities[j];
          const dist = Vector.dist(a.pos, b.pos);
          const minSafeDist = a.radius + b.radius;

          if (dist < minSafeDist) {
            // MERGE CHECK
            if (
              a.typeIndex === b.typeIndex &&
              a.typeIndex < PLANET_TYPES.length - 1
            ) {
              this.merge(i, j);
              return; // Exit sub-step to avoid indexing issues
            }

            // Resolve collision
            const normal = new Vector(
              b.pos.x - a.pos.x,
              b.pos.y - a.pos.y,
            ).normalize();
            const overlap = minSafeDist - dist;

            // Separate
            const mSum = a.mass + b.mass;
            const ratioA = b.mass / mSum;
            const ratioB = a.mass / mSum;

            a.pos.sub(
              new Vector(
                normal.x * overlap * ratioA,
                normal.y * overlap * ratioA,
              ),
            );
            b.pos.add(
              new Vector(
                normal.x * overlap * ratioB,
                normal.y * overlap * ratioB,
              ),
            );

            // Impulse
            const relVel = new Vector(b.vel.x - a.vel.x, b.vel.y - a.vel.y);
            const velAlongNormal = relVel.x * normal.x + relVel.y * normal.y;

            if (velAlongNormal > 0) continue;

            const restitution = 0.2;
            let jImpulse = -(1 + restitution) * velAlongNormal;
            jImpulse /= 1 / a.mass + 1 / b.mass;

            const impulseVec = new Vector(
              normal.x * jImpulse,
              normal.y * jImpulse,
            );
            a.vel.sub(new Vector(impulseVec.x / a.mass, impulseVec.y / a.mass));
            b.vel.add(new Vector(impulseVec.x / b.mass, impulseVec.y / b.mass));
          }
        }
      }
    }
  }

  merge(i, j) {
    const a = this.entities[i];
    const b = this.entities[j];
    const newPos = new Vector((a.pos.x + b.pos.x) / 2, (a.pos.y + b.pos.y) / 2);
    const newTypeIndex = a.typeIndex + 1;

    this.score += PLANET_TYPES[newTypeIndex].xp;
    this.updateUI();

    // Create merge effect
    this.createExplosion(
      newPos.x,
      newPos.y,
      PLANET_TYPES[newTypeIndex].color,
      15,
    );

    // Remove old, add new
    this.entities.splice(Math.max(i, j), 1);
    this.entities.splice(Math.min(i, j), 1);

    this.entities.push({
      pos: newPos,
      vel: new Vector(0, 0),
      radius: PLANET_TYPES[newTypeIndex].radius,
      typeIndex: newTypeIndex,
      color: PLANET_TYPES[newTypeIndex].color,
      mass: PLANET_TYPES[newTypeIndex].mass,
      id: Math.random(),
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
      p.pos.add(new Vector(p.vel.x * dt, p.vel.y * dt));
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  checkGameOver() {
    // A planet is in the "danger zone" if it's above a certain height and has been there for a bit
    let gameOverTriggered = false;
    this.entities.forEach((ent) => {
      // If it's very high up and moving slowly (settled)
      if (ent.pos.y < this.containerY + 50) {
        if (!ent.dangerStartTime) ent.dangerStartTime = performance.now();
        const timeInDanger = (performance.now() - ent.dangerStartTime) / 1000;

        if (timeInDanger > 2.0) {
          // 2 seconds in danger zone
          gameOverTriggered = true;
        }
      } else {
        ent.dangerStartTime = null;
      }
    });

    if (gameOverTriggered && !this.gameOver) {
      this.triggerGameOver();
    }
  }

  triggerGameOver() {
    this.gameOver = true;
    document.getElementById("gameOver").style.display = "flex";
    document.getElementById("finalScoreVal").innerText =
      this.score.toLocaleString();
  }

  updateUI() {
    const scoreVal = document.getElementById("score");
    if (scoreVal) scoreVal.innerText = this.score.toLocaleString();
  }

  drawPreview() {
    const canvas = document.getElementById("previewCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const type = PLANET_TYPES[this.nextTypeIndex];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    this.drawPlanet(ctx, centerX, centerY, type.radius * 0.5, type.color);
  }

  draw() {
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = "#05050a";
    ctx.fillRect(0, 0, this.width, this.height);

    // Stars & Nebulas
    this.nebulas.forEach((n) => {
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
      grad.addColorStop(0, n.color);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    });

    this.stars.forEach((s) => {
      s.y += s.speed;
      if (s.y > this.height) s.y = 0;
      ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Container
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.containerX,
      this.containerY,
      this.containerWidth,
      this.containerHeight,
    );

    // Draw Drop Line
    if (this.dropCooldown <= 0) {
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(this.mousePos.x, this.containerY);
      ctx.lineTo(this.mousePos.x, this.containerY + this.containerHeight);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.stroke();
      ctx.setLineDash([]);

      // Ghost planet
      const nextType = PLANET_TYPES[this.nextTypeIndex];
      ctx.globalAlpha = 0.4;
      this.drawPlanet(
        ctx,
        this.mousePos.x,
        this.containerY + 20,
        nextType.radius,
        nextType.color,
      );
      ctx.globalAlpha = 1.0;
    }

    // Entities
    this.entities.forEach((ent) => {
      this.drawPlanet(ctx, ent.pos.x, ent.pos.y, ent.radius, ent.color);
    });

    // Particles
    this.particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  }

  drawPlanet(ctx, x, y, radius, color) {
    ctx.save();
    ctx.translate(x, y);

    // Outer atmosphere glow
    const glow = ctx.createRadialGradient(0, 0, radius, 0, 0, radius * 1.5);
    glow.addColorStop(0, color + "44");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyGrad = ctx.createRadialGradient(
      -radius * 0.3,
      -radius * 0.3,
      radius * 0.1,
      0,
      0,
      radius,
    );
    bodyGrad.addColorStop(0, "#FFFFFF");
    bodyGrad.addColorStop(0.2, color);
    bodyGrad.addColorStop(1, "#000000");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}

const game = new CosmicMerge();
window.game = game;
game.start();
