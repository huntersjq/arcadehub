// 蒙特卡洛胜率主线程客户端
//
// 对外只暴露一个接口：requestEquity({...}) → Promise<number>
//
// 行为：
//   - 优先走 Web Worker（不阻塞主线程；河牌时 300 次模拟约 80–200 ms）
//   - Worker 不可用时（旧浏览器 / file:// 限制 / 沙盒）回退到同步计算
//   - 每个请求带 id，避免乱序响应；调用方自行管理"作废令牌"
//
// 调用方：
//   - ai/bot.js#decide()       AI 主决策
//   - ui/controls.js#_renderEquity()  人类回合的实时胜率

import { monteCarloEquity as syncEquity } from "./equity-core.js";

let workerInstance = null;
let workerBroken = false;
let nextId = 0;
const pending = new Map(); // id → { resolve, reject }

function getWorker() {
  if (workerBroken) return null;
  if (workerInstance) return workerInstance;
  try {
    // 浏览器原生 Web Worker（Module 模式）
    workerInstance = new Worker(new URL("./equity.worker.js", import.meta.url), { type: "module" });
    workerInstance.addEventListener("message", (e) => {
      const { id, equity, error } = e.data || {};
      const handlers = pending.get(id);
      if (!handlers) return;
      pending.delete(id);
      if (error) handlers.reject(new Error(error));
      else handlers.resolve(equity);
    });
    workerInstance.addEventListener("error", (e) => {
      // 任何 worker 级别错误都让所有 pending 失败 + 后续走同步降级
      console.warn("[equity worker] crashed, falling back to sync:", e.message || e);
      workerBroken = true;
      for (const [, h] of pending) h.reject(new Error("worker_crashed"));
      pending.clear();
      try { workerInstance.terminate(); } catch (_) {}
      workerInstance = null;
    });
  } catch (e) {
    console.warn("[equity worker] unavailable, using sync fallback:", e.message || e);
    workerBroken = true;
    workerInstance = null;
  }
  return workerInstance;
}

/**
 * 异步请求胜率。Worker 不可用时自动同步计算。
 * @param {object} params
 * @param {string[]} params.holeCards
 * @param {string[]} [params.community=[]]
 * @param {number}   params.opponents
 * @param {number}   params.iterations
 * @returns {Promise<number>}
 */
export function requestEquity({ holeCards, community = [], opponents, iterations }) {
  const w = getWorker();
  if (!w) {
    // 同步降级：下一帧执行避免阻塞调用栈
    return new Promise((resolve) => {
      setTimeout(() => resolve(syncEquity(holeCards, community, opponents, iterations)), 0);
    });
  }
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      w.postMessage({ id, holeCards, community, opponents, iterations });
    } catch (err) {
      pending.delete(id);
      reject(err);
    }
  });
}

/**
 * 强制销毁 worker（测试 / cleanup 用）
 */
export function disposeEquityWorker() {
  if (workerInstance) {
    try { workerInstance.terminate(); } catch (_) {}
  }
  workerInstance = null;
  workerBroken = false;
  for (const [, h] of pending) h.reject(new Error("disposed"));
  pending.clear();
}
