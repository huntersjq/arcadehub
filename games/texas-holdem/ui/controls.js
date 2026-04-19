// 操作条（玩家行动按钮 + 加注滑块 + 实时胜率 + 牌型提示）

import { renderCardEl } from "./table.js";
import { bestOfSeven } from "../engine/hand.js";
import { preflopStrength } from "../ai/equity-core.js";
import { requestEquity } from "../ai/equity-client.js";
import { isSquintEnabled } from "./squint.js";

const EQUITY_ITERATIONS = {
  preflop: 0,   // 翻前用快路径
  flop: 180,
  turn: 240,
  river: 300,
};

export class Controls {
  constructor(root, onAction) {
    this.root = root;
    this.onAction = onAction;
    this.bar = root.querySelector("#actionBar");
    this.holeEl = root.querySelector("#holeCardsMini");
    this.callAmountEl = root.querySelector("#callAmount");
    this.raiseAmountEl = root.querySelector("#raiseAmount");
    this.slider = root.querySelector("#raiseSlider");
    this.sliderWrap = root.querySelector("#raiseSliderWrap");
    this.presetWrap = root.querySelector("#raisePresetsCircle");
    this.presetBtns = root.querySelectorAll(".chip-preset");
    this.actionButtons = root.querySelectorAll(".circle-btn");
    this.handHintEl = root.querySelector("#handHint");
    this.equityMeterEl = root.querySelector("#equityMeter");
    this.equityFillEl = root.querySelector("#equityFill");
    this.equityValueEl = root.querySelector("#equityValue");

    this.context = null;
    this._equityToken = 0;

    this.actionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!this.context) return;
        if (btn.disabled) return;
        const act = btn.dataset.act;
        if (act === "raise") {
          this.onAction({ type: "raise", amount: parseInt(this.slider.value, 10) });
        } else if (act === "allin") {
          this.onAction({ type: "allin" });
        } else {
          this.onAction({ type: act });
        }
      });
    });

    this.slider.addEventListener("input", () => this._updateRaiseDisplay());
    this.presetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!this.context) return;
        const preset = btn.dataset.preset;
        const { minRaise, maxRaise, pot, playerCurrentBet } = this.context;
        let v = minRaise;
        if (preset === "min") v = minRaise;
        else if (preset === "pot-third") v = Math.floor(playerCurrentBet + pot / 3);
        else if (preset === "pot-half") v = Math.floor(playerCurrentBet + pot / 2);
        else if (preset === "pot-two-third") v = Math.floor(playerCurrentBet + (pot * 2) / 3);
        else if (preset === "pot") v = Math.floor(playerCurrentBet + pot);
        else if (preset === "pot-onepointtwo") v = Math.floor(playerCurrentBet + pot * 1.2);
        else if (preset === "max") v = maxRaise;
        v = Math.max(minRaise, Math.min(maxRaise, v));
        this.slider.value = v;
        this._updateRaiseDisplay();
      });
    });
  }

  // show(context, holeCards, extras?: { community, opponents, stage })
  show(context, holeCards, extras = {}) {
    this.context = context;
    this.bar.style.display = "flex";
    this.holeEl.replaceChildren();
    const squint = isSquintEnabled();
    for (const c of holeCards) this.holeEl.appendChild(renderCardEl(c, { squintCover: squint }));

    const { toCall, minRaise, maxRaise, legalActions } = context;
    this.callAmountEl.textContent = toCall > 0 ? toCall.toLocaleString() : "";

    this.slider.min = minRaise;
    this.slider.max = maxRaise;
    this.slider.value = Math.min(maxRaise, minRaise);
    this._updateRaiseDisplay();

    for (const btn of this.actionButtons) {
      const act = btn.dataset.act;
      btn.disabled = !legalActions.includes(act);
    }
    // 过牌/跟注互斥显示
    const checkBtn = this.bar.querySelector(".circle-check");
    const callBtn = this.bar.querySelector(".circle-call");
    if (toCall === 0) { checkBtn.style.display = ""; callBtn.style.display = "none"; }
    else { checkBtn.style.display = "none"; callBtn.style.display = ""; }

    // 如果不能加注，隐藏滑块 + 预设 + 加注按钮
    const canRaise = legalActions.includes("raise");
    this.sliderWrap.style.display = canRaise ? "flex" : "none";
    this.presetWrap.style.display = canRaise ? "" : "none";
    const raiseBtn = this.bar.querySelector(".circle-raise");
    raiseBtn.style.display = canRaise ? "" : "none";

    // 牌型 + 胜率
    this._renderHandHint(holeCards, extras.community || []);
    this._renderEquity(holeCards, extras);
  }

  hide() {
    this.bar.style.display = "none";
    this.context = null;
    this._equityToken += 1; // 作废进行中的异步计算
  }

  _updateRaiseDisplay() {
    this.raiseAmountEl.textContent = parseInt(this.slider.value, 10).toLocaleString();
  }

  _renderHandHint(hole, community) {
    if (!hole || hole.length < 2) {
      this.handHintEl.style.display = "none";
      return;
    }
    // 翻前只提示对子 / 高牌组合
    if (community.length === 0) {
      const [a, b] = hole;
      const ra = a[0], rb = b[0];
      let label;
      if (ra === rb) label = `口袋对 · ${displayRank(ra)}`;
      else if (a[1] === b[1]) label = `同花连张 · ${displayRank(ra)}${displayRank(rb)}`;
      else label = `高牌 · ${displayRank(ra)}${displayRank(rb)}`;
      this.handHintEl.textContent = label;
      this.handHintEl.style.display = "";
      return;
    }
    const best = bestOfSeven([...hole, ...community]);
    if (!best) {
      this.handHintEl.style.display = "none";
      return;
    }
    this.handHintEl.textContent = `当前牌型：${best.name}`;
    this.handHintEl.style.display = "";
  }

  _renderEquity(hole, extras) {
    this._equityToken += 1;
    const token = this._equityToken;
    const opponents = Math.max(1, extras.opponents || 1);
    const stage = extras.stage || (extras.community?.length === 0 ? "preflop" : "postflop");

    if (!hole || hole.length < 2) {
      this.equityMeterEl.style.display = "none";
      return;
    }
    this.equityMeterEl.style.display = "";
    this.equityValueEl.textContent = "计算中…";
    this.equityFillEl.style.width = "0%";
    this.equityFillEl.className = "equity-fill";

    // 翻前：用启发式快路径
    if (!extras.community || extras.community.length === 0) {
      const s = preflopStrength(hole);
      const eq = Math.max(0, Math.min(0.98, s - 0.04 * (opponents - 1)));
      this._applyEquityUI(eq);
      return;
    }

    // 翻后：蒙特卡洛 → Web Worker（不阻塞主线程）
    const iterations = EQUITY_ITERATIONS[stage] || 200;
    requestEquity({ holeCards: hole, community: extras.community, opponents, iterations })
      .then((eq) => {
        if (token !== this._equityToken) return;
        this._applyEquityUI(eq);
      })
      .catch(() => {
        if (token !== this._equityToken) return;
        this.equityValueEl.textContent = "—";
      });
  }

  _applyEquityUI(eq) {
    const pct = Math.round(eq * 100);
    this.equityValueEl.textContent = pct + "%";
    this.equityFillEl.style.width = pct + "%";
    let tier = "poor";
    if (pct >= 70) tier = "great";
    else if (pct >= 50) tier = "good";
    else if (pct >= 30) tier = "fair";
    this.equityFillEl.className = "equity-fill tier-" + tier;
  }
}

function displayRank(r) {
  return r === "T" ? "10" : r;
}
