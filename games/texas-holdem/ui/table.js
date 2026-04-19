// 牌桌渲染

import { SUIT_SYMBOL } from "../engine/deck.js";
import { STAGE_NAME_CN } from "../engine/game.js";
import { isSquintEnabled } from "./squint.js";

function capsuleText(b) {
  switch (b.action) {
    case "fold": return "弃牌";
    case "check": return "过牌";
    case "call": return `跟注 ${(b.amount || 0).toLocaleString()}`;
    case "raise": return `加注 ${(b.totalBet || b.amount || 0).toLocaleString()}`;
    case "allin": return "全下";
    default: return b.action;
  }
}

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
  // 4-色花色专属 class（CSS 决定每个花色的颜色）
  el.classList.add("suit-" + suit);
  // legacy 兼容：旧 .red 类对应 ♥/♦
  if (suit === "h" || suit === "d") el.classList.add("red");
  const rankLabel = rank === "T" ? "10" : rank;
  const isFace = rank === "J" || rank === "Q" || rank === "K" || rank === "A";
  if (isFace) el.classList.add("face", "face-" + rank.toLowerCase());

  // 左上角：点数 + 小花色（stacked）
  const corner = document.createElement("div");
  corner.className = "card-corner";
  const cornerRank = document.createElement("div");
  cornerRank.className = "corner-rank";
  cornerRank.textContent = rankLabel;
  const cornerSuit = document.createElement("div");
  cornerSuit.className = "corner-suit";
  cornerSuit.textContent = SUIT_SYMBOL[suit];
  corner.appendChild(cornerRank);
  corner.appendChild(cornerSuit);
  el.appendChild(corner);

  // 主体：所有牌都显示大花色符号（参考 WePoker / PokerStars）
  // 脸牌靠 .face class 的金边 + 角标的 J/Q/K/A 字母自然区分
  const main = document.createElement("div");
  main.className = "card-main";
  const mainSuit = document.createElement("div");
  mainSuit.className = "main-suit";
  mainSuit.textContent = SUIT_SYMBOL[suit];
  main.appendChild(mainSuit);
  el.appendChild(main);

  if (opts.deal) el.classList.add("deal-in");
  if (opts.flip) el.classList.add("flip");
  if (opts.highlight) el.classList.add("highlight");

  // 眯牌模式：渲染正面但盖一层"背面"遮罩，长按掀起来
  if (opts.squintCover) {
    el.classList.add("squintable");
    const cover = document.createElement("div");
    cover.className = "card-back-cover";
    el.appendChild(cover);
    attachSquint(el);
  }

  return el;
}

// 长按 → 掀起牌背遮罩（鸽子般地眯一眼）
// 使用 pointer events 同时支持鼠标 + 触屏
function attachSquint(cardEl) {
  let pressTimer = null;
  let startX = 0, startY = 0;
  const LONG_PRESS_MS = 140;
  const MOVE_TOLERANCE = 10;

  const cancel = () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    cardEl.classList.remove("squint-active");
  };

  cardEl.addEventListener("pointerdown", (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return; // 仅左键 / 主指
    startX = ev.clientX; startY = ev.clientY;
    pressTimer = setTimeout(() => {
      cardEl.classList.add("squint-active");
      pressTimer = null;
    }, LONG_PRESS_MS);
  });
  cardEl.addEventListener("pointermove", (ev) => {
    if (!pressTimer && !cardEl.classList.contains("squint-active")) return;
    const dx = Math.abs(ev.clientX - startX);
    const dy = Math.abs(ev.clientY - startY);
    if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) cancel();
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((evName) => {
    cardEl.addEventListener(evName, cancel);
  });
  // 防止移动端长按弹出系统菜单
  cardEl.addEventListener("contextmenu", (ev) => ev.preventDefault());
}

// 倒计时圆环：r=22 → 周长 ≈ 138.23（≈ 2π × 22）
const COUNTDOWN_R = 22;
const COUNTDOWN_C = 2 * Math.PI * COUNTDOWN_R;

export class TableView {
  constructor(root) {
    this.root = root;
    this.seatsEl = root.querySelector("#seats");
    this.communityEl = root.querySelector("#communityCards");
    this.potEl = root.querySelector("#potAmount");
    this.stageEl = root.querySelector("#stageInfo");
    this.dealerLogEl = root.querySelector("#dealerLog");
    this.seatElements = new Map(); // playerId → DOM
    this._countdown = null;        // { playerId, deadlineMs, totalMs }
    this._countdownRAF = null;
  }

  // 由 main.js 在收到 action_required / action 事件时调用
  setActionDeadline(playerId, deadlineMs, totalMs) {
    if (!playerId || !deadlineMs || !totalMs) {
      this._countdown = null;
      this._stopCountdownTick();
      this._updateCountdownVisual(); // 立即清掉 UI
      return;
    }
    this._countdown = { playerId, deadlineMs, totalMs };
    this._startCountdownTick();
  }

