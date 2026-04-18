// 本地多人 - 隐私遮挡屏

export class PrivacyShield {
  constructor(root) {
    this.root = root;
    this.screen = root.querySelector("#privacyScreen");
    this.targetEl = root.querySelector("#privacyTarget");
    this.revealBtn = root.querySelector("#privacyReveal");
  }

  // 显示遮挡屏，直到玩家点击 reveal 按钮
  ask(playerName) {
    return new Promise((resolve) => {
      this.targetEl.textContent = `请传给 ${playerName}`;
      this.screen.style.display = "flex";
      const handler = () => {
        this.revealBtn.removeEventListener("click", handler);
        this.screen.style.display = "none";
        resolve();
      };
      this.revealBtn.addEventListener("click", handler);
    });
  }

  hide() { this.screen.style.display = "none"; }
}
