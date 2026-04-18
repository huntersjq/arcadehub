// 德州扑克 - 牌型判定
// 返回 { rank, name, values, cards }
//   rank: 整数等级（越大越强）  9=皇家同花顺, 8=同花顺, 7=四条, 6=葫芦, 5=同花, 4=顺子, 3=三条, 2=两对, 1=一对, 0=高牌
//   values: 比较用的长度 5+ 数组（相同 rank 下逐位比较）
//   cards: 组成最佳牌型的 5 张

import { RANK_VALUE } from "./deck.js";

export const HAND_NAME_CN = {
  9: "皇家同花顺", 8: "同花顺", 7: "四条", 6: "葫芦",
  5: "同花", 4: "顺子", 3: "三条", 2: "两对", 1: "一对", 0: "高牌",
};

function sortDesc(arr) { return arr.slice().sort((a, b) => b - a); }

function combinations(arr, k) {
  const result = [];
  const n = arr.length;
  if (k > n) return result;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    result.push(idx.map((i) => arr[i]));
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return result;
}

// 评估 5 张手牌
function eval5(cards) {
  const vals = cards.map((c) => RANK_VALUE[c[0]]);
  const suits = cards.map((c) => c[1]);
  const sortedDesc = sortDesc(vals);

  const countMap = new Map();
  for (const v of vals) countMap.set(v, (countMap.get(v) || 0) + 1);
  const counts = [...countMap.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const isFlush = suits.every((s) => s === suits[0]);

  // 顺子判定（含 A-2-3-4-5 轮子）
  const unique = [...new Set(sortedDesc)];
  let isStraight = false;
  let straightHigh = 0;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) {
      isStraight = true;
      straightHigh = unique[0];
    } else if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
      // A-5-4-3-2 轮子，A 当 1 使用，顺子大小以 5 为最高
      isStraight = true;
      straightHigh = 5;
    }
  }

  if (isStraight && isFlush) {
    if (straightHigh === 14) return { rank: 9, values: [14], name: HAND_NAME_CN[9], cards };
    return { rank: 8, values: [straightHigh], name: HAND_NAME_CN[8], cards };
  }
  if (counts[0][1] === 4) {
    const quad = counts[0][0];
    const kicker = counts[1][0];
    return { rank: 7, values: [quad, kicker], name: HAND_NAME_CN[7], cards };
  }
  if (counts[0][1] === 3 && counts[1][1] === 2) {
    return { rank: 6, values: [counts[0][0], counts[1][0]], name: HAND_NAME_CN[6], cards };
  }
  if (isFlush) {
    return { rank: 5, values: sortedDesc, name: HAND_NAME_CN[5], cards };
  }
  if (isStraight) {
    return { rank: 4, values: [straightHigh], name: HAND_NAME_CN[4], cards };
  }
  if (counts[0][1] === 3) {
    const trip = counts[0][0];
    const kickers = counts.slice(1).map((c) => c[0]).sort((a, b) => b - a);
    return { rank: 3, values: [trip, ...kickers], name: HAND_NAME_CN[3], cards };
  }
  if (counts[0][1] === 2 && counts[1][1] === 2) {
    const hiPair = Math.max(counts[0][0], counts[1][0]);
    const loPair = Math.min(counts[0][0], counts[1][0]);
    const kicker = counts[2][0];
    return { rank: 2, values: [hiPair, loPair, kicker], name: HAND_NAME_CN[2] };
  }
  if (counts[0][1] === 2) {
    const pair = counts[0][0];
    const kickers = counts.slice(1).map((c) => c[0]).sort((a, b) => b - a);
    return { rank: 1, values: [pair, ...kickers], name: HAND_NAME_CN[1], cards };
  }
  return { rank: 0, values: sortedDesc, name: HAND_NAME_CN[0], cards };
}

// 从 7 张牌中选出最佳 5 张组合
export function bestOfSeven(sevenCards) {
  if (sevenCards.length < 5) return null;
  const combos = combinations(sevenCards, 5);
  let best = null;
  for (const combo of combos) {
    const evalResult = eval5(combo);
    if (!best || compareHands(evalResult, best) > 0) {
      best = { ...evalResult, cards: combo };
    }
  }
  return best;
}

export function compareHands(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.values.length, b.values.length); i++) {
    const av = a.values[i] || 0;
    const bv = b.values[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// 简化版：仅用 7 张中最大的单张比较（用于 AI 底牌强度估计的快路径）
export function quickHandStrength(cards) {
  if (cards.length >= 5) return bestOfSeven(cards);
  // 仅 2 张底牌时返回一个 0~1 的启发值
  const [a, b] = cards;
  const va = RANK_VALUE[a[0]], vb = RANK_VALUE[b[0]];
  const hi = Math.max(va, vb), lo = Math.min(va, vb);
  const suited = a[1] === b[1];
  const pair = va === vb;
  let s = 0;
  if (pair) s = 0.5 + (hi - 2) / 24; // 对 2→0.5, 对 A→1.0
  else {
    s = (hi + lo) / 40;
    if (suited) s += 0.08;
    const gap = hi - lo - 1;
    if (gap === 0) s += 0.06;
    else if (gap === 1) s += 0.04;
    else if (gap === 2) s += 0.02;
    if (hi >= 12) s += 0.06; // 含 A/K/Q
  }
  return { rank: -1, values: [s], name: "预估", cards };
}
