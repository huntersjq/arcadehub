// 德州扑克 - AI 决策
//
// 三档难度：
//   easy   新手：看底牌强度，极少加注，少诈唬
//   normal 普通：考虑底池赔率、位置
//   hard   高手：蒙特卡洛模拟 + 诈唬 + 对手建模
//
// 暴露：
//   decide(game, player, ctx) → Promise<{ type, amount? }>     ← 异步！
//   decideEmoji(action, equity) → string | null
//   preflopStrength(hole) → number                              ← 同步（轻量）
//
// 蒙特卡洛走 Web Worker（不阻塞主线程；详见 equity-client.js）。
// 旧浏览器 / 沙盒环境会自动同步降级。

import { requestEquity } from "./equity-client.js";
import { preflopStrength } from "./equity-core.js";

// 重新导出，保持外部 API 形状
export { preflopStrength };

// ── 主决策 ──

export async function decide(game, player, ctx) {
  const { toCall, minRaise, maxRaise, pot, bigBlind, legalActions } = ctx;
  const level = player.aiLevel || "normal";
  const stage = game.stage;
  const opponents = game.inHandPlayers().length - 1;

  // 1. 胜率估计
  let equity;
  if (stage === "preflop") {
    equity = preflopStrength(player.holeCards);
    equity = Math.max(0, equity - 0.04 * Math.max(0, opponents - 1));
  } else {
    const iterations = level === "hard" ? 300 : level === "normal" ? 120 : 40;
    try {
      equity = await requestEquity({
        holeCards: player.holeCards,
        community: game.community,
        opponents,
        iterations,
      });
    } catch (_) {
      // worker 异常 → 退化到翻前启发，确保 AI 不会卡住
      equity = preflopStrength(player.holeCards);
    }
  }

  // 2. 底池赔率
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

  // 3. 位置因子（按钮位附近激进一些）
  const seats = game.inHandPlayers().length;
  const myIdx = game.players.indexOf(player);
  const btnIdx = game.dealerIndex;
  const distFromBtn = ((myIdx - btnIdx) + game.players.length) % game.players.length;
  const positionBonus = (seats - distFromBtn) / seats * 0.04;
  const adjustedEquity = Math.min(0.98, equity + positionBonus);

  // 4. 诈唬 / 激进度
  const bluffProb = level === "hard" ? 0.12 : level === "normal" ? 0.06 : 0.02;
  const willBluff = Math.random() < bluffProb && adjustedEquity < 0.3;
  const aggression = level === "hard" ? 0.75 : level === "normal" ? 0.55 : 0.35;

  // ── 决策树 ──

  // 5. 免费过牌
  if (toCall === 0) {
    if (adjustedEquity > 0.6 || (willBluff && Math.random() < aggression)) {
      const size = pickBetSize(pot, bigBlind, player.stack, adjustedEquity, aggression, minRaise, maxRaise);
      if (size >= minRaise && size <= maxRaise) {
        return { type: "raise", amount: size };
      }
    }
    return { type: "check" };
  }

  // 6. 需要跟注
  const margin = adjustedEquity - potOdds;

  // 极弱牌弃牌
  if (margin < -0.12 && !willBluff) return { type: "fold" };

  // 强牌：加注
  if (adjustedEquity > 0.72 && legalActions.includes("raise") && Math.random() < aggression) {
    const size = pickBetSize(pot, bigBlind, player.stack, adjustedEquity, aggression, minRaise, maxRaise);
    if (size >= minRaise && size <= maxRaise) return { type: "raise", amount: size };
    if (legalActions.includes("allin")) return { type: "allin" };
  }

  // 中等牌 + 小额跟注
  if (margin >= -0.05) {
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

  return { type: "fold" };
}

function pickBetSize(pot, bigBlind, stack, equity, aggression, minRaise, maxRaise) {
  const base = pot * (0.55 + equity * 0.7);
  const jitter = 0.8 + Math.random() * 0.4;
  let size = Math.floor(base * jitter);
  size = Math.max(size, bigBlind * 2);
  size = Math.max(size, minRaise);
  size = Math.min(size, maxRaise);
  if (equity > 0.85 && Math.random() < aggression * 0.25) size = maxRaise;
  return size;
}

// ── 表情 ──

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
