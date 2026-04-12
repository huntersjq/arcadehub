class NebulaRefinery {
  constructor() {
    this.stardust = 0;
    this.totalStardust = 0;
    this.clickValue = 1;
    this.pps = 0; // Stardust per second

    this.upgrades = [
      {
        id: "collector",
        name: "Ion Collector",
        desc: "Automated ions harvesting.",
        baseCost: 15,
        baseIncome: 1,
        level: 0,
        icon: "🔌",
      },
      {
        id: "drone",
        name: "Dust Drone",
        desc: "Deep space extraction units.",
        baseCost: 100,
        baseIncome: 5,
        level: 0,
        icon: "🚁",
      },
      {
        id: "refinery",
        name: "Solar Refinery",
        desc: "Large scale cosmic processing.",
        baseCost: 1100,
        baseIncome: 20,
        level: 0,
        icon: "🏭",
      },
      {
        id: "singularity",
        name: "Singularity Core",
        desc: "Sucks stardust from other dims.",
        baseCost: 12000,
        baseIncome: 100,
        level: 0,
        icon: "🕳️",
      },
    ];

    this.lastTick = Date.now();
    this.loadGame();
    this.initUI();
    this.startLoop();
  }

  initUI() {
    this.core = document.getElementById("click-core");
    this.countEl = document.getElementById("count");
    this.ppsEl = document.getElementById("pps");
    this.upgradesList = document.getElementById("upgrades-list");

    this.core.addEventListener("click", (e) => this.handleClick(e));
    this.renderUpgrades();
    this.updateDisplay();
  }

  handleClick(e) {
    this.addStardust(this.clickValue);
    this.spawnFloatText(e.clientX, e.clientY, `+${this.clickValue}`);

    // Core animation
    this.core.style.transform = "scale(0.95)";
    setTimeout(() => {
      this.core.style.transform = "";
    }, 50);
  }

  addStardust(val) {
    this.stardust += val;
    this.totalStardust += val;
    this.updateDisplay();
    this.checkUpgradeAffordability();
  }

  updateDisplay() {
    this.countEl.innerText = Math.floor(this.stardust).toLocaleString();
    this.ppsEl.innerText = `Generating ${this.pps.toFixed(1)}/sec`;
  }

  renderUpgrades() {
    this.upgradesList.innerHTML = "";
    this.upgrades.forEach((u, index) => {
      const card = document.createElement("div");
      card.className = "upgrade-card";
      card.id = `upgrade-${u.id}`;
      card.innerHTML = `
        <div class="upgrade-header">
          <span class="upgrade-name">${u.icon} ${u.name}</span>
          <span class="upgrade-level">LVL ${u.level}</span>
        </div>
        <div class="upgrade-desc">${u.desc}</div>
        <div class="upgrade-cost">✨ ${Math.floor(this.getCost(u))}</div>
      `;
      card.onclick = () => this.buyUpgrade(index);
      this.upgradesList.appendChild(card);
    });
    this.checkUpgradeAffordability();
  }

  getCost(upgrade) {
    return upgrade.baseCost * Math.pow(1.15, upgrade.level);
  }

  buyUpgrade(index) {
    const u = this.upgrades[index];
    const cost = this.getCost(u);

    if (this.stardust >= cost) {
      this.stardust -= cost;
      u.level++;
      this.calculatePPS();
      this.renderUpgrades();
      this.updateDisplay();
      this.saveGame();
    }
  }

  calculatePPS() {
    this.pps = this.upgrades.reduce(
      (sum, u) => sum + u.level * u.baseIncome,
      0,
    );
  }

  checkUpgradeAffordability() {
    this.upgrades.forEach((u) => {
      const card = document.getElementById(`upgrade-${u.id}`);
      if (card) {
        if (this.stardust >= this.getCost(u)) {
          card.classList.remove("disabled");
        } else {
          card.classList.add("disabled");
        }
      }
    });
  }

  spawnFloatText(x, y, text) {
    const el = document.createElement("div");
    el.className = "float-text";
    el.innerText = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  startLoop() {
    setInterval(() => {
      const now = Date.now();
      const dt = (now - this.lastTick) / 1000;
      this.lastTick = now;

      if (this.pps > 0) {
        this.addStardust(this.pps * dt);
      }

      // Auto-save every 10 seconds (roughly)
      if (Math.random() < 0.01) this.saveGame();
    }, 100);
  }

  saveGame() {
    const data = {
      stardust: this.stardust,
      totalStardust: this.totalStardust,
      upgrades: this.upgrades.map((u) => ({ id: u.id, level: u.level })),
    };
    localStorage.setItem("nebula_refinery_save", JSON.stringify(data));
    // Convert stardust to arcade coins (1 coin per 100 stardust earned)
    const coinsFromDust = Math.floor(this.totalStardust / 100);
    const KEY = "nebula_coins_credited";
    const prev = parseInt(localStorage.getItem(KEY) || "0", 10);
    const delta = coinsFromDust - prev;
    if (delta > 0 && window.ArcadeHub) {
      window.ArcadeHub.addCoins(delta);
      localStorage.setItem(KEY, String(coinsFromDust));
    }
  }

  loadGame() {
    const saved = localStorage.getItem("nebula_refinery_save");
    if (saved) {
      const data = JSON.parse(saved);
      this.stardust = data.stardust || 0;
      this.totalStardust = data.totalStardust || 0;
      data.upgrades.forEach((savedU) => {
        const u = this.upgrades.find((item) => item.id === savedU.id);
        if (u) u.level = savedU.level;
      });
      this.calculatePPS();
    }
  }
}

window.onload = () => {
  new NebulaRefinery();
};