  _startCountdownTick() {
    if (this._countdownRAF != null) return;
    const tick = () => {
      this._countdownRAF = null;
      if (!this._countdown) return;
      this._updateCountdownVisual();
      this._countdownRAF = requestAnimationFrame(tick);
    };
    this._countdownRAF = requestAnimationFrame(tick);
  }

  _stopCountdownTick() {
    if (this._countdownRAF != null) {
      cancelAnimationFrame(this._countdownRAF);
      this._countdownRAF = null;
    }
  }

  _updateCountdownVisual() {
    // 清掉所有座位上的 ring，再给当前需行动的座位画一个
    for (const seatEl of this.seatElements.values()) {
      const old = seatEl.querySelector(".countdown-ring");
      if (old) old.remove();
    }
    const d = this._countdown;
    if (!d) return;
    const seatEl = this.seatElements.get(d.playerId);
    if (!seatEl) return;
    const remaining = Math.max(0, d.deadlineMs - Date.now());
    const ratio = d.totalMs > 0 ? remaining / d.totalMs : 0;

    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "countdown-ring");
    svg.setAttribute("viewBox", "0 0 50 50");
    svg.setAttribute("aria-hidden", "true");

    // 背景圈（淡）
    const bg = document.createElementNS(NS, "circle");
    bg.setAttribute("class", "countdown-bg");
    bg.setAttribute("cx", "25"); bg.setAttribute("cy", "25");
    bg.setAttribute("r", String(COUNTDOWN_R));
    bg.setAttribute("fill", "none");
    svg.appendChild(bg);

    // 进度条（顺时针递减）
    const bar = document.createElementNS(NS, "circle");
    bar.setAttribute("class", "countdown-bar");
    bar.setAttribute("cx", "25"); bar.setAttribute("cy", "25");
    bar.setAttribute("r", String(COUNTDOWN_R));
    bar.setAttribute("fill", "none");
    bar.setAttribute("stroke-dasharray", String(COUNTDOWN_C));
    bar.setAttribute("stroke-dashoffset", String(COUNTDOWN_C * (1 - ratio)));
    bar.setAttribute("transform", "rotate(-90 25 25)"); // 12 点开始
    bar.setAttribute("stroke-linecap", "round");

    // 颜色按时间档位
    let color = "var(--countdown-green, #34d399)";
    if (ratio < 0.4) color = "var(--countdown-yellow, #fbbf24)";
    if (ratio < 0.15) color = "var(--countdown-red, #f87171)";
    bar.setAttribute("stroke", color);

    svg.appendChild(bar);
    seatEl.appendChild(svg);

