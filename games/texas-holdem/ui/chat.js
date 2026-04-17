// 聊天面板（含表情）

export class Chat {
  constructor(root, { selfName, onSend, onEmoji }) {
    this.root = root;
    this.selfName = selfName;
    this.onSend = onSend;
    this.onEmoji = onEmoji;

    this.panel = root.querySelector("#chatPanel");
    this.toggleBtn = root.querySelector("#chatToggle");
    this.closeBtn = root.querySelector("#chatClose");
    this.messagesEl = root.querySelector("#chatMessages");
    this.input = root.querySelector("#chatInput");
    this.sendBtn = root.querySelector("#chatSend");

    this.toggleBtn.addEventListener("click", () => this.panel.classList.toggle("open"));
    this.closeBtn.addEventListener("click", () => this.panel.classList.remove("open"));

    this.sendBtn.addEventListener("click", () => this._send());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._send();
    });

    root.querySelectorAll(".chat-emojis .emo").forEach((btn) => {
      btn.addEventListener("click", () => {
        const emo = btn.dataset.emo;
        if (this.onEmoji) this.onEmoji(emo);
      });
    });
  }

  setSelfName(name) { this.selfName = name; }

  _send() {
    const text = this.input.value.trim();
    if (!text) return;
    this.input.value = "";
    if (this.onSend) this.onSend(text);
  }

  addMessage({ sender, text, system = false }) {
    const msg = document.createElement("div");
    msg.className = "chat-msg" + (system ? " system" : "");
    if (system) {
      msg.textContent = text;
    } else {
      msg.innerHTML = `<span class="sender">${escapeHTML(sender)}</span>${escapeHTML(text)}`;
    }
    this.messagesEl.appendChild(msg);
    // 限制历史 100 条
    while (this.messagesEl.children.length > 100) this.messagesEl.firstChild.remove();
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  open() { this.panel.classList.add("open"); }
  close() { this.panel.classList.remove("open"); }
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
}
