// 牌型判定测试
//
// 目标：覆盖每一个 rank 的边界情况 + bestOfSeven 7选5 + compareHands 平局/分胜负。
// 命名约定：用真实牌（"Ah" = 红心 A）写 fixture，注释解释期望牌型。

import { describe, it, expect } from "vitest";
import { bestOfSeven, compareHands, HAND_NAME_CN, quickHandStrength } from "../hand.js";

const RANK = {
  HIGH:        0,
  PAIR:        1,
  TWO_PAIR:    2,
  TRIPS:       3,
  STRAIGHT:    4,
  FLUSH:       5,
  FULL_HOUSE:  6,
  QUADS:       7,
  STRAIGHT_FL: 8,
  ROYAL:       9,
};

// 工具：bestOfSeven 简写
const best = (...cards) => bestOfSeven(cards);

describe("bestOfSeven · 皇家同花顺 (rank 9)", () => {
  it("识别黑桃皇家同花顺", () => {
    const r = best("As", "Ks", "Qs", "Js", "Ts", "2h", "3d");
    expect(r.rank).toBe(RANK.ROYAL);
    expect(r.name).toBe(HAND_NAME_CN[RANK.ROYAL]);
    expect(r.values[0]).toBe(14);
  });
  it("识别红心皇家同花顺（混在 7 张中）", () => {
    const r = best("Ah", "5d", "Kh", "Jh", "Qh", "Th", "9c");
    expect(r.rank).toBe(RANK.ROYAL);
  });
});

describe("bestOfSeven · 同花顺 (rank 8)", () => {
  it("识别 9 高同花顺", () => {
    const r = best("9c", "8c", "7c", "6c", "5c", "Kh", "2d");
    expect(r.rank).toBe(RANK.STRAIGHT_FL);
    expect(r.values[0]).toBe(9);
  });
  it("识别 A-2-3-4-5 轮子同花顺（最低同花顺）", () => {
    const r = best("Ah", "2h", "3h", "4h", "5h", "Kc", "Qd");
    expect(r.rank).toBe(RANK.STRAIGHT_FL);
    expect(r.values[0]).toBe(5); // 5 高，不是 A 高
  });
  it("更高同花顺击败更低同花顺", () => {
    const high = best("9s", "8s", "7s", "6s", "5s", "2c", "3d");
    const low  = best("8h", "7h", "6h", "5h", "4h", "Kc", "Qd");
    expect(compareHands(high, low)).toBeGreaterThan(0);
  });
});

describe("bestOfSeven · 四条 (rank 7)", () => {
  it("识别 AAAA + K 踢脚", () => {
    const r = best("As", "Ah", "Ad", "Ac", "Kh", "2c", "3d");
    expect(r.rank).toBe(RANK.QUADS);
    expect(r.values).toEqual([14, 13]);
  });
  it("低四条 + 高踢脚（2222 + A）", () => {
    const r = best("2s", "2h", "2d", "2c", "Ah", "5c", "9d");
    expect(r.rank).toBe(RANK.QUADS);
    expect(r.values).toEqual([2, 14]);
  });
  it("四条击败葫芦", () => {
    const quads = best("7s", "7h", "7d", "7c", "Kh", "2c", "3d");
    const fh    = best("As", "Ah", "Ad", "Kh", "Kc", "2c", "3d");
    expect(compareHands(quads, fh)).toBeGreaterThan(0);
  });
  it("同四条比踢脚（AAAA K vs AAAA Q）", () => {
    const k = best("As", "Ah", "Ad", "Ac", "Kh", "Qd", "2c");
    // 注意：7 张里只有一个 K 一个 Q，eval5 选 4A + K 是最大
    expect(k.values).toEqual([14, 13]);
  });
});

describe("bestOfSeven · 葫芦 (rank 6)", () => {
  it("识别 AAA KK", () => {
    const r = best("As", "Ah", "Ad", "Kh", "Kc", "2c", "3d");
    expect(r.rank).toBe(RANK.FULL_HOUSE);
    expect(r.values).toEqual([14, 13]);
  });
  it("两组葫芦时取大的（AAA KK + JJ → AAA KK）", () => {
    const r = best("As", "Ah", "Ad", "Kh", "Kc", "Jh", "Jd");
    expect(r.rank).toBe(RANK.FULL_HOUSE);
    expect(r.values).toEqual([14, 13]);
  });
  it("三条优先级：KKK 22 击败 222 KK", () => {
    const a = best("Ks", "Kh", "Kd", "2c", "2d", "5h", "7s");
    const b = best("2s", "2h", "2d", "Kc", "Kd", "5h", "7s");
    expect(a.rank).toBe(RANK.FULL_HOUSE);
    expect(b.rank).toBe(RANK.FULL_HOUSE);
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });
  it("葫芦击败同花", () => {
    const fh = best("As", "Ah", "Ad", "Kh", "Kc", "2s", "3s");
    const fl = best("As", "Ks", "Js", "9s", "5s", "2h", "3d");
    expect(compareHands(fh, fl)).toBeGreaterThan(0);
  });
});

