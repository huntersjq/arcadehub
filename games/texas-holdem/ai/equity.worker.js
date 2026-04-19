// 蒙特卡洛胜率 Web Worker
//
// 协议：
//   主线程  → { id, holeCards, community, opponents, iterations }
//   Worker  → { id, equity } 或 { id, error }
//
// 整个 worker 是 ES 模块（new Worker(url, { type: "module" })），
// 直接 import 引擎层。Worker 上下文没有 DOM、没有 cc.macro，绝不会被业务层污染。

import { monteCarloEquity } from "./equity-core.js";

self.addEventListener("message", (e) => {
  const { id, holeCards, community, opponents, iterations } = e.data || {};
  try {
    const equity = monteCarloEquity(holeCards, community || [], opponents || 1, iterations || 200);
    self.postMessage({ id, equity });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
});
