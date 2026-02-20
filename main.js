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
    status: "Coming Soon",
  },
];

function init() {
  console.log("Arcade Hub Initialized");
  // We can dynamically render cards here if needed
}

document.addEventListener("DOMContentLoaded", init);
