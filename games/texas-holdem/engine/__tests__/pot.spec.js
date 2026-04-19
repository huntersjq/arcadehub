// 底池 / 边池构造测试
//
// 关键场景：
//   - 单一主池
//   - all-in 触发的边池分层
//   - 多个 all-in 嵌套
//   - 弃牌玩家的筹码留在池里但不分账资格
//   - splitPot 余数处理

import { describe, it, expect } from "vitest";
import { buildPots, splitPot } from "../pot.js";

describe("buildPots · 单一主池", () => {
  it("两人等额下注 → 一个池，两人都有资格", () => {
    const pots = buildPots([
      { id: "a", totalBet: 100, folded: false },
      { id: "b", totalBet: 100, folded: false },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(200);
    expect([...pots[0].eligible].sort()).toEqual(["a", "b"]);
  });

  it("三人不同投入但都没全押 → 一个池（按最大投入分层后合并）", () => {
    // 三人都跟到底，最后下注一致（200）
    const pots = buildPots([
      { id: "a", totalBet: 200, folded: false },
      { id: "b", totalBet: 200, folded: false },
      { id: "c", totalBet: 200, folded: false },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(600);
    expect([...pots[0].eligible].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("buildPots · 边池触发", () => {
  it("a 全押 100，b/c 跟注 200 → 主池 300（abc 资格）+ 边池 200（bc 资格）", () => {
    const pots = buildPots([
      { id: "a", totalBet: 100, folded: false },
      { id: "b", totalBet: 200, folded: false },
      { id: "c", totalBet: 200, folded: false },
    ]);
    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(300);                          // 100 × 3
    expect([...pots[0].eligible].sort()).toEqual(["a", "b", "c"]);
    expect(pots[1].amount).toBe(200);                          // 100 × 2
    expect([...pots[1].eligible].sort()).toEqual(["b", "c"]);
  });

  it("两个嵌套 all-in：a=50, b=120, c=200 → 三层池", () => {
    const pots = buildPots([
      { id: "a", totalBet: 50,  folded: false },
      { id: "b", totalBet: 120, folded: false },
      { id: "c", totalBet: 200, folded: false },
    ]);
    expect(pots).toHaveLength(3);
    // Layer 1: 50 from each = 150, eligible abc
    expect(pots[0].amount).toBe(150);
    expect([...pots[0].eligible].sort()).toEqual(["a", "b", "c"]);
    // Layer 2: 70 from b,c = 140, eligible bc
    expect(pots[1].amount).toBe(140);
    expect([...pots[1].eligible].sort()).toEqual(["b", "c"]);
    // Layer 3: 80 from c = 80, eligible c (no contest)
    expect(pots[2].amount).toBe(80);
    expect([...pots[2].eligible]).toEqual(["c"]);
  });
});

describe("buildPots · 弃牌玩家", () => {
  it("弃牌玩家的筹码留池但无资格", () => {
    const pots = buildPots([
      { id: "a", totalBet: 100, folded: true },   // 弃牌
      { id: "b", totalBet: 100, folded: false },
      { id: "c", totalBet: 100, folded: false },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);              // 弃牌玩家的钱依然在
    expect([...pots[0].eligible].sort()).toEqual(["b", "c"]); // 但只 bc 有资格
  });

  it("a 全押 50 然后被弃牌的 b/c 跟到 100 → 主池 200（仅 a 资格）+ 边池 100（无人有资格）", () => {
    const pots = buildPots([
      { id: "a", totalBet: 50,  folded: false },
      { id: "b", totalBet: 100, folded: true },
      { id: "c", totalBet: 100, folded: true },
    ]);
    // 主池：50×3 = 150（a/b/c 投入），仅 a 没弃牌
    expect(pots[0].amount).toBe(150);
    expect([...pots[0].eligible]).toEqual(["a"]);
    // 边池：50×2 = 100（b/c 投入），但 b/c 都弃牌了 → eligible 为空
    expect(pots[1].amount).toBe(100);
    expect(pots[1].eligible.size).toBe(0);
  });
});

describe("buildPots · 边界", () => {
  it("没有人下注 → 空数组", () => {
    expect(buildPots([])).toEqual([]);
    expect(buildPots([
      { id: "a", totalBet: 0, folded: false },
    ])).toEqual([]);
  });

  it("相邻层 eligible 相同时应当合并", () => {
    // a 200, b 200, c 全部弃牌且 totalBet 0 → 应合并为单一池
    const pots = buildPots([
      { id: "a", totalBet: 200, folded: false },
      { id: "b", totalBet: 200, folded: false },
      { id: "c", totalBet: 0,   folded: true  },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(400);
  });
});

describe("splitPot · 分账", () => {
  it("整除：单赢家拿全部", () => {
    const splits = splitPot({ amount: 300, eligible: new Set(["a"]) }, ["a"]);
    expect(splits).toEqual([{ id: "a", amount: 300 }]);
  });

  it("整除：两人均分", () => {
    const splits = splitPot({ amount: 200, eligible: new Set(["a", "b"]) }, ["a", "b"]);
    expect(splits).toEqual([
      { id: "a", amount: 100 },
      { id: "b", amount: 100 },
    ]);
  });

  it("有余数时前几位多 1（保证总和不变）", () => {
    const splits = splitPot({ amount: 101, eligible: new Set(["a", "b"]) }, ["a", "b"]);
    const total = splits.reduce((s, x) => s + x.amount, 0);
    expect(total).toBe(101);
    expect(splits[0].amount).toBe(51); // 多 1
    expect(splits[1].amount).toBe(50);
  });

  it("三人分 100，余 1 → 一人多拿 1", () => {
    const splits = splitPot({ amount: 100, eligible: new Set(["a", "b", "c"]) }, ["a", "b", "c"]);
    const total = splits.reduce((s, x) => s + x.amount, 0);
    expect(total).toBe(100);
    expect(splits.map((s) => s.amount).sort()).toEqual([33, 33, 34]);
  });
});
