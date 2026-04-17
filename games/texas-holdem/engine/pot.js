// 德州扑克 - 底池 / 边池计算
// 输入：玩家列表 [{ id, totalBet, folded }]
// 输出：底池数组，每个 pot = { amount, eligible: Set<id> }

export function buildPots(players) {
  const pots = [];
  // 按 totalBet 从小到大分层
  const contributors = players.filter((p) => p.totalBet > 0);
  if (contributors.length === 0) return pots;

  const levels = [...new Set(contributors.map((p) => p.totalBet))].sort((a, b) => a - b);
  let previous = 0;

  for (const level of levels) {
    const sliceSize = level - previous;
    if (sliceSize <= 0) { previous = level; continue; }

    let amount = 0;
    const eligible = new Set();

    for (const p of players) {
      if (p.totalBet > previous) {
        const contributed = Math.min(p.totalBet, level) - previous;
        if (contributed > 0) amount += contributed;
        if (p.totalBet >= level && !p.folded) eligible.add(p.id);
      }
    }

    if (amount > 0) pots.push({ amount, eligible });
    previous = level;
  }

  // 合并相邻且 eligible 相同的池
  const merged = [];
  for (const pot of pots) {
    const last = merged[merged.length - 1];
    if (last && setsEqual(last.eligible, pot.eligible)) {
      last.amount += pot.amount;
    } else {
      merged.push(pot);
    }
  }
  return merged;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// 计算某个池的赢家分账
export function splitPot(pot, winnerIds) {
  const share = Math.floor(pot.amount / winnerIds.length);
  const remainder = pot.amount - share * winnerIds.length;
  return winnerIds.map((id, i) => ({ id, amount: share + (i < remainder ? 1 : 0) }));
}