    // 时间到 → 自然停止 rAF
    if (remaining <= 0) this._stopCountdownTick();
  }

  render(state, perspective) {
    // perspective: 本地玩家 id（视角）
    // 新一手开局时重置公共牌缓存并清空 DOM，避免上手的牌残留
    if (this._lastHandNumber !== state.handNumber) {
      this._communityCache = [];
      this._lastHandNumber = state.handNumber;
      this.communityEl.replaceChildren();
      for (let i = 0; i < 5; i++) {
        const ph = document.createElement("div");
        ph.className = "card back";
        ph.style.opacity = "0.15";
        this.communityEl.appendChild(ph);
      }
    }
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
          // 自己的底牌：眯牌模式下盖一层背面遮罩，长按掀起
          const squint = isSquintEnabled();
          state.ownHoleCards.forEach((c) =>
            cards.appendChild(renderCardEl(c, { squintCover: squint })),
          );
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

      // 行动胶囊（跟注 / 加注 / 弃牌 / 过牌 / 全下）
      const bubble = state.actionBubbles?.[p.id];
      if (bubble) {
        const cap = document.createElement("div");
        cap.className = "seat-capsule cap-" + bubble.action;
        cap.textContent = capsuleText(bubble);
        seat.appendChild(cap);
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

    // 重渲染后立刻把倒计时圆环画上（如果当前有活跃 deadline）
    this._updateCountdownVisual();

    // 公共牌（diff 渲染，避免每次下注都重建导致闪烁）
    if (!this._communityCache) this._communityCache = [];
    const needRebuild =
      state.community.length !== this._communityCache.length ||
      state.community.some((c, i) => c !== this._communityCache[i]);

    if (needRebuild) {
      const oldLen = this._communityCache.length;
      this.communityEl.replaceChildren();
      for (let i = 0; i < state.community.length; i++) {
        // 只给「本次新增」的牌添加 deal-in 动画（带 stagger）
        const isNew = i >= oldLen;
        const el = renderCardEl(state.community[i], { deal: isNew });
        if (isNew) {
          const delay = (i - oldLen) * 140;
          el.style.animationDelay = delay + "ms";
          el.style.opacity = "0";
          // 动画开始前保持不可见，之后由 deal-in 动画接管
          el.style.animationFillMode = "forwards";
        }
        this.communityEl.appendChild(el);
      }
      for (let i = state.community.length; i < 5; i++) {
        const placeholder = document.createElement("div");
        placeholder.className = "card back";
        placeholder.style.opacity = "0.15";
        this.communityEl.appendChild(placeholder);
      }
      this._communityCache = state.community.slice();
    }

    // 底池（动画计数）
    this._animatePotTo(state.pot);
    // 阶段
    this.stageEl.textContent = STAGE_NAME_CN[state.stage] || state.stage;
  }

  _animatePotTo(value) {
    const el = this.potEl;
    const from = parseInt(String(el.textContent).replace(/,/g, ""), 10) || 0;
    if (from === value) {
      el.textContent = value.toLocaleString();
      return;
    }
    cancelAnimationFrame(this._potRaf);
    const start = performance.now();
    const dur = 450;
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = Math.round(from + (value - from) * eased);
      el.textContent = cur.toLocaleString();
      el.classList.toggle("pot-growing", value > from);
      if (p < 1) this._potRaf = requestAnimationFrame(step);
      else {
        setTimeout(() => el.classList.remove("pot-growing"), 200);
      }
    };
    this._potRaf = requestAnimationFrame(step);
  }

  showStageBanner(stageCN) {
    if (this._stageBannerEl) this._stageBannerEl.remove();
    const banner = document.createElement("div");
    banner.className = "stage-banner";
    banner.textContent = stageCN;
    document.body.appendChild(banner);
    this._stageBannerEl = banner;
    // 触发动画
    requestAnimationFrame(() => banner.classList.add("show"));
    setTimeout(() => {
      banner.classList.remove("show");
      banner.classList.add("hide");
      setTimeout(() => {
        banner.remove();
        if (this._stageBannerEl === banner) this._stageBannerEl = null;
      }, 450);
    }, 1200);
  }

  floatActionLabel(playerId, text, kind) {
    const seat = this.seatElements.get(playerId);
    if (!seat) return;
    const rect = seat.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "action-float " + (kind ? "kind-" + kind : "");
    el.textContent = text;
    el.style.left = rect.left + rect.width / 2 + "px";
    el.style.top = rect.top + 16 + "px";
    document.getElementById("floatingLayer").appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  burstConfetti(playerId) {
    const seat = this.seatElements.get(playerId);
    if (!seat) return;
    const rect = seat.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const layer = document.getElementById("floatingLayer");
    const colors = ["#f5c518", "#fff5a0", "#ef4444", "#22c55e", "#60a5fa", "#ec4899"];
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("span");
      p.className = "confetti";
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 160;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 50;
      p.style.left = cx + "px";
      p.style.top = cy + "px";
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--dx", dx + "px");
      p.style.setProperty("--dy", dy + "px");
      p.style.setProperty("--rot", Math.random() * 720 + "deg");
      layer.appendChild(p);
      setTimeout(() => p.remove(), 1300);
    }
  }

  flyChipsToPot(playerId, amount) {
    const seat = this.seatElements.get(playerId);
    if (!seat) return;
    const seatRect = seat.getBoundingClientRect();
    const potRect = this.potEl.getBoundingClientRect();
    const layer = document.getElementById("floatingLayer");
    const startX = seatRect.left + seatRect.width / 2;
    const startY = seatRect.top + seatRect.height / 2;
    const endX = potRect.left + potRect.width / 2;
    const endY = potRect.top + potRect.height / 2;

    // 根据金额生成 1-4 个筹码
    const n = Math.min(4, Math.max(1, Math.floor(Math.log10(Math.max(1, amount)))));
    for (let i = 0; i < n; i++) {
      const chip = document.createElement("div");
      chip.className = "flying-chip";
      chip.style.left = startX + "px";
      chip.style.top = startY + "px";
      chip.style.setProperty("--dx", endX - startX + "px");
      chip.style.setProperty("--dy", endY - startY + "px");
      chip.style.animationDelay = i * 80 + "ms";
      layer.appendChild(chip);
      setTimeout(() => chip.remove(), 800 + i * 80);
    }
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

  // 清空公共牌（结算后重置牌桌）
  clearBoard() {
    this._communityCache = [];
    this.communityEl.replaceChildren();
    for (let i = 0; i < 5; i++) {
      const placeholder = document.createElement("div");
      placeholder.className = "card back";
      placeholder.style.opacity = "0.15";
      this.communityEl.appendChild(placeholder);
    }
    this._animatePotTo(0);
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
