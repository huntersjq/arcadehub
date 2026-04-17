// 操作条（玩家行动按钮 + 加注滑块）

import { renderCardEl } from "./table.js";

export class Controls {
  constructor(root, onAction) {
    this.root = root;
    this.onAction = onAction;
    this.bar = root.querySelector("#actionBar");
    this.holeEl = root.querySelector("#holeCardsMini");
    this.callAmountEl = root.querySelector("#callAmount");
    this.raiseAmountEl = root.querySelector("#raiseAmount");
    this.slider = root.querySelector("#raiseSlider");
    this.presetBtns = root.querySelectorAll(".raise-presets button");
    this.actionButtons = root.querySelectorAll(".act-btn");

    this.context = null;

    this.actionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!this.context) return;
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
        const { minRaise, maxRaise, currentBet, pot, playerCurrentBet } = this.context;
        let v = minRaise;
        if (preset === "min") v = minRaise;
        else if (preset === "pot-half") v = Math.floor(playerCurrentBet + pot / 2);
        else if (preset === "pot") v = Math.floor(playerCurrentBet + pot);
        else if (preset === "max") v = maxRaise;
        v = Math.max(minRaise, Math.min(maxRaise, v));
        this.slider.value = v;
        this._updateRaiseDisplay();
      });
    });
  }

  show(context, holeCards) {
    this.context = context;
    this.bar.style.display = "flex";
    this.holeEl.innerHTML = "";
    for (const c of holeCards) this.holeEl.appendChild(renderCardEl(c));

    const { toCall, minRaise, maxRaise, legalActions } = context;
    this.callAmountEl.textContent = toCall > 0 ? toCall.toLocaleString() : "";

    this.slider.min = minRaise;
    this.slider.max = maxRaise;
    this.slider.value = Math.min(maxRaise, minRaise);
    this._updateRaiseDisplay();

    for (const btn of this.actionButtons) {
      const act = btn.dataset.act;
      btn.disabled = !legalActions.includes(act);
      // 按语义修正按钮标签
      if (act === "call") {
        btn.firstChild.nodeValue = toCall > 0 ? "跟注 " : "跟注 ";
      }
    }
    // 过牌/跟注互斥显示
    const checkBtn = this.bar.querySelector(".act-check");
    const callBtn = this.bar.querySelector(".act-call");
    if (toCall === 0) { checkBtn.style.display = ""; callBtn.style.display = "none"; }
    else { checkBtn.style.display = "none"; callBtn.style.display = ""; }

    // 如果不能加注，隐藏滑块
    const canRaise = legalActions.includes("raise");
    this.slider.parentElement.style.display = canRaise ? "flex" : "none";
    const raiseBtn = this.bar.querySelector(".act-raise");
    raiseBtn.style.display = canRaise ? "" : "none";
  }

  hide() {
    this.bar.style.display = "none";
    this.context = null;
  }

  _updateRaiseDisplay() {
    this.raiseAmountEl.textContent = parseInt(this.slider.value, 10).toLocaleString();
  }
}
