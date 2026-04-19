// 牌局历史记录 —— localStorage 存取 + 弹窗渲染（带「历史 / 统计」切换）

import { renderCardEl } from "./table.js";
import { renderStatsPanel } from "./stats.js";

const STORAGE_KEY = "holdem_history";
const MAX_ENTRIES = 50;

export class HandHistory {
  constructor(root) {
    this.root = root;
    this.modal = root.querySelector("#historyModal");
    this.listEl = root.querySelector("#historyList");
    this.statsEl = root.querySelector("#historyStats");
    this.tabBtns = root.querySelectorAll(".history-tab");
    this.toggleBtn = root.querySelector("#historyToggle");
    this.closeBtn = root.querySelector("#historyClose");
    this.clearBtn = root.querySelector("#historyClear");
    this._openEntryIds = new Set();
    this._activeTab = "list";

    this.tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => this._setTab(btn.dataset.tab));
    });

    this.toggleBtn?.addEventListener("click", () => this.open());
    this.closeBtn?.addEventListener("click", () => this.close());
    this.clearBtn?.addEventListener("click", () => {
      if (!confirm("确认清空所有历史记录？")) return;
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      this.render();
    });
    this.modal?.addEventListener("click", (e) => {
      if (e.target === this.modal) this.close();
    });
  }

  record(entry) {
    const list = this._load();
    list.unshift({
      id: entry.id || Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      time: entry.time || Date.now(),
      handNumber: entry.handNumber,
      community: entry.community || [],
      players: entry.players || [],
      winners: entry.winners || [],
      reason: entry.reason || null,
    });
    const trimmed = list.slice(0, MAX_ENTRIES);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch (_) {}
  }

  open() {
    if (!this.modal) return;
    this.render();
    this.modal.style.display = "flex";
  }

  _setTab(tab) {
    this._activeTab = tab;
    this.tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    this.render();
  }

  close() {
    if (!this.modal) return;
    this.modal.style.display = "none";
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  render() {
    if (!this.listEl) return;
    const isList = this._activeTab !== "stats";
    this.listEl.style.display = isList ? "" : "none";
    if (this.statsEl) this.statsEl.style.display = isList ? "none" : "";
    if (this.clearBtn) this.clearBtn.style.display = isList ? "" : "none";

    if (isList) {
      const list = this._load();
      this.listEl.replaceChildren();
      if (list.length === 0) {
        const empty = document.createElement("div");
        empty.className = "history-empty";
        empty.textContent = "暂无历史记录";
        this.listEl.appendChild(empty);
        return;
      }
      for (const entry of list) this.listEl.appendChild(this._renderEntry(entry));
    } else if (this.statsEl) {
      renderStatsPanel(this.statsEl);
    }
  }

  _renderEntry(entry) {
    const el = document.createElement("div");
    el.className = "history-entry";

    const head = document.createElement("div");
    head.className = "history-entry-head";

    const handLabel = document.createElement("span");
    handLabel.className = "history-entry-hand";
    handLabel.textContent = `第 ${entry.handNumber} 手`;
    head.appendChild(handLabel);

    const timeLabel = document.createElement("span");
    timeLabel.textContent = formatTime(entry.time);
    head.appendChild(timeLabel);

    const winnerNames = entry.winners.map((w) => {
      const p = entry.players.find((x) => x.id === w.id);
      return (p?.name || w.id) + (w.amount ? ` +${w.amount.toLocaleString()}` : "");
    }).join("、");
    const winnerLabel = document.createElement("span");
    winnerLabel.className = "history-entry-winner";
    winnerLabel.textContent = winnerNames ? "🏆 " + winnerNames : "";
    head.appendChild(winnerLabel);

    el.appendChild(head);

    if (entry.community && entry.community.length > 0) {
      const board = document.createElement("div");
      board.className = "history-entry-board";
      for (const c of entry.community) board.appendChild(renderCardEl(c));
      el.appendChild(board);
    }

    const delta = document.createElement("div");
    delta.className = "history-entry-delta";
    for (const p of entry.players) {
      const d = p.delta || 0;
      const span = document.createElement("span");
      span.className = d > 0 ? "gain" : d < 0 ? "loss" : "";
      span.textContent = `${p.name} ${d > 0 ? "+" : ""}${d.toLocaleString()}`;
      delta.appendChild(span);
    }
    el.appendChild(delta);

    // 点击展开详细手牌
    const isOpen = this._openEntryIds.has(entry.id);
    if (isOpen) {
      el.appendChild(this._renderDetail(entry));
    }
    el.addEventListener("click", () => {
      if (this._openEntryIds.has(entry.id)) this._openEntryIds.delete(entry.id);
      else this._openEntryIds.add(entry.id);
      this.render();
    });

    return el;
  }

  _renderDetail(entry) {
    const detail = document.createElement("div");
    detail.className = "history-entry-detail";
    detail.addEventListener("click", (e) => e.stopPropagation());

    // 顶部公共牌条（与结算 modal 一致）
    if (entry.community && entry.community.length > 0) {
      const board = document.createElement("div");
      board.className = "history-detail-board";
      const label = document.createElement("span");
      label.className = "history-detail-board-label";
      label.textContent = "公共牌";
      board.appendChild(label);
      const cards = document.createElement("div");
      cards.className = "history-detail-board-cards";
      for (const c of entry.community) cards.appendChild(renderCardEl(c));
      board.appendChild(cards);
      detail.appendChild(board);
    }

    // 排序：赢家优先，弃牌靠后；自己永远在赢家之前展示（如果不是赢家自己也置顶）
    const sorted = entry.players.slice().sort((a, b) => {
      const aWin = a.isWinner ? 1 : 0;
      const bWin = b.isWinner ? 1 : 0;
      if (aWin !== bWin) return bWin - aWin;
      const aSelf = a.isSelf ? 1 : 0;
      const bSelf = b.isSelf ? 1 : 0;
      if (aSelf !== bSelf) return bSelf - aSelf;
      const aFold = a.folded ? 1 : 0;
      const bFold = b.folded ? 1 : 0;
      return aFold - bFold;
    });

    for (const p of sorted) {
      const row = document.createElement("div");
      row.className = "history-detail-row"
        + (p.isWinner ? " winner" : "")
        + (p.isSelf ? " self" : "")
        + (p.folded ? " folded" : "");

      // 信息列
      const info = document.createElement("div");
      info.className = "history-detail-info";
      const name = document.createElement("div");
      name.className = "history-detail-name";
      name.textContent = p.name;
      info.appendChild(name);
      const rank = document.createElement("div");
      rank.className = "history-detail-rank";
      rank.textContent = p.folded ? "弃牌" : (p.rank || "—");
      info.appendChild(rank);
      const d = p.delta || 0;
      const deltaSpan = document.createElement("div");
      deltaSpan.className = "history-detail-delta " + (d > 0 ? "gain" : d < 0 ? "loss" : "flat");
      deltaSpan.textContent = d > 0 ? `+${d.toLocaleString()}`
        : d < 0 ? d.toLocaleString()
        : "±0";
      info.appendChild(deltaSpan);
      row.appendChild(info);

      // 卡牌列：底牌 → 最佳 5 张
      const cardsWrap = document.createElement("div");
      cardsWrap.className = "history-detail-cards";

      const holeGroup = document.createElement("div");
      holeGroup.className = "history-detail-holes";
      if (p.holeCards && p.holeCards.length > 0) {
        for (const c of p.holeCards) holeGroup.appendChild(renderCardEl(c));
      }
      cardsWrap.appendChild(holeGroup);

      // 摊牌且非弃牌：箭头 + best5（best5 中含 hole 的卡用金边）
      if (!p.folded && p.bestCards && p.bestCards.length > 0) {
        const sep = document.createElement("span");
        sep.className = "history-detail-sep";
        sep.textContent = "→";
        cardsWrap.appendChild(sep);

        const bestGroup = document.createElement("div");
        bestGroup.className = "history-detail-best";
        const bestSet = new Set(p.bestCards);
        // 优先用 best5 中的卡 + 高亮
        for (const c of p.bestCards) {
          const el = renderCardEl(c);
          el.classList.add("highlight");
          bestGroup.appendChild(el);
        }
        cardsWrap.appendChild(bestGroup);
      }

      row.appendChild(cardsWrap);
      detail.appendChild(row);
    }
    return detail;
  }
}

function formatTime(t) {
  try {
    const d = new Date(t);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (_) {
    return "";
  }
}
