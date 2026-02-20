// Game Registry and Core Logic
const games = [
  {
    id: "merger",
    name: "Cosmic Merge",
    description: "Physics-based celestial merging.",
    status: "Live",
  },
  {
    id: "survivor",
    name: "Neon Survivor",
    description: "Endless bullet-hell survival.",
    status: "Live",
  },
  {
    id: "dash",
    name: "Neon Dash",
    description: "Procedural high-speed infinite runner.",
    status: "Live",
  },
  {
    id: "match",
    name: "Stellar Match",
    description: "2048-style puzzle meets cosmic RPG.",
    status: "Live",
  },
  {
    id: "clicker",
    name: "Nebula Refinery",
    description: "Satisfying idle stardust harvesting.",
    status: "Live",
  },
  {
    id: "vox",
    name: "Vox Runner",
    description: "Infinite runner in a voxel-style world.",
    status: "Live",
  },
];

function init() {
  console.log("Arcade Hub Initialized");
  const coins = localStorage.getItem("arcade_coins") || 0;
  const coinEl = document.getElementById("global-coins");
  if (coinEl) {
    coinEl.innerText = coins;
  }
}

// Function to add coins globally (can be called from games by accessing their parent frame or localstorage directly)
window.addArcadeCoins = function (amount) {
  let current = parseInt(localStorage.getItem("arcade_coins") || "0", 10);
  current += amount;
  localStorage.setItem("arcade_coins", current);
};

document.addEventListener("DOMContentLoaded", init);
