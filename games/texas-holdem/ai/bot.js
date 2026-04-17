// 德州扑克 - AI 决策
// 三档难度：
//   easy   新手：看底牌强度，极少加注，少诈唬
//   normal 普通：考虑底池赔率、位置
//   hard   高手：蒙特卡洛模拟 + 诈唬 + 对手建模
//
// 暴露 decide(game, player, ctx) -> { type, amount? }

import { bestOfSeven, compareHands, quickHandStrength } from "../engine/hand.js";
import { buildDeck, RANK_VALUE } from "../engine/deck.js";

// 快速底牌强度（0-1），仅基于 2 张底牌
function preflopStrength(hole) {
  return quickHandStrength(hole).values[0];
}

// 蒙特卡洛：模拟 N 轮对战 opponents 个随机对手，返回估计胜率
function monteCarloEquity(holeCards, community, opponents, iterations) {
  const known = new Set([...holeCards, ...community]);
  const base = buildDeck().filter((c) => !known.has(c));
  let wins = 0, ties = 0;

  for (let i = 0; i < iterations; i++) {
    // shuffle copy
    const remaining = base.slice();
    for (let j = remaining.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [remaining[j], remaining[k]] = [remaining[k], remaining[j]];
    }
    let p = 0;
    // 对手底牌
    const oppHoles = [];
    for (let o = 0; o < opponents; o++) {
      oppHoles.push([remaining[p++], remaining[p++]]);
    }
    // 补足公共牌
    const simCommunity = community.slice();
    while (simCommunity.length < 5) simCommunity.push(remaining[p++]);

    const myHand = bestOfSeven([...holeCards, ...simCommunity]);
    let best = myHand;
    let tiedCount = 0;
    let beatenByOpp = false;
    for (const oh of oppHoles) {
      const oppHand = bestOfSeven([...oh, ...simCommunity]);
      const cmp = compareHands(oppHand, myHand);
      if (cmp > 0) { beatenByOpp = true; break; }
      else if (cmp === 0) tiedCount++;
    }
    if (beatenByOpp) continue;
    if (tiedCount > 0) ties += 1 / (tiedCount + 1);
    else wins += 1;
  }
  return (wins + ties) / iterations;
}

// 主决策
export function decide(game, player, ctx) {
  const { toCall, minRaise, maxRaise, pot, bigBlind, legalActions } = ctx;
  const level = player.aiLevel || "normal";
  const stage = game.stage;
  const opponents = game.inHandPlayers().length - 1;

  // 胜率估计
  let equity;
  if (stage === "preflop") {
    equity = preflopStrength(player.holeCards);
    // 对手越多，所需胜率越高，等效调整
    equity = Math.max(0, equity - 0.04 * Math.max(0, opponents - 1));
  } else {
    const iterations = level === "hard" ? 300 : level === "normal" ? 120 : 40;
    equity = monteCarloEquity(player.holeCards, game.community, opponents, iterations);
  }

  // 底池赔率
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

  // 位置因子：按钮位附近激进一些
  const seats = game.inHandPlayers().length;
  const myIdx = game.players.indexOf(player);
  const btnIdx = game.dealerIndex;
  const distFromBtn = ((myIdx - btnIdx) + game.players.length) % game.players.length;
  const positionBonus = (seats - distFromBtn) / seats * 0.04;
  const adjustedEquity = Math.min(0.98, equity + positionBonus);

  // 诈唬概率
  const bluffProb = level === "hard" ? 0.12 : level === "normal" ? 0.06 : 0.02;
  const willBluff = Math.random() < bluffProb && adjustedEquity < 0.3;

  // 激进度（加注倾向）
  const aggression = level === "hard" ? 0.75 : level === "normal" ? 0.55 : 0.35;

  // 决策树
  // 1. 免费过牌
  if (toCall === 0) {
    if (adjustedEquity > 0.6 || (willBluff && Math.random() < aggression)) {
      // 加注 / 下注
      const size = pickBetSize(pot, bigBlind, player.stack, adjustedEquity, aggression, minRaise, maxRaise);
      if (size >= minRaise && size <= maxRaise) {
        return { type: "raise", amount: size };
      }
    }
    return { type: "check" };
  }

  // 2. 需要跟注
  // 需要 equity > potOdds 才考虑跟注
  const margin = adjustedEquity - potOdds;

  // 极弱牌弃牌
  if (margin < -0.12 && !willBluff) {
    return { type: "fold" };
  }

  // 强牌：加注
  if (adjustedEquity > 0.72 && legalActions.includes("raise") && Math.random() < aggression) {
    const size = pickBetSize(pot, bigBlind, player.stack, adjustedEquity, aggression, minRaise, maxRaise);
    if (size >= minRaise && size <= maxRaise) {
      return { type: "raise", amount: size };
    }
    if (legalActions.includes("allin")) return { type: "allin" };
  }

  // 中等牌 + 小额跟注
  if (margin >= -0.05) {
    // 偶尔主动加注
    if (legalActions.includes("raise") && Math.random() < aggression * 0.3 && adjustedEquity > 0.55) {
      const size = Math.max(minRaise, Math.floor(pot * 0.6 + player.currentBet));
      if (size <= maxRaise) return { type: "raise", amount: size };
    }
    return { type: "call" };
  }

  // 诈唬加注
  if (willBluff && legalActions.includes("raise")) {
    const size = Math.max(minRaise, Math.floor(pot * 0.7 + player.currentBet));
    if (size <= maxRaise) return { type: "raise", amount: size };
  }

  // 默认弃牌
  return { type: "fold" };
}

function pickBetSize(pot, bigBlind, stack, equity, aggression, minRaise, maxRaise) {
  // 基于底池比例的下注（0.5x - 1.2x 底池），按 equity 调整
  const base = pot * (0.55 + equity * 0.7);
  const jitter = 0.8 + Math.random() * 0.4;
  let size = Math.floor(base * jitter);
  // 至少 2BB
  size = Math.max(size, bigBlind * 2);
  size = Math.max(size, minRaise);
  size = Math.min(size, maxRaise);
  // 强牌 + 激进：偶尔全下
  if (equity > 0.85 && Math.random() < aggression * 0.25) size = maxRaise;
  return size;
}

// AI 情绪表情（返回一个 emoji 或 null）
export function decideEmoji(action, equity) {
  const r = Math.random();
  if (action.type === "fold") return r < 0.3 ? "😮‍💨" : null;
  if (action.type === "allin") return r < 0.7 ? "🔥" : "💪";
  if (action.type === "raise") {
    if (equity > 0.7) return r < 0.35 ? "😎" : null;
    return r < 0.2 ? "😤" : null;
  }
  if (action.type === "call") return r < 0.12 ? "🤔" : null;
  return null;
}
