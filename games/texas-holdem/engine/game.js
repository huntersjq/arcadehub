// 德州扑克 - 游戏状态机
//
// 职责：
//   - 维护一局牌局的完整状态（玩家、位置、盲注、回合、下注）
//   - 产生每一步需要的事件（开始新手牌、发牌、询问行动、结算）
//   - 不处理 UI，也不处理 AI 决策：外层通过 applyAction(playerId, action) 推进

import { buildDeck, shuffle, randomSeed } from "./deck.js";
import { bestOfSeven, compareHands } from "./hand.js";
import { buildPots, splitPot } from "./pot.js";

export const STAGE = {
  IDLE: "idle",
  PREFLOP: "preflop",
  FLOP: "flop",
  TURN: "turn",
  RIVER: "river",
  SHOWDOWN: "showdown",
  HAND_OVER: "hand_over",
  GAME_OVER: "game_over",
};

export const STAGE_NAME_CN = {
  idle: "准备", preflop: "翻前", flop: "翻牌", turn: "转牌",
  river: "河牌", showdown: "摊牌", hand_over: "本手结束", game_over: "牌局结束",
};

// 锦标赛盲注表
const TOURNEY_BLINDS = [
  [25, 50], [50, 100], [75, 150], [100, 200],
  [150, 300], [200, 400], [300, 600], [500, 1000],
  [750, 1500], [1000, 2000], [1500, 3000], [2000, 4000],
];

