// 蒙特卡洛胜率估计 — 纯函数
//
// 这个文件**只做数学**，不依赖 DOM、Worker、setTimeout 等环境特性。
// 主线程和 Web Worker 都可以直接 import。
//
// 抽离动机：
//   - Worker 化（参见 equity.worker.js / equity-client.js）
//   - 引擎包独立化（未来 RN/Node 复用）
//   - 单元测试可直接 import 而无需打桩

import { bestOfSeven, compareHands, quickHandStrength } from "../engine/hand.js";
import { buildDeck } from "../engine/deck.js";

/**
 * 快速底牌强度（0..1）。仅基于 2 张底牌的启发式，用于翻前节省蒙特卡洛开销。
 * @param {string[]} hole 两张底牌
 */
export function preflopStrength(hole) {
  return quickHandStrength(hole).values[0];
}

/**
 * 模拟 N 轮对战 opponents 个随机对手，返回估计胜率。
 * @param {string[]} holeCards    自己的两张底牌，e.g. ["As","Kh"]
 * @param {string[]} community    已知公共牌（0/3/4/5 张）
 * @param {number}   opponents    对手数（>= 1）
 * @param {number}   iterations   模拟轮次（建议 100-500）
 * @returns {number}              0..1 之间的胜率（含按比例的平局贡献）
 */
export function monteCarloEquity(holeCards, community, opponents, iterations) {
  const known = new Set([...holeCards, ...community]);
  const base = buildDeck().filter((c) => !known.has(c));
  let wins = 0, ties = 0;

  for (let i = 0; i < iterations; i++) {
    // Fisher-Yates 部分洗牌（只洗到我们需要的张数即可，但完整洗也很快）
    const remaining = base.slice();
    for (let j = remaining.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [remaining[j], remaining[k]] = [remaining[k], remaining[j]];
    }
    let p = 0;

    // 给每个对手发 2 张
    const oppHoles = [];
    for (let o = 0; o < opponents; o++) {
      oppHoles.push([remaining[p++], remaining[p++]]);
    }

    // 补足公共牌到 5 张
    const simCommunity = community.slice();
    while (simCommunity.length < 5) simCommunity.push(remaining[p++]);

    const myHand = bestOfSeven([...holeCards, ...simCommunity]);
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
