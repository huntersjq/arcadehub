// 德州扑克 - 牌堆
// 花色: s(黑桃) h(红心) d(方块) c(梅花)
// 点数: 2..9, T(10), J, Q, K, A

export const SUITS = ["s", "h", "d", "c"];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
export const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 2])); // 2→2 ... A→14

export const SUIT_SYMBOL = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const SUIT_NAME_CN = { s: "黑桃", h: "红心", d: "方块", c: "梅花" };
export const RANK_NAME_CN = {
  "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7",
  "8": "8", "9": "9", "T": "10", "J": "J", "Q": "Q", "K": "K", "A": "A",
};

export function cardCode(rank, suit) { return rank + suit; }
export function cardRank(code) { return code[0]; }
export function cardSuit(code) { return code[1]; }
export function rankValue(code) { return RANK_VALUE[code[0]]; }
export function isRed(code) { return code[1] === "h" || code[1] === "d"; }

export function buildDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(cardCode(r, s));
  return deck;
}

// 基于 seed 的确定性 PRNG（mulberry32），用于联机同步洗牌
export function makePRNG(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(deck, seed) {
  const rand = seed == null ? Math.random : makePRNG(seed);
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function randomSeed() {
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}
