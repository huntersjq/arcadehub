// Pre-action（提前行动）— 在自己回合到来前，先勾一个动作；轮到时自动执行。
//
// 两种类型（参考 WePoker / PokerStars 设计）：
//   "fold-or-check"   过/弃   一次性，应用一次后自动清除
//   "call-down"       跟/过到底   多街粘附，直到玩家自己取消或本手结束
//
// 不持久化到 localStorage —— 这是单手内的临时偏好，每手开新都重置。

let _pre = null;

export function getPreAction() { return _pre; }

export function setPreAction(v) {
  _pre = (v === "fold-or-check" || v === "call-down") ? v : null;
}

export function clearPreAction() { _pre = null; }

/**
 * 给定当前 action 上下文（来自 buildActionContextFromGame），
 * 返回应当替玩家自动执行的 action，或 null 表示不适用。
 *
 * 也会按需自动取消一次性 pre-action（一次性的在调用方 dispatch 后清掉即可）。
 */
export function resolvePreAction(ctx) {
  if (!_pre) return null;
  if (_pre === "fold-or-check") {
    if (ctx.legalActions.includes("check")) return { type: "check" };
    return { type: "fold" };
  }
  if (_pre === "call-down") {
    if (ctx.legalActions.includes("check")) return { type: "check" };
    if (ctx.legalActions.includes("call")) return { type: "call" };
    // toCall 大于自己 stack 时退化到 fold 太激进；让 UI 弹出来由玩家决定
    return null;
  }
  return null;
}

export function isOneShot(type) {
  return type === "fold-or-check";
}
