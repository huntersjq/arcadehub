// Game 状态机冒烟测试
//
// 目标：跑完一手牌的关键路径，验证：
//   - 盲注扣除
//   - applyAction 推进
//   - 阶段切换正确（preflop → flop → turn → river → showdown）
//   - hand_over 后筹码总和守恒
//   - 弃牌至剩 1 人时直接结算
//
// 用确定性 seed，结果可复现。

import { describe, it, expect } from "vitest";
import { Game, STAGE } from "../game.js";

function makeGame(opts = {}) {
  return new Game({
    players: [
      { id: "p1", name: "P1", stack: 1000, isHuman: true },
      { id: "p2", name: "P2", stack: 1000, isHuman: false, aiLevel: "easy" },
      { id: "p3", name: "P3", stack: 1000, isHuman: false, aiLevel: "easy" },
    ],
    smallBlind: 25,
    bigBlind: 50,
    blindsMode: "fixed",
    ...opts,
  });
}

describe("Game · 起手流程", () => {
  it("初始 stage 为 IDLE", () => {
    const g = makeGame();
    expect(g.stage).toBe(STAGE.IDLE);
  });

  it("action_required 事件附带 deadline 字段（默认 15s）", () => {
    const g = makeGame();
    g.startHand(42);
    const ev = g.drainEvents().find((e) => e.type === "action_required");
    expect(ev).toBeTruthy();
    expect(ev.timeoutMs).toBe(15000);
    expect(ev.deadline).toBeGreaterThan(Date.now());
    expect(ev.deadline).toBeLessThanOrEqual(Date.now() + 15000);
  });

  it("actionTimeoutMs=0 时不发送 deadline（不限时模式）", () => {
    const g = makeGame({ actionTimeoutMs: 0 });
    g.startHand(42);
    const ev = g.drainEvents().find((e) => e.type === "action_required");
    expect(ev.timeoutMs).toBe(0);
    expect(ev.deadline).toBe(0);
  });

  it("startHand 后进入 PREFLOP，盲注已下，每人两张底牌", () => {
    const g = makeGame();
    g.startHand(42);
    expect(g.stage).toBe(STAGE.PREFLOP);
    expect(g.community).toEqual([]);
    for (const p of g.players) {
      expect(p.holeCards).toHaveLength(2);
    }
    // 至少有一个小盲一个大盲
    const blinds = g.drainEvents().filter((e) => e.type === "blind");
    expect(blinds).toHaveLength(2);
    expect(blinds[0].label).toBe("sb");
    expect(blinds[1].label).toBe("bb");
  });

  it("筹码总和在开局后守恒", () => {
    const g = makeGame();
    const before = g.players.reduce((s, p) => s + p.stack, 0);
    g.startHand(42);
    const after = g.players.reduce((s, p) => s + p.stack, 0) + g.pot;
    expect(after).toBe(before);
  });
});

describe("Game · 完整一手（全员弃牌至剩 1 人）", () => {
  it("除大盲外全部弃牌 → 大盲拿到所有底池", () => {
    const g = makeGame();
    g.startHand(42);
    g.drainEvents();

    // 找到第一个 action_required 的玩家，连续弃牌直到剩 1 人
    let safetyCounter = 0;
    while (g.stage !== STAGE.HAND_OVER && g.stage !== STAGE.GAME_OVER) {
      if (safetyCounter++ > 20) throw new Error("infinite loop guard");
      const idx = g.actionIndex;
      const p = g.players[idx];
      const r = g.applyAction(p.id, { type: "fold" });
      expect(r.ok).toBe(true);
    }

    expect(g.stage).toBe(STAGE.HAND_OVER);
    const inHand = g.players.filter((p) => !p.folded);
    expect(inHand).toHaveLength(1);

    // 总筹码守恒
    const total = g.players.reduce((s, p) => s + p.stack, 0);
    expect(total).toBe(3000);
  });
});

describe("Game · 完整一手（连续过牌至摊牌）", () => {
  it("preflop 全员跟注 → flop/turn/river 全员过牌 → 摊牌", () => {
    const g = makeGame();
    g.startHand(42);

    // 翻前：每人都跟注到 BB
    let safety = 0;
    let stage = g.stage;
    let i = 0;
    while (g.stage === STAGE.PREFLOP) {
      if (safety++ > 20) throw new Error("preflop loop");
      const p = g.players[g.actionIndex];
      const events = g.drainEvents();
      const askEvent = events.reverse().find((e) => e.type === "action_required");
      const toCall = askEvent ? askEvent.toCall : 0;
      g.applyAction(p.id, toCall > 0 ? { type: "call" } : { type: "check" });
    }
    expect(g.stage).toBe(STAGE.FLOP);
    expect(g.community).toHaveLength(3);

    // 翻牌、转牌、河牌：全员过牌
    for (const expectStage of [STAGE.FLOP, STAGE.TURN, STAGE.RIVER]) {
      expect(g.stage).toBe(expectStage);
      let s = 0;
      while (g.stage === expectStage) {
        if (s++ > 10) throw new Error("street loop");
        const p = g.players[g.actionIndex];
        g.applyAction(p.id, { type: "check" });
      }
    }

    // 应摊牌或已结束
    expect([STAGE.SHOWDOWN, STAGE.HAND_OVER]).toContain(g.stage);
    const events = g.drainEvents();
    const showdownEv = events.find((e) => e.type === "showdown");
    expect(showdownEv).toBeTruthy();
    expect(showdownEv.community).toHaveLength(5);

    // 筹码守恒
    const total = g.players.reduce((s, p) => s + p.stack, 0);
    expect(total).toBe(3000);
  });
});

describe("Game · 非法操作", () => {
  it("不是你的回合时返回 not_your_turn 错误", () => {
    const g = makeGame();
    g.startHand(42);
    const wrongIdx = (g.actionIndex + 1) % g.players.length;
    const r = g.applyAction(g.players[wrongIdx].id, { type: "fold" });
    expect(r.error).toBe("not_your_turn");
  });

  it("有跟注金额时不能 check", () => {
    const g = makeGame();
    g.startHand(42);
    const p = g.players[g.actionIndex];
    const r = g.applyAction(p.id, { type: "check" });
    expect(r.error).toBe("cannot_check");
  });

  it("加注低于最小加注被拒绝", () => {
    const g = makeGame();
    g.startHand(42);
    const p = g.players[g.actionIndex];
    const r = g.applyAction(p.id, { type: "raise", amount: g.bigBlind }); // 等于 BB，未达最小加注
    expect(r.error).toBe("below_min_raise");
  });
});

describe("Game · snapshot 序列化", () => {
  it("snapshot 不含 holeCards 明牌（只有计数）", () => {
    const g = makeGame();
    g.startHand(42);
    const snap = g.snapshot();
    for (const p of snap.players) {
      expect(p.holeCardCount).toBe(2);
      expect(p.holeCards).toBeUndefined();
    }
    expect(snap.stage).toBe(STAGE.PREFLOP);
    expect(snap.community).toEqual([]);
  });
});
