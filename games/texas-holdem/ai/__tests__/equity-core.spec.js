// 纯数学层测试（Worker 在浏览器里跑，这里只测算法本身）
//
// 蒙特卡洛是随机算法，无法断言精确值，但可以断言**单调性**和**合理范围**。

import { describe, it, expect } from "vitest";
import { monteCarloEquity, preflopStrength } from "../equity-core.js";

describe("monteCarloEquity · 单调性", () => {
  it("AA 对单一对手胜率应 > 80%", () => {
    const eq = monteCarloEquity(["As", "Ah"], [], 1, 200);
    expect(eq).toBeGreaterThan(0.8);
  }, 5000);

  it("7-2 不同花对单一对手胜率应 < 40%", () => {
    const eq = monteCarloEquity(["7s", "2d"], [], 1, 200);
    expect(eq).toBeLessThan(0.4);
  }, 5000);

  it("AA 翻后到 A-K-Q board 仍应 > 60%（虽然有同花/顺子可能）", () => {
    const eq = monteCarloEquity(["As", "Ah"], ["Ad", "Kc", "Qh"], 1, 200);
    expect(eq).toBeGreaterThan(0.6);
  }, 5000);

  it("拥有皇家同花顺（unbeatable）应 = 100%", () => {
    const eq = monteCarloEquity(
      ["As", "Ks"],
      ["Qs", "Js", "Ts"],
      1,
      80,
    );
    expect(eq).toBe(1);
  });

  it("增加对手数量胜率单调下降（同样底牌）", () => {
    const a = monteCarloEquity(["As", "Ah"], [], 1, 250);
    const b = monteCarloEquity(["As", "Ah"], [], 4, 250);
    expect(a).toBeGreaterThan(b);
  }, 8000);
});

describe("monteCarloEquity · 边界", () => {
  it("0 对手时应回 1（无人挑战）", () => {
    // 实际不该 0 对手调用，但函数不应该崩
    const eq = monteCarloEquity(["As", "Ah"], [], 0, 50);
    // 0 对手 → 没人能击败你 → 应该是 1.0
    expect(eq).toBe(1);
  });

  it("iterations = 0 时返回 NaN（除以 0）", () => {
    const eq = monteCarloEquity(["As", "Ah"], [], 1, 0);
    expect(Number.isNaN(eq)).toBe(true);
  });
});

describe("preflopStrength", () => {
  it("AA 比 22 强", () => {
    expect(preflopStrength(["As", "Ah"])).toBeGreaterThan(preflopStrength(["2s", "2h"]));
  });
  it("同花连张 JT 比非同花 JT 强", () => {
    expect(preflopStrength(["Js", "Ts"])).toBeGreaterThan(preflopStrength(["Js", "Th"]));
  });
});