describe("bestOfSeven · 同花 (rank 5)", () => {
  it("识别 A 高同花", () => {
    const r = best("As", "Ks", "9s", "5s", "2s", "Th", "3d");
    expect(r.rank).toBe(RANK.FLUSH);
    expect(r.values[0]).toBe(14);
  });
  it("低同花（2 高）也能识别", () => {
    const r = best("8s", "7s", "5s", "3s", "2s", "Ah", "Kd");
    expect(r.rank).toBe(RANK.FLUSH);
    expect(r.values[0]).toBe(8);
  });
  it("同花互比从最高位开始", () => {
    const a = best("As", "Ks", "9s", "5s", "2s", "Th", "3d");
    const b = best("Ah", "Qh", "Jh", "9h", "5h", "Tc", "3d");
    expect(compareHands(a, b)).toBeGreaterThan(0); // K > Q
  });
  it("同花击败顺子", () => {
    const fl = best("As", "Ks", "9s", "5s", "2s", "Th", "3d");
    const st = best("9c", "8d", "7s", "6h", "5d", "2c", "3h");
    expect(compareHands(fl, st)).toBeGreaterThan(0);
  });
  it("7 张中有 6 张同花时仍取最优 5 张", () => {
    const r = best("As", "Ks", "Qs", "9s", "5s", "2s", "3d");
    expect(r.rank).toBe(RANK.FLUSH);
    expect(r.values.slice(0, 5)).toEqual([14, 13, 12, 9, 5]);
  });
});

describe("bestOfSeven · 顺子 (rank 4)", () => {
  it("识别 A 高顺子（TJQKA）", () => {
    const r = best("As", "Kh", "Qd", "Jc", "Th", "2c", "3d");
    expect(r.rank).toBe(RANK.STRAIGHT);
    expect(r.values[0]).toBe(14);
  });
  it("识别轮子 A-2-3-4-5（A 当 1）", () => {
    const r = best("Ah", "2c", "3d", "4s", "5h", "Kh", "Qh");
    expect(r.rank).toBe(RANK.STRAIGHT);
    expect(r.values[0]).toBe(5);
  });
  it("6 高顺子击败 5 高轮子", () => {
    const six = best("6h", "5d", "4c", "3s", "2h", "Kh", "Qd");
    const wheel = best("Ah", "2c", "3d", "4s", "5h", "Kc", "9d");
    expect(compareHands(six, wheel)).toBeGreaterThan(0);
  });
  it("顺子击败三条", () => {
    const st = best("9h", "8c", "7d", "6s", "5h", "2c", "3d");
    const trips = best("Ah", "Ac", "Ad", "Ks", "Qh", "5c", "2d");
    expect(compareHands(st, trips)).toBeGreaterThan(0);
  });
  it("7 张含 6 连张时取最高 5 连（23456 + 7 → 34567）", () => {
    const r = best("2c", "3d", "4s", "5h", "6c", "7d", "Kh");
    expect(r.rank).toBe(RANK.STRAIGHT);
    expect(r.values[0]).toBe(7);
  });
});

describe("bestOfSeven · 三条 (rank 3)", () => {
  it("识别 AAA + KQ 踢脚", () => {
    const r = best("As", "Ah", "Ad", "Kh", "Qc", "2s", "3d");
    expect(r.rank).toBe(RANK.TRIPS);
    expect(r.values).toEqual([14, 13, 12]);
  });
  it("三条击败两对", () => {
    const trips = best("7s", "7h", "7d", "Kh", "Qc", "2s", "3d");
    const tp    = best("As", "Ah", "Kd", "Kc", "5s", "2h", "3d");
    expect(compareHands(trips, tp)).toBeGreaterThan(0);
  });
});

