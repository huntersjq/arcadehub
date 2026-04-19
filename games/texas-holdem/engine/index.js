// @arcadehub/holdem-engine
// 公共 API 入口。所有外部消费方应当从这里 import，而不是直接引用子模块。
//
// 这样我们以后改 game.js / hand.js / pot.js / deck.js 的内部细节，外部代码无需变化。

// 状态机 + 阶段常量
export { Game, STAGE, STAGE_NAME_CN } from "./game.js";

// 牌型判定
export {
  bestOfSeven,
  compareHands,
  quickHandStrength,
  HAND_NAME_CN,
} from "./hand.js";

// 底池 / 边池
export { buildPots, splitPot } from "./pot.js";

// 牌堆 / 工具 / PRNG
export {
  buildDeck,
  shuffle,
  randomSeed,
  makePRNG,
  RANKS,
  SUITS,
  RANK_VALUE,
  SUIT_SYMBOL,
  SUIT_NAME_CN,
  RANK_NAME_CN,
  cardCode,
  cardRank,
  cardSuit,
  rankValue,
  isRed,
} from "./deck.js";
