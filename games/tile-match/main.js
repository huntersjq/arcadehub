import { Vector } from "../shared/engine.js";

class TileMatchRPG {
  constructor() {
    this.gridSize = 4;
    this.grid = Array(this.gridSize)
      .fill()
      .map(() => Array(this.gridSize).fill(null));
    this.score = 0;
    this.stage = 1;
    this.playerHp = 100;
    this.enemyHp = 100;
    this.enemyMaxHp = 100;
    this.moveCount = 0;

    this.container = document.getElementById("grid-container");
    this.setupInputs();
    this.initGame();
  }

  initGame() {
    this.addRandomTile();
    this.addRandomTile();
    this.updateUI();
  }

  addRandomTile() {
    const emptyCells = [];
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (!this.grid[r][c]) emptyCells.push({ r, c });
      }
    }
    if (emptyCells.length > 0) {
      const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      this.grid[cell.r][cell.c] = {
        value: Math.random() < 0.9 ? 2 : 4,
        isNew: true,
        merged: false,
      };
      this.renderGrid();
    }
  }

  renderGrid() {
    // Clear old tiles
    const tiles = document.querySelectorAll(".tile");
    tiles.forEach((t) => t.remove());

    const containerRect = this.container.getBoundingClientRect();
    const padding = 15;
    const gap = 15;
    const cellSize =
      (400 - padding * 2 - gap * (this.gridSize - 1)) / this.gridSize;

    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const tileData = this.grid[r][c];
        if (tileData) {
          const tile = document.createElement("div");
          tile.className = `tile tile-${tileData.value}`;
          tile.innerText = tileData.value;

          const x = padding + c * (cellSize + gap);
          const y = padding + r * (cellSize + gap);

          tile.style.width = `${cellSize}px`;
          tile.style.height = `${cellSize}px`;
          tile.style.left = `${x}px`;
          tile.style.top = `${y}px`;

          if (tileData.isNew) {
            tile.style.transform = "scale(0)";
            setTimeout(() => (tile.style.transform = "scale(1)"), 10);
            tileData.isNew = false;
          }

          this.container.appendChild(tile);
        }
      }
    }
  }

  setupInputs() {
    window.addEventListener("keydown", (e) => {
      let moved = false;
      if (e.key === "ArrowUp" || e.key === "w") moved = this.move("up");
      if (e.key === "ArrowDown" || e.key === "s") moved = this.move("down");
      if (e.key === "ArrowLeft" || e.key === "a") moved = this.move("left");
      if (e.key === "ArrowRight" || e.key === "d") moved = this.move("right");

      if (moved) {
        this.addRandomTile();
        this.checkGameState();
      }
    });

    // Touch support
    let startX, startY;
    this.container.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });
    this.container.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      let moved = false;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 30) moved = this.move(dx > 0 ? "right" : "left");
      } else {
        if (Math.abs(dy) > 30) moved = this.move(dy > 0 ? "down" : "up");
      }
      if (moved) {
        this.addRandomTile();
        this.checkGameState();
      }
    });
  }

  move(direction) {
    let moved = false;
    let attackDamage = 0;

    // Reset merged flags
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (this.grid[r][c]) this.grid[r][c].merged = false;
      }
    }

    const traverse = (stepR, stepC, rStart, rEnd, cStart, cEnd) => {
      for (let r = rStart; r !== rEnd; r += stepR) {
        for (let c = cStart; c !== cEnd; c += stepC) {
          if (this.grid[r][c]) {
            let nextR = r;
            let nextC = c;

            while (true) {
              const testR =
                nextR +
                (direction === "up" ? -1 : direction === "down" ? 1 : 0);
              const testC =
                nextC +
                (direction === "left" ? -1 : direction === "right" ? 1 : 0);

              if (
                testR < 0 ||
                testR >= this.gridSize ||
                testC < 0 ||
                testC >= this.gridSize
              )
                break;

              const target = this.grid[testR][testC];
              if (!target) {
                this.grid[testR][testC] = this.grid[nextR][nextC];
                this.grid[nextR][nextC] = null;
                nextR = testR;
                nextC = testC;
                moved = true;
              } else if (
                target.value === this.grid[nextR][nextC].value &&
                !target.merged
              ) {
                target.value *= 2;
                target.merged = true;
                this.grid[nextR][nextC] = null;
                moved = true;
                this.score += target.value;
                attackDamage += target.value;
                break;
              } else {
                break;
              }
            }
          }
        }
      }
    };

    if (direction === "up") traverse(1, 1, 0, this.gridSize, 0, this.gridSize);
    if (direction === "down")
      traverse(-1, 1, this.gridSize - 1, -1, 0, this.gridSize);
    if (direction === "left")
      traverse(1, 1, 0, this.gridSize, 0, this.gridSize);
    if (direction === "right")
      traverse(1, -1, 0, this.gridSize, this.gridSize - 1, -1);

    if (moved) {
      this.renderGrid();
      if (attackDamage > 0) this.playerAttack(attackDamage);
      this.moveCount++;
      if (this.moveCount % 10 === 0) this.enemyAttack();
    }
    return moved;
  }

  playerAttack(dmg) {
    // Hero jump animation
    const hero = document.getElementById("player");
    hero.style.transform = "translateX(50px) scale(1.1)";
    setTimeout(() => (hero.style.transform = "translateX(0) scale(1)"), 100);

    // Enemy hit effect
    const enemy = document.getElementById("enemy");
    setTimeout(() => {
      enemy.style.transform = "translateX(10px) rotate(5deg)";
      this.enemyHp -= dmg;
      this.spawnDamageText(dmg, "enemy");
      this.updateUI();
      if (this.enemyHp <= 0) this.nextStage();
      setTimeout(() => (enemy.style.transform = "translateX(0)"), 100);
    }, 50);
  }

  enemyAttack() {
    const enemy = document.getElementById("enemy");
    enemy.style.transform = "translateX(-50px) scale(1.1)";
    setTimeout(() => (enemy.style.transform = "translateX(0) scale(1)"), 100);

    const dmg = 5 + this.stage * 2;
    setTimeout(() => {
      const player = document.getElementById("player");
      player.style.transform = "translateX(-10px) rotate(-5deg)";
      this.playerHp -= dmg;
      this.spawnDamageText(dmg, "player");
      this.updateUI();
      if (this.playerHp <= 0) this.gameOverState();
      setTimeout(() => (player.style.transform = "translateX(0)"), 100);
    }, 50);
  }

  spawnDamageText(val, target) {
    const battleArea = document.getElementById("battle-area");
    const text = document.createElement("div");
    text.className = "damage-text";
    text.innerText = `-${val}`;

    const targetEl = document.getElementById(target);
    const rect = targetEl.getBoundingClientRect();
    const containerRect = battleArea.getBoundingClientRect();

    text.style.left = `${rect.left - containerRect.left + 50}px`;
    text.style.top = `100px`;

    battleArea.appendChild(text);
    setTimeout(() => text.remove(), 800);
  }

  nextStage() {
    this.stage++;
    this.enemyMaxHp = 100 + (this.stage - 1) * 150;
    this.enemyHp = this.enemyMaxHp;
    this.playerHp = Math.min(100, this.playerHp + 20); // Heal a bit

    const icons = ["👾", "🛸", "☄️", "💀", "🤖", "👹"];
    document.getElementById("enemy-icon").innerText =
      icons[this.stage % icons.length];

    this.updateUI();
  }

  updateUI() {
    document.getElementById("score").innerText = this.score;
    document.getElementById("stage").innerText = this.stage;
    document.getElementById("playerHp").style.width = `${this.playerHp}%`;
    document.getElementById("enemyHp").style.width =
      `${(this.enemyHp / this.enemyMaxHp) * 100}%`;
  }

  checkGameState() {
    // Check if grid is full and no moves possible
    let movesPossible = false;
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (!this.grid[r][c]) movesPossible = true;
        else {
          const val = this.grid[r][c].value;
          if (r > 0 && this.grid[r - 1][c] && this.grid[r - 1][c].value === val)
            movesPossible = true;
          if (
            r < this.gridSize - 1 &&
            this.grid[r + 1][c] &&
            this.grid[r + 1][c].value === val
          )
            movesPossible = true;
          if (c > 0 && this.grid[r][c - 1] && this.grid[r][c - 1].value === val)
            movesPossible = true;
          if (
            c < this.gridSize - 1 &&
            this.grid[r][c + 1] &&
            this.grid[r][c + 1].value === val
          )
            movesPossible = true;
        }
      }
    }
    if (!movesPossible) this.gameOverState();
  }

  gameOverState() {
    document.getElementById("game-over").style.display = "flex";
  }
}

new TileMatchRPG();
