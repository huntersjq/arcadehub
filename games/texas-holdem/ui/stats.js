// 德州扑克终生战绩 + 里程碑追踪
//
// 存储到 localStorage：
//   holdem_stats   {handsPlayed, handsWon, biggestPot, biggestWin, bestHandRank, royalFlush, straightFlush, fourOfAKind, fullHouse}
//   holdem_highscores  [biggestWin]（供 hub bestScore 显示）
//   holdem_milestones  {royalFlush,...}（用于 in-game toast 一次性）

const STATS_KEY = "holdem_stats";
const HIGH_KEY = "holdem_highscores";
const MS_KEY = "holdem_milestones";

export const MILESTONES = {
  royal_flush:    { id: "royal_flush",    label: "皇家同花顺", icon: "👑", rank: 9 },
  straight_flush: { id: "straight_flush", label: "同花顺",     icon: "🌈", rank: 8 },
  four_of_kind:   { id: "four_of_kind",   label: "四条",       icon: "🔥", rank: 7 },
  full_house:     { id: "full_house",     label: "葫芦",       icon: "🏠", rank: 6 },
  wins_10:        { id: "wins_10",        label: "胜 10 手",   icon: "🥉" },
  wins_50:        { id: "wins_50",        label: "胜 50 手",   icon: "🥈" },
  wins_100:       { id: "wins_100",       label: "胜 100 手",  icon: "🥇" },
  big_pot_5k:     { id: "big_pot_5k",     label: "5k 底池",    icon: "💰" },
  big_pot_20k:    { id: "big_pot_20k",    label: "20k 底池",   icon: "💎" },
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
}

export function loadStats() {
  return read(STATS_KEY, {
    handsPlayed: 0,
    handsWon: 0,
    biggestPot: 0,
    biggestWin: 0,
    bestHandRank: -1,
    bestHandName: null,
    royalFlush: 0,
    straightFlush: 0,
    fourOfAKind: 0,
    fullHouse: 0,
  });
}

export function loadUnlockedMilestones() {
  return read(MS_KEY, {});
}

// 本手结束时调用。返回新解锁的里程碑数组。
export function recordHand({ selfDelta, selfBestHand, pot, won }) {
  const stats = loadStats();
  const ms = loadUnlockedMilestones();
  const newlyUnlocked = [];

  stats.handsPlayed += 1;
  if (won) stats.handsWon += 1;
  if (pot > stats.biggestPot) stats.biggestPot = pot;
  if (selfDelta > stats.biggestWin) {
    stats.biggestWin = selfDelta;
    write(HIGH_KEY, [stats.biggestWin]);
  }

  const rank = selfBestHand?.rank ?? -1;
  const name = selfBestHand?.name || null;
  if (won && rank > stats.bestHandRank) {
    stats.bestHandRank = rank;
    stats.bestHandName = name;
  }

  if (won) {
    if (rank === 9) stats.royalFlush += 1;
    if (rank === 8) stats.straightFlush += 1;
    if (rank === 7) stats.fourOfAKind += 1;
    if (rank === 6) stats.fullHouse += 1;
  }

  write(STATS_KEY, stats);

  const triggers = [];
  if (won && rank === 9 && !ms.royal_flush)    triggers.push("royal_flush");
  if (won && rank === 8 && !ms.straight_flush) triggers.push("straight_flush");
  if (won && rank === 7 && !ms.four_of_kind)   triggers.push("four_of_kind");
  if (won && rank === 6 && !ms.full_house)     triggers.push("full_house");
  if (stats.handsWon >= 10  && !ms.wins_10)    triggers.push("wins_10");
  if (stats.handsWon >= 50  && !ms.wins_50)    triggers.push("wins_50");
  if (stats.handsWon >= 100 && !ms.wins_100)   triggers.push("wins_100");
  if (pot >= 5000  && !ms.big_pot_5k)           triggers.push("big_pot_5k");
  if (pot >= 20000 && !ms.big_pot_20k)          triggers.push("big_pot_20k");

  for (const key of triggers) {
    ms[key] = Date.now();
    newlyUnlocked.push(MILESTONES[key]);
  }
  if (newlyUnlocked.length > 0) write(MS_KEY, ms);
  return newlyUnlocked;
}

export function showMilestoneToast(milestone) {
  const el = document.createElement("div");
  el.className = "milestone-toast";

  const iconEl = document.createElement("div");
  iconEl.className = "milestone-icon";
  iconEl.textContent = milestone.icon;
  el.appendChild(iconEl);

  const bodyEl = document.createElement("div");
  bodyEl.className = "milestone-body";
  const labelEl = document.createElement("div");
  labelEl.className = "milestone-label";
  labelEl.textContent = "里程碑解锁";
  const nameEl = document.createElement("div");
  nameEl.className = "milestone-name";
  nameEl.textContent = milestone.label;
  bodyEl.appendChild(labelEl);
  bodyEl.appendChild(nameEl);
  el.appendChild(bodyEl);

  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 400);
  }, 2800);
}

export function renderStatsPanel(container) {
  const stats = loadStats();
  const ms = loadUnlockedMilestones();
  container.replaceChildren();

  const grid = document.createElement("div");
  grid.className = "stats-grid";
  const rows = [
    ["总手数",   stats.handsPlayed.toLocaleString()],
    ["胜场",     stats.handsWon.toLocaleString()],
    ["胜率",     stats.handsPlayed > 0 ? Math.round((stats.handsWon / stats.handsPlayed) * 100) + "%" : "—"],
    ["最大底池", stats.biggestPot.toLocaleString()],
    ["最大盈利", (stats.biggestWin > 0 ? "+" : "") + stats.biggestWin.toLocaleString()],
    ["最佳牌型", stats.bestHandName || "—"],
  ];
  for (const [label, value] of rows) {
    const cell = document.createElement("div");
    cell.className = "stats-cell";
    const labelDiv = document.createElement("div");
    labelDiv.className = "stats-label";
    labelDiv.textContent = label;
    const valueDiv = document.createElement("div");
    valueDiv.className = "stats-value";
    valueDiv.textContent = value;
    cell.appendChild(labelDiv);
    cell.appendChild(valueDiv);
    grid.appendChild(cell);
  }
  container.appendChild(grid);

  const msTitle = document.createElement("div");
  msTitle.className = "stats-ms-title";
  msTitle.textContent = "里程碑";
  container.appendChild(msTitle);

  const msGrid = document.createElement("div");
  msGrid.className = "stats-ms-grid";
  for (const m of Object.values(MILESTONES)) {
    const chip = document.createElement("div");
    const unlocked = !!ms[m.id];
    chip.className = "stats-ms-chip " + (unlocked ? "unlocked" : "locked");
    const iconSpan = document.createElement("span");
    iconSpan.className = "icon";
    iconSpan.textContent = unlocked ? m.icon : "🔒";
    const nameSpan = document.createElement("span");
    nameSpan.textContent = m.label;
    chip.appendChild(iconSpan);
    chip.appendChild(nameSpan);
    msGrid.appendChild(chip);
  }
  container.appendChild(msGrid);
}
