// 牌桌渲染

import { SUIT_SYMBOL } from "../engine/deck.js";
import { STAGE_NAME_CN } from "../engine/game.js";

// 座位在椭圆上的角度（以百分比形式）
function seatPositions(count) {
  // 本地玩家放在底部，其他按顺时针环绕
  const positions = [];
  // 椭圆参数（基于 table-oval 容器百分比）
  const cx = 50, cy = 50;
  const rx = 44, ry = 42;
  // 起始角度：底部（90°）为本地玩家
  const startAngle = 90;
  for (let i = 0; i < count; i++) {
    const angle = (startAngle + (360 / count) * i) % 360;
    const rad = (angle * Math.PI) / 180;
    const x = cx + rx * Math.cos(rad);
    const y = cy + ry * Math.sin(rad);
    positions.push({ x, y, angle });
  }
  return positions;
}

export function renderCardEl(code, opts = {}) {
  const el = document.createElement("div");
  el.className = "card";
  if (opts.back || !code) {
    el.classList.add("back");
    return el;
  }
  const rank = code[0];
  const suit = code[1];
  if (suit === "h" || suit === "d") el.classList.add("red");
  const rankLabel = rank === "T" ? "10" : rank;
  el.innerHTML = `<div class="rank">${rankLabel}</div><div class="suit">${SUIT_SYMBOL[suit]}</div>`;
  if (opts.deal) el.classList.add("deal-in");
  if (opts.flip) el.classList.add("flip");
  if (opts.highlight) el.classList.add("highlight");
  return el;
}

export class TableView {
  constructor(root) {
    this.root = root;
    this.seatsEl = root.querySelector("#seats");
    this.communityEl = root.querySelector("#communityCards");
    this.potEl = root.querySelector("#potAmount");
    this.stageEl = root.querySelector("#stageInfo");
    this.dealerLogEl = root.querySelector("#dealerLog");
    this.seatElements = new Map(); // playerId → DOM
  }

  render(state, perspective) {
    // perspective: 本地玩家 id（视角）
    const players = state.players;
    const positions = this._layoutPositions(players, perspective);

    // 清空并重建（简单实现；性能足够）
    this.seatsEl.innerHTML = "";
    this.seatElements.clear();

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const pos = positions[i];
      const seat = document.createElement("div");
      seat.className = "seat";
      seat.style.left = `${pos.x}%`;
      seat.style.top = `${pos.y}%`;
      seat.dataset.id = p.id;

      if (p.folded) seat.classList.add("folded");
      if (p.id === perspective) seat.classList.add("self");
      if (state.actionIndex >= 0 && players[state.actionIndex]?.id === p.id && state.stage !== "showdown" && state.stage !== "hand_over") {
        seat.classList.add("active");
      }

      // 按钮标记
      const tags = document.createElement("div");
      tags.className = "seat-tag";
      if (i === state.dealerIndex) {
        const b = document.createElement("span"); b.className = "badge-dealer"; b.textContent = "D"; tags.appendChild(b);
      }
      // 小盲 / 大盲徽标
      if (state.handNumber > 0) {
        const sbIdx = this._nextNonSittingOut(players, state.dealerIndex);
        const bbIdx = this._nextNonSittingOut(players, sbIdx);
        if (i === sbIdx) { const b = document.createElement("span"); b.className = "badge-sb"; b.textContent = "SB"; tags.appendChild(b); }
        if (i === bbIdx) { const b = document.createElement("span"); b.className = "badge-bb"; b.textContent = "BB"; tags.appendChild(b); }
      }
      seat.appendChild(tags);

      // 头像
      const avatar = document.createElement("div");
      avatar.className = "seat-avatar";
      avatar.textContent = p.name.charAt(0);
      avatar.style.background = this._avatarColor(p.id);
      seat.appendChild(avatar);

      // 名字
      const name = document.createElement("div");
      name.className = "seat-name";
      name.textContent = p.name + (p.isHuman ? "" : " 🤖");
      seat.appendChild(name);

      // 筹码
      const stack = document.createElement("div");
      stack.className = "seat-stack";
      stack.textContent = p.stack.toLocaleString();
      seat.appendChild(stack);

      // 底牌
      const cards = document.createElement("div");
      cards.className = "seat-cards";
      if (!p.sittingOut && p.holeCardCount > 0) {
        const showHole = state.revealedHoles?.[p.id];
        if (showHole) {
          showHole.forEach((c) => cards.appendChild(renderCardEl(c)));
        } else if (p.id === perspective && state.ownHoleCards) {
          state.ownHoleCards.forEach((c) => cards.appendChild(renderCardEl(c)));
        } else {
          for (let k = 0; k < p.holeCardCount; k++) cards.appendChild(renderCardEl(null, { back: true }));
        }
      }
      seat.appendChild(cards);

      // 本轮下注筹码
      if (p.currentBet > 0) {
        const bet = document.createElement("div");
        bet.className = "seat-bet show";
        bet.textContent = `${p.currentBet.toLocaleString()}`;
        seat.appendChild(bet);
      }

      // 状态提示
      if (p.folded && !p.sittingOut) {
        const hint = document.createElement("div");
        hint.className = "seat-action-hint show";
        hint.textContent = "弃牌";
        seat.appendChild(hint);
      } else if (p.allIn) {
        const hint = document.createElement("div");
        hint.className = "seat-action-hint show";
        hint.textContent = "全下";
        seat.appendChild(hint);
      } else if (p.sittingOut) {
        const hint = document.createElement("div");
        hint.className = "seat-action-hint show";
        hint.textContent = "离桌";
        seat.appendChild(hint);
      }

      this.seatsEl.appendChild(seat);
      this.seatElements.set(p.id, seat);
    }

