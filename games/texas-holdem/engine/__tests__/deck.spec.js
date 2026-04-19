// 牌堆 / 洗牌测试
//
// 关键点：
//   - buildDeck 给出 52 张唯一牌
//   - shuffle 是确定性的（同 seed 同结果），用于联机同步
//   - shuffle 不同 seed 给出不同结果
//   - PRNG 在 0..1 区间，覆盖各档位

import { describe, it, expect } from "vitest";
import {
  buildDeck, shuffle, makePRNG, randomSeed,
  RANK_VALUE, SUITS, RANKS, isRed,
} from "../deck.js";

describe("buildDeck", () => {
  it("应当给出 52 张牌", () => {
    expect(buildDeck()).toHaveLength(52);
  });
  it("52 张牌应全部唯一", () => {
    const deck = buildDeck();
    expect(new Set(deck).size).toBe(52);
  });
  it("4 个花色 × 13 个点数都齐全", () => {
    const deck = buildDeck();
    for (const s of SUITS) {
      for (const r of RANKS) {
        expect(deck).toContain(r + s);
      }
    }
  });
});

describe("RANK_VALUE", () => {
  it("2 → 2, A → 14", () => {
    expect(RANK_VALUE["2"]).toBe(2);
    expect(RANK_VALUE.A).toBe(14);
    expect(RANK_VALUE.T).toBe(10);
  });
});

describe("isRed", () => {
  it("红心方块为红，黑桃梅花为黑", () => {
    expect(isRed("Ah")).toBe(true);
    expect(isRed("2d")).toBe(true);
    expect(isRed("Ks")).toBe(false);
    expect(isRed("9c")).toBe(false);
  });
});

describe("shuffle · 确定性", () => {
  it("同 seed 同结果（联机同步保证）", () => {
    const a = shuffle(buildDeck(), 12345);
    const b = shuffle(buildDeck(), 12345);
    expect(a).toEqual(b);
  });
  it("不同 seed 不同结果", () => {
    const a = shuffle(buildDeck(), 12345);
    const b = shuffle(buildDeck(), 12346);
    expect(a).not.toEqual(b);
  });
  it("洗牌后仍是 52 张唯一", () => {
    const a = shuffle(buildDeck(), 999);
    expect(a).toHaveLength(52);
    expect(new Set(a).size).toBe(52);
  });
  it("不传 seed 时使用 Math.random（每次不同）", () => {
    const a = shuffle(buildDeck());
    const b = shuffle(buildDeck());
    // 极小概率失败（1/52!），可忽略
    expect(a).not.toEqual(b);
  });
});

describe("makePRNG · mulberry32", () => {
  it("输出在 [0, 1) 区间", () => {
    const rand = makePRNG(42);
    for (let i = 0; i < 200; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("同 seed 序列相同", () => {
    const a = makePRNG(7);
    const b = makePRNG(7);
    for (let i = 0; i < 50; i++) {
      expect(a()).toBe(b());
    }
  });
});

describe("randomSeed", () => {
  it("产生 32-bit unsigned 整数", () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
    }
  });
});