describe("bestOfSeven · 两对 (rank 2)", () => {
  it("识别 AA KK + Q 踢脚", () => {
    const r = best("As", "Ah", "Kd", "Kc", "Qh", "2c", "3d");
    expect(r.rank).toBe(RANK.TWO_PAIR);
    expect(r.values).toEqual([14, 13, 12]);
    // bug fix verification: cards 必须存在（之前 eval5 漏了）
    expect(r.cards).toBeDefined();
    expect(r.cards.length).toBe(5);
  });
  it("3 对时取最高的两对", () => {
    const r = best("As", "Ah", "Kd", "Kc", "Qh", "Qc", "3d");
    expect(r.rank).toBe(RANK.TWO_PAIR);
    expect(r.values).toEqual([14, 13, 12]); // AA KK + Q 踢脚（不是 AA QQ）
  });
  it("高对优先：AA QQ + K 击败 KK QQ + A", () => {
    const a = best("As", "Ah", "Qd", "Qc", "Kh", "2c", "3d");
    const b = best("Ks", "Kh", "Qd", "Qc", "Ah", "2c", "3d");
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });
  it("两对相同时比踢脚（AAKK7 vs AAKK5）", () => {
    const a = best("As", "Ah", "Kd", "Kc", "7h", "2c", "3d");
    const b = best("Ad", "Ac", "Ks", "Kh", "5d", "2s", "3h");
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });
});

describe("bestOfSeven · 一对 (rank 1)", () => {
  it("识别 AA + KQJ 踢脚", () => {
    const r = best("As", "Ah", "Kd", "Qc", "Jh", "2s", "3d");
    expect(r.rank).toBe(RANK.PAIR);
    expect(r.values).toEqual([14, 13, 12, 11]);
  });
  it("一对击败高牌", () => {
    const pair = best("2s", "2h", "Kd", "Qc", "Jh", "5s", "3d");
    const high = best("Ah", "Kd", "Qc", "Jh", "9s", "5s", "3d");
    expect(compareHands(pair, high)).toBeGreaterThan(0);
  });
});

describe("bestOfSeven · 高牌 (rank 0)", () => {
  it("识别 A 高 + KQJ9 踢脚", () => {
    const r = best("Ah", "Kd", "Qc", "Jh", "9s", "5s", "3d");
    expect(r.rank).toBe(RANK.HIGH);
    expect(r.values.slice(0, 5)).toEqual([14, 13, 12, 11, 9]);
  });
  it("高牌互比从最高位开始", () => {
    const a = best("Ah", "Kd", "Qc", "Jh", "9s", "5s", "3d");
    const b = best("Ah", "Kd", "Qc", "Jh", "8s", "5s", "3d");
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });
});

describe("compareHands · 平局 / 分账", () => {
  it("完全相同的同花返回 0（split pot）", () => {
    const board = ["As", "Ks", "Qs", "Js", "9s"]; // 公共牌已是同花
    const a = best(...board, "2c", "3d");
    const b = best(...board, "4c", "5d");
    expect(compareHands(a, b)).toBe(0);
  });
  it("两人共享公共牌顺子 → 平局", () => {
    const board = ["8h", "7c", "6d", "5s", "4h"]; // 公牌顺子
    const a = best(...board, "Kc", "Qh"); // 8 高
    const b = best(...board, "2s", "3d"); // 8 高
    expect(compareHands(a, b)).toBe(0);
  });
});

describe("quickHandStrength · 翻前启发", () => {
  it("AA 应当 ≥ KK", () => {
    const aa = quickHandStrength(["As", "Ah"]).values[0];
    const kk = quickHandStrength(["Ks", "Kh"]).values[0];
    expect(aa).toBeGreaterThanOrEqual(kk);
  });
  it("同花连张比非同花高", () => {
    const ts = quickHandStrength(["Ts", "9s"]).values[0];
    const to = quickHandStrength(["Th", "9d"]).values[0];
    expect(ts).toBeGreaterThan(to);
  });
  it("最弱组合 7-2 不同花应在低区", () => {
    const v = quickHandStrength(["7s", "2d"]).values[0];
    expect(v).toBeLessThan(0.4);
  });
  it("最强组合 AA 应在高区", () => {
    const v = quickHandStrength(["As", "Ah"]).values[0];
    expect(v).toBeGreaterThan(0.95);
  });
});

describe("rank 名称中文映射", () => {
  it("0..9 对应 高牌→皇家同花顺", () => {
    expect(HAND_NAME_CN[0]).toBe("高牌");
    expect(HAND_NAME_CN[4]).toBe("顺子");
    expect(HAND_NAME_CN[5]).toBe("同花");
    expect(HAND_NAME_CN[6]).toBe("葫芦");
    expect(HAND_NAME_CN[9]).toBe("皇家同花顺");
  });
});