    // 公共牌
    this.communityEl.innerHTML = "";
    for (const c of state.community) {
      this.communityEl.appendChild(renderCardEl(c, { deal: true }));
    }
    // 占位符
    for (let i = state.community.length; i < 5; i++) {
      const placeholder = document.createElement("div");
      placeholder.className = "card back";
      placeholder.style.opacity = "0.15";
      this.communityEl.appendChild(placeholder);
    }

    // 底池
    this.potEl.textContent = state.pot.toLocaleString();
    // 阶段
    this.stageEl.textContent = STAGE_NAME_CN[state.stage] || state.stage;
  }

  _nextNonSittingOut(players, from) {
    const n = players.length;
    for (let step = 1; step <= n; step++) {
      const idx = (from + step) % n;
      if (!players[idx].sittingOut) return idx;
    }
    return -1;
  }

  _layoutPositions(players, perspective) {
    const count = players.length;
    const positions = seatPositions(count);
    // 将本地玩家放在索引 0（即 90°，底部）
    const selfIndex = players.findIndex((p) => p.id === perspective);
    if (selfIndex < 0) return positions;
    const rotated = new Array(count);
    for (let i = 0; i < count; i++) {
      rotated[(i - selfIndex + count) % count] = positions[i];
    }
    // 但 positions[0] 应当映射到本地玩家；重排方式：
    // 我们希望 player[selfIndex] 放到 positions[0]
    // 即 player[i] 放到 positions[(i - selfIndex + count) % count]
    const result = new Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = positions[(i - selfIndex + count) % count];
    }
    return result;
  }

  _avatarColor(id) {
    // 根据 id 哈希生成颜色
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    return `linear-gradient(135deg, hsl(${hue}, 60%, 35%), hsl(${(hue + 40) % 360}, 55%, 22%))`;
  }

  showDealerLog(text, durationMs = 2500) {
    this.dealerLogEl.textContent = text;
    this.dealerLogEl.classList.add("show");
    clearTimeout(this._logTimer);
    this._logTimer = setTimeout(() => this.dealerLogEl.classList.remove("show"), durationMs);
  }

  highlightWinners(ids) {
    for (const id of ids) {
      const seat = this.seatElements.get(id);
      if (seat) seat.classList.add("winner");
    }
  }

  floatEmojiOver(playerId, emoji) {
    const seat = this.seatElements.get(playerId);
    if (!seat) return;
    const rect = seat.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "float-emo";
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top + 6}px`;
    el.textContent = emoji;
    document.getElementById("floatingLayer").appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }
}
