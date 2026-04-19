// 公共 API 出入口测试
//
// 守卫意外删除导出 — 任何破坏外部消费方的改动都会在这里炸出来。

import { describe, it, expect } from "vitest";
import * as Engine from "../index.js";

describe("@arcadehub/holdem-engine · 公共 API 表面", () => {
  const expected = [
    // 状态机
    "Game", "STAGE", "STAGE_NAME_CN",
    // 牌型
    "bestOfSeven", "compareHands", "quickHandStrength", "HAND_NAME_CN",
    // 底池
    "buildPots", "splitPot",
    // 牌堆 / 工具
    "buildDeck", "shuffle", "randomSeed", "makePRNG",
    "RANKS", "SUITS", "RANK_VALUE",
    "SUIT_SYMBOL", "SUIT_NAME_CN", "RANK_NAME_CN",
    "cardCode", "cardRank", "cardSuit", "rankValue", "isRed",
  ];

  for (const name of expected) {
    it(`导出 ${name}`, () => {
      expect(Engine[name]).toBeDefined();
    });
  }

  it("Game 是构造函数", () => {
    expect(typeof Engine.Game).toBe("function");
    const g = new Engine.Game({
      players: [
        { id: "a", name: "A", stack: 1000, isHuman: true },
        { id: "b", name: "B", stack: 1000, isHuman: false },
      ],
      smallBlind: 25,
      bigBlind: 50,
    });
    expect(g.stage).toBe(Engine.STAGE.IDLE);
  });

  it("最小可工作示例（README 的开头几行）", () => {
    const r = Engine.bestOfSeven(["As", "Ks", "Qs", "Js", "Ts", "2c", "3d"]);
    expect(r.rank).toBe(9);
    expect(r.name).toBe(Engine.HAND_NAME_CN[9]);
  });
});
