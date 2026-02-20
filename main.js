// Game Registry and Core Logic
const games = [
  {
    id: "dash",
    name: "Neon Dash",
    description: "A high-speed rhythm-based platformer.",
    status: "In Development",
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