export class Game {
  // config: { players: [{id, name, stack, isHuman, aiLevel?}], smallBlind, bigBlind,
  //           blindsMode: 'fixed'|'tourney', handsPerLevel, actionTimeoutMs }
  constructor(config) {
    this.config = {
      handsPerLevel: 6,
      blindsMode: "fixed",
      actionTimeoutMs: 15000, // 0 = 不限时（默认 15 秒）
      ...config,
    };
    this.players = this.config.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      stack: p.stack,
      isHuman: !!p.isHuman,
      aiLevel: p.aiLevel || null,
      seatIndex: i,
      // 动态字段
      holeCards: [],
      currentBet: 0,      // 本轮已下注
      totalBet: 0,        // 本手累计下注（用于边池）
      folded: false,
      allIn: false,
      acted: false,       // 本轮是否已行动
      sittingOut: false,  // 筹码为 0 时离桌
    }));

    this.dealerIndex = -1;
    this.handNumber = 0;
    this.level = 0;
    this.smallBlind = this.config.smallBlind || 50;
    this.bigBlind = this.config.bigBlind || 100;

    this.stage = STAGE.IDLE;
    this.deck = [];
    this.community = [];
    this.pots = [];
    this.pot = 0;         // 所有筹码合计（便于 UI 展示）
    this.currentBet = 0;  // 本轮需跟注的金额
    this.lastRaise = 0;   // 上一次加注的增量（用于最小加注限制）
    this.actionIndex = -1; // 当前行动玩家索引
    this.lastAggressor = -1;
    this.log = [];
    this.eventBus = [];   // 事件队列：{type, ...} 由外层消费
    this.seed = null;
  }

  // ── 工具 ──

  alivePlayers() { return this.players.filter((p) => !p.sittingOut); }
  inHandPlayers() { return this.players.filter((p) => !p.folded && !p.sittingOut); }
  canActPlayers() { return this.inHandPlayers().filter((p) => !p.allIn); }

  nextActiveIndex(from, predicate = (p) => !p.folded && !p.allIn && !p.sittingOut) {
    const n = this.players.length;
    for (let step = 1; step <= n; step++) {
      const idx = (from + step) % n;
      if (predicate(this.players[idx])) return idx;
    }
    return -1;
  }

  // ── 开始新一手牌 ──

  startHand(seed) {
    this.handNumber += 1;

    // 锦标赛升盲
    if (this.config.blindsMode === "tourney") {
      const lvl = Math.min(
        Math.floor((this.handNumber - 1) / this.config.handsPerLevel),
        TOURNEY_BLINDS.length - 1,
      );
      this.level = lvl;
      this.smallBlind = TOURNEY_BLINDS[lvl][0];
      this.bigBlind = TOURNEY_BLINDS[lvl][1];
    }

    // 标记筹码为 0 的玩家离桌
    for (const p of this.players) {
      if (p.stack <= 0) p.sittingOut = true;
    }

    const alive = this.alivePlayers();
    if (alive.length < 2) {
      this.stage = STAGE.GAME_OVER;
      this._push({ type: "game_over", winner: alive[0]?.id || null });
      return;
    }

    // 按钮位轮转
    this.dealerIndex = this.nextActiveIndex(this.dealerIndex, (p) => !p.sittingOut);

    // 重置玩家状态
    for (const p of this.players) {
      p.holeCards = [];
      p.currentBet = 0;
      p.totalBet = 0;
      p.folded = p.sittingOut; // 离桌玩家视为弃牌
      p.allIn = false;
      p.acted = false;
    }

    this.community = [];
    this.pots = [];
    this.pot = 0;
    this.currentBet = 0;
    this.lastRaise = this.bigBlind;
    this.lastAggressor = -1;

    this.seed = seed != null ? seed : randomSeed();
    this.deck = shuffle(buildDeck(), this.seed);

    this._push({ type: "hand_start", handNumber: this.handNumber, dealerIndex: this.dealerIndex, smallBlind: this.smallBlind, bigBlind: this.bigBlind });

    // 盲注
    const sbIndex = this.nextActiveIndex(this.dealerIndex, (p) => !p.sittingOut);
    const bbIndex = this.nextActiveIndex(sbIndex, (p) => !p.sittingOut);
    this._placeBlind(sbIndex, this.smallBlind, "sb");
    this._placeBlind(bbIndex, this.bigBlind, "bb");
    this.currentBet = this.bigBlind;
    this.lastAggressor = bbIndex;

    // 发底牌 - 每人两张（每轮一张，共两轮，遵循真实发牌习惯）
    for (let round = 0; round < 2; round++) {
      for (let i = 1; i <= this.players.length; i++) {
        const idx = (sbIndex + i - 1) % this.players.length;
        const p = this.players[idx];
        if (!p.sittingOut) p.holeCards.push(this.deck.pop());
      }
    }

    for (const p of this.players) {
      if (!p.sittingOut) {
        this._push({ type: "deal_hole", playerId: p.id, cards: p.holeCards.slice() });
      }
    }

    this.stage = STAGE.PREFLOP;
    this._push({ type: "stage", stage: this.stage });

    // 第一个行动：大盲下家
    this.actionIndex = this.nextActiveIndex(bbIndex);
    this._askAction();
  }

  _placeBlind(idx, amount, label) {
    const p = this.players[idx];
    const paid = Math.min(amount, p.stack);
    p.stack -= paid;
    p.currentBet += paid;
    p.totalBet += paid;
    this.pot += paid;
    if (p.stack === 0) p.allIn = true;
    this._push({ type: "blind", playerId: p.id, amount: paid, label });
  }

  _askAction() {
    if (this.actionIndex < 0) return;
    const p = this.players[this.actionIndex];
    const toCall = this.currentBet - p.currentBet;
    const minRaise = Math.max(this.currentBet + this.lastRaise, this.currentBet + this.bigBlind);
    const legalActions = this._legalActions(p);
    const timeoutMs = this.config.actionTimeoutMs > 0 ? this.config.actionTimeoutMs : 0;
    this._push({
      type: "action_required",
      playerId: p.id,
      toCall,
      minRaise,
      maxRaise: p.stack + p.currentBet,
      currentBet: this.currentBet,
      bigBlind: this.bigBlind,
      pot: this.pot,
      legalActions,
      timeoutMs,
      deadline: timeoutMs ? Date.now() + timeoutMs : 0,
    });
  }

  _legalActions(p) {
    const toCall = this.currentBet - p.currentBet;
    const actions = [];
    actions.push("fold");
    if (toCall === 0) actions.push("check");
    if (toCall > 0 && p.stack > 0) actions.push("call");
    if (p.stack > toCall) actions.push("raise");
    if (p.stack > 0) actions.push("allin");
    return actions;
  }

  // ── 行动处理 ──

  // action: { type: 'fold'|'check'|'call'|'raise'|'allin', amount?: number (raise 总下注到 X) }
  applyAction(playerId, action) {
    if (this.stage === STAGE.GAME_OVER) return;
    const p = this.players[this.actionIndex];
    if (!p || p.id !== playerId) {
      // 不是该玩家的回合，忽略
      return { error: "not_your_turn" };
    }

    const toCall = this.currentBet - p.currentBet;

    switch (action.type) {
      case "fold": {
        p.folded = true;
        p.acted = true;
        this._push({ type: "action", playerId: p.id, action: "fold" });
        break;
      }
      case "check": {
        if (toCall > 0) return { error: "cannot_check" };
        p.acted = true;
        this._push({ type: "action", playerId: p.id, action: "check" });
        break;
      }
      case "call": {
        const pay = Math.min(toCall, p.stack);
        p.stack -= pay;
        p.currentBet += pay;
        p.totalBet += pay;
        this.pot += pay;
        if (p.stack === 0) p.allIn = true;
        p.acted = true;
        this._push({ type: "action", playerId: p.id, action: "call", amount: pay });
        break;
      }
      case "allin": {
        const pay = p.stack;
        const newTotal = p.currentBet + pay;
        p.stack = 0;
        p.currentBet = newTotal;
        p.totalBet += pay;
        this.pot += pay;
        p.allIn = true;
        p.acted = true;
        // 如果全下金额超过当前下注，作为加注处理（重开本轮动作）
        if (newTotal > this.currentBet) {
          const raiseInc = newTotal - this.currentBet;
          // 如果全下的加注达到最小加注，则重置其他人 acted；否则仍视为有效加注但不改变 lastRaise
          if (raiseInc >= this.lastRaise) {
            this.lastRaise = raiseInc;
          }
          this.currentBet = newTotal;
          this.lastAggressor = this.actionIndex;
          for (const other of this.players) {
            if (other !== p && !other.folded && !other.allIn) other.acted = false;
          }
        }
        this._push({ type: "action", playerId: p.id, action: "allin", amount: pay, totalBet: newTotal });
        break;
      }
      case "raise": {
        const raiseTo = Math.floor(action.amount);
        const minRaise = this.currentBet + this.lastRaise;
        if (raiseTo < minRaise && raiseTo !== p.currentBet + p.stack) {
          return { error: "below_min_raise" };
        }
        const pay = raiseTo - p.currentBet;
        if (pay > p.stack) return { error: "insufficient_stack" };
        p.stack -= pay;
        p.currentBet = raiseTo;
        p.totalBet += pay;
        this.pot += pay;
        if (p.stack === 0) p.allIn = true;
        const raiseInc = raiseTo - this.currentBet;
        this.lastRaise = raiseInc;
        this.currentBet = raiseTo;
        this.lastAggressor = this.actionIndex;
        p.acted = true;
        for (const other of this.players) {
          if (other !== p && !other.folded && !other.allIn) other.acted = false;
        }
        this._push({ type: "action", playerId: p.id, action: "raise", amount: pay, totalBet: raiseTo });
        break;
      }
      default: return { error: "unknown_action" };
    }

    // 一个人未弃牌时直接结束
    if (this.inHandPlayers().length <= 1) {
      this._awardUncontested();
      return { ok: true };
    }

    // 判断本轮是否结束
    if (this._bettingRoundComplete()) {
      this._advanceStage();
    } else {
      this.actionIndex = this.nextActiveIndex(this.actionIndex);
      this._askAction();
    }
    return { ok: true };
  }

  _bettingRoundComplete() {
    const actable = this.canActPlayers();
    if (actable.length === 0) return true;
    return actable.every((p) => p.acted && p.currentBet === this.currentBet);
  }

  _advanceStage() {
    // 重置本轮下注状态
    for (const p of this.players) {
      p.currentBet = 0;
      p.acted = false;
    }
    this.currentBet = 0;
    this.lastRaise = this.bigBlind;

    if (this.stage === STAGE.PREFLOP) {
      this.stage = STAGE.FLOP;
      this._burnAndDeal(3);
    } else if (this.stage === STAGE.FLOP) {
      this.stage = STAGE.TURN;
      this._burnAndDeal(1);
    } else if (this.stage === STAGE.TURN) {
      this.stage = STAGE.RIVER;
      this._burnAndDeal(1);
    } else if (this.stage === STAGE.RIVER) {
      this.stage = STAGE.SHOWDOWN;
      this._showdown();
      return;
    }

    this._push({ type: "stage", stage: this.stage, community: this.community.slice() });

    // 若剩下可行动的只有 0 或 1 人（其他都 all-in 或弃牌），跳过询问，连续发牌到摊牌
    if (this.canActPlayers().length <= 1 && this.inHandPlayers().length > 1) {
      // 直接推进到下一阶段
      this._advanceStage();
      return;
    }

    // 翻牌后从按钮位下家开始
    this.actionIndex = this.nextActiveIndex(this.dealerIndex);
    this._askAction();
  }

  _burnAndDeal(n) {
    this.deck.pop(); // burn
    for (let i = 0; i < n; i++) this.community.push(this.deck.pop());
  }

  _awardUncontested() {
    const winner = this.inHandPlayers()[0];
    winner.stack += this.pot;
    this._push({ type: "award", winners: [{ id: winner.id, amount: this.pot, reason: "uncontested" }] });
    this.pot = 0;
    this.stage = STAGE.HAND_OVER;
    this._push({ type: "hand_over" });
  }

  _showdown() {
    // 补足未发完的公共牌
    while (this.community.length < 5) this.deck.pop(), this.community.push(this.deck.pop());

    // 各玩家最佳 5 张
    const evaluations = new Map();
    for (const p of this.inHandPlayers()) {
      const hand = bestOfSeven([...p.holeCards, ...this.community]);
      evaluations.set(p.id, hand);
    }

    // 构建底池 & 边池，分配给资格赢家
    const pots = buildPots(this.players);
    const awards = [];
    for (const pot of pots) {
      const eligibleIds = [...pot.eligible];
      if (eligibleIds.length === 0) continue;
      let bestIds = [eligibleIds[0]];
      for (let i = 1; i < eligibleIds.length; i++) {
        const cmp = compareHands(evaluations.get(eligibleIds[i]), evaluations.get(bestIds[0]));
        if (cmp > 0) bestIds = [eligibleIds[i]];
        else if (cmp === 0) bestIds.push(eligibleIds[i]);
      }
      const splits = splitPot(pot, bestIds);
      for (const s of splits) {
        const p = this.players.find((x) => x.id === s.id);
        p.stack += s.amount;
        const hand = evaluations.get(s.id);
        awards.push({ id: s.id, amount: s.amount, rank: hand.name, cards: hand.cards });
      }
    }

    this._push({
      type: "showdown",
      community: this.community.slice(),
      hands: [...evaluations.entries()].map(([id, h]) => ({ id, name: h.name, cards: h.cards, holeCards: this.players.find((p) => p.id === id).holeCards.slice() })),
    });
    this._push({ type: "award", winners: awards });
    this.pot = 0;
    this.stage = STAGE.HAND_OVER;
    this._push({ type: "hand_over" });
  }

  // ── 序列化（供联机同步） ──

  snapshot() {
    return {
      players: this.players.map((p) => ({
        id: p.id, name: p.name, stack: p.stack, isHuman: p.isHuman,
        seatIndex: p.seatIndex, currentBet: p.currentBet, totalBet: p.totalBet,
        folded: p.folded, allIn: p.allIn, acted: p.acted, sittingOut: p.sittingOut,
        holeCardCount: p.holeCards.length,
      })),
      community: this.community.slice(),
      stage: this.stage,
      pot: this.pot,
      currentBet: this.currentBet,
      lastRaise: this.lastRaise,
      dealerIndex: this.dealerIndex,
      actionIndex: this.actionIndex,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      handNumber: this.handNumber,
    };
  }

  // ── 事件 ──

  _push(ev) { this.eventBus.push(ev); }

  drainEvents() {
    const events = this.eventBus;
    this.eventBus = [];
    return events;
  }
}
