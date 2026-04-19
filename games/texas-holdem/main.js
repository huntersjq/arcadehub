// 德州扑克 - 主编排
// 职责：
//   1. 大厅交互（4 种模式 tab 切换、表单收集）
//   2. 根据模式构造 Game + 可选传输层（LocalChannel / PeerChannel）
//   3. 事件循环：消费 game.drainEvents() → 派发到 UI / 调度 AI / 广播网络
//   4. 本地多人 Hot-Seat 隐私屏切换
//   5. 联机房主权威 + 客户端镜像
//   6. 结算弹窗 + 牌局结束渲染

import { Game, STAGE, STAGE_NAME_CN } from "./engine/game.js";
import { SUIT_SYMBOL } from "./engine/deck.js";
import { HAND_NAME_CN } from "./engine/hand.js";
import { decide, decideEmoji } from "./ai/bot.js";
import { TableView, renderCardEl } from "./ui/table.js";
import { Controls } from "./ui/controls.js";
import { Chat } from "./ui/chat.js";
import { PrivacyShield } from "./ui/privacy.js";
import { HandHistory } from "./ui/history.js";
import { SoundFx } from "./ui/sfx.js";
import { recordHand, showMilestoneToast } from "./ui/stats.js";
import { LocalChannel, PeerChannel, LanChannel, genRoomCode } from "./net/channel.js";
import { DEFAULT_RELAY_URL } from "./net/relay-config.js";
import { isSquintEnabled, setSquintEnabled } from "./ui/squint.js";
import {
  applyTheme, getTheme, setTheme, getDeckMode, setDeckMode,
  THEMES, DECK_MODES, THEME_LABELS, DECK_LABELS,
} from "./ui/theme.js";

// ── 全局状态 ──

const root = document;
const screens = {
  lobby: root.getElementById("lobby"),
  privacy: root.getElementById("privacyScreen"),
  waiting: root.getElementById("waitingRoom"),
  table: root.getElementById("table"),
};

let currentMode = "solo";           // solo | hotseat | multitab | online
let game = null;                    // Game 实例（权威端持有）
let channel = null;                 // LocalChannel | PeerChannel
let isHost = true;                  // 联机中是否为房主
let selfId = null;                  // 本地玩家 id（单人/hot-seat: 当前人类；联机: 对应 peerId）
let humanPlayerIds = [];            // 本地多人时所有真人 id 列表
let activeHumanIndex = 0;           // 当前轮到的人类玩家索引
let aiScheduleTimer = null;         // AI 行动延迟定时器
let tableView = null;
let controls = null;
let chat = null;
let privacy = null;
let history = null;
let sfx = null;
let ownHoleCards = {};              // 每个真人的底牌（本地/hot-seat: map; 联机客户端: 只有自己的）
let revealedHoles = {};             // 摊牌时揭示的底牌
let latestSnapshot = null;          // 客户端镜像用
let pendingHandResult = null;       // 结算信息缓存
let soundOn = true;
let waitingPlayers = [];            // 等待房玩家列表（联机）
let handStartStacks = {};           // 本手开始时各玩家筹码快照（用于结算展示盈亏）
let handStartHoles = {};            // 本手各玩家底牌（镜像客户端和结算用）
let lastCommunityCards = [];        // 本手最终公共牌（结算用）
let lastActionBubbles = {};         // { playerId: { action, amount, stage, handNumber, t } } 每人最近一次行动
let currentActionDeadline = null;   // { playerId, deadlineMs, totalMs } 圆环 + 主机端 auto-fold 用
let _actionTimeoutId = null;        // 主机端：当前行动玩家的超时计时器

// ── 屏幕切换 ──

function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) {
    if (!el) continue;
    el.style.display = k === name ? "" : "none";
  }
}

// ── 启动 ──

function init() {
  // 默认昵称
  const nameInput = root.getElementById("nameInput");
  const savedName = localStorage.getItem("holdem_name");
  nameInput.value = savedName || randomName();

  // 显示 legacy tab（PeerJS 跨设备联机）当 URL 带 ?legacy=1 时
  try {
    const legacy = new URLSearchParams(window.location.search).get("legacy");
    if (legacy === "1") {
      root.querySelectorAll('.lobby-tab[data-legacy="true"]').forEach((t) => {
        t.style.display = "";
      });
    }
  } catch (_) {}

  // 中继地址回填：优先用 localStorage 里的；否则回退到代码里配置的默认值
  const relayInput = root.getElementById("relayUrl");
  if (relayInput) {
    const savedRelay = localStorage.getItem("holdem_relay_url");
    relayInput.value = savedRelay || DEFAULT_RELAY_URL || "";
  }

  sfx = new SoundFx();
  soundOn = sfx.isEnabled();

  // 应用主题 + 牌色（写到 <body data-theme/data-deck>），再绑定事件
  applyTheme();

  bindLobbyEvents();
  bindTableUIEvents();
  bindSettingsPopup();

  showScreen("lobby");
}

function randomName() {
  const names = ["玩家", "小明", "小红", "阿强", "Ace", "Lucky", "Mike", "Ken"];
  return names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100);
}

function bindLobbyEvents() {
  // Tab 切换
  const tabs = root.querySelectorAll(".lobby-tab");
  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      currentMode = t.dataset.mode;
      updateLobbyFields();
    });
  });
  updateLobbyFields();

  // 开始按钮
  root.getElementById("startBtn").addEventListener("click", () => {
    onStartClicked().catch((e) => {
      console.error(e);
      alert("启动失败：" + (e?.message || e));
    });
  });

  // 等待房
  root.getElementById("hostStartBtn").addEventListener("click", () => startOnlineGame());
  root.getElementById("leaveRoomBtn").addEventListener("click", () => leaveRoom());
  root.getElementById("copyRoomBtn").addEventListener("click", () => {
    const code = root.getElementById("roomCodeDisplay").textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(code);
    const btn = root.getElementById("copyRoomBtn");
    const orig = btn.textContent;
    btn.textContent = "已复制";
    setTimeout(() => (btn.textContent = orig), 1200);
  });

  root.getElementById("privacyReveal"); // 已在 PrivacyShield 中绑定
}

function updateLobbyFields() {
  const hotseatFields = root.getElementById("hotseatFields");
  const aiFields = root.getElementById("aiFields");
  const onlineFields = root.getElementById("onlineFields");
  const hintPeer = root.getElementById("onlineHintPeer");
  const hintLan = root.getElementById("onlineHintLan");
  const relayField = root.getElementById("relayUrlField");

  hotseatFields.style.display = currentMode === "hotseat" ? "" : "none";
  const isOnlineish = currentMode === "multitab" || currentMode === "online" || currentMode === "lan";
  onlineFields.style.display = isOnlineish ? "" : "none";
  aiFields.style.display = (currentMode === "solo" || currentMode === "hotseat") ? "" : "none";

  if (hintPeer) hintPeer.style.display = currentMode === "online" ? "" : "none";
  if (hintLan)  hintLan.style.display  = currentMode === "lan" ? "" : "none";
  if (relayField) relayField.style.display = currentMode === "lan" ? "" : "none";
}

function bindTableUIEvents() {
  root.getElementById("leaveBtn").addEventListener("click", () => {
    if (!confirm("确定离开当前牌局？")) return;
    cleanupGame();
    showScreen("lobby");
  });
  root.getElementById("soundToggle").addEventListener("click", () => {
    soundOn = !soundOn;
    if (sfx) sfx.setEnabled(soundOn);
    root.getElementById("soundToggle").textContent = soundOn ? "🔊" : "🔇";
    if (soundOn) sfx?.button();
  });
  // 初始图标
  root.getElementById("soundToggle").textContent = soundOn ? "🔊" : "🔇";

  // 眯牌模式开关
  const squintBtn = root.getElementById("squintToggle");
  if (squintBtn) {
    const refreshSquintBtn = () => {
      const on = isSquintEnabled();
      squintBtn.textContent = on ? "🙈" : "👁️";
      squintBtn.classList.toggle("active", on);
      squintBtn.title = on ? "眯牌模式：开（默认背面 · 长按看牌）" : "眯牌模式：关（底牌正面）";
    };
    refreshSquintBtn();
    squintBtn.addEventListener("click", () => {
      setSquintEnabled(!isSquintEnabled());
      refreshSquintBtn();
      // 立即重渲染一次桌面，让设置生效（不等下一个事件）
      try {
        if (isHost) renderAuthoritative();
        else renderMirror();
      } catch (_) {}
    });
  }
  root.getElementById("nextHandBtn").addEventListener("click", () => {
    root.getElementById("handResult").style.display = "none";
    if (isHost && game && game.stage !== STAGE.GAME_OVER) {
      startNextHand();
    }
  });
  root.getElementById("rematchBtn").addEventListener("click", () => {
    root.getElementById("gameOver").style.display = "none";
    cleanupGame();
    showScreen("lobby");
  });
  root.getElementById("backLobbyBtn").addEventListener("click", () => {
    root.getElementById("gameOver").style.display = "none";
    cleanupGame();
    showScreen("lobby");
  });
}

// ── 开始游戏 ──

async function onStartClicked() {
  const name = root.getElementById("nameInput").value.trim() || "玩家";
  const stack = parseInt(root.getElementById("stackSelect").value, 10);
  const blindsMode = root.getElementById("blindsSelect").value;
  localStorage.setItem("holdem_name", name);

  if (currentMode === "solo") {
    startLocalGame({ name, stack, blindsMode, humanCount: 1, humanNames: [name] });
  } else if (currentMode === "hotseat") {
    const humanCount = parseInt(root.getElementById("humanCount").value, 10);
    const namesRaw = root.getElementById("humanNames").value.trim();
    let humanNames = namesRaw ? namesRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [];
    if (humanNames.length === 0) humanNames = [name];
    while (humanNames.length < humanCount) humanNames.push("玩家" + (humanNames.length + 1));
    humanNames = humanNames.slice(0, humanCount);
    startLocalGame({ name, stack, blindsMode, humanCount, humanNames, hotseat: true });
  } else if (currentMode === "multitab" || currentMode === "online" || currentMode === "lan") {
    await startOnlineFlow(name, stack, blindsMode);
  }
}

function buildPlayersList({ humanNames, aiCount, aiLevel, stack }) {
  const players = [];
  humanNames.forEach((n, i) => {
    players.push({ id: "human_" + i, name: n, stack, isHuman: true });
  });
  for (let i = 0; i < aiCount; i++) {
    players.push({ id: "ai_" + i, name: "AI-" + (i + 1), stack, isHuman: false, aiLevel });
  }
  return players;
}

function startLocalGame({ name, stack, blindsMode, humanCount, humanNames, hotseat = false }) {
  const aiCount = parseInt(root.getElementById("aiCount").value, 10);
  const aiLevel = root.getElementById("aiLevel").value;
  const players = buildPlayersList({ humanNames, aiCount, aiLevel, stack });

  if (players.length < 2) {
    alert("至少需要 2 位玩家");
    return;
  }

  // 随机座位顺序
  shuffleInPlace(players);

  game = new Game({
    players,
    smallBlind: blindsMode === "tourney" ? 25 : 50,
    bigBlind: blindsMode === "tourney" ? 50 : 100,
    blindsMode,
  });

  humanPlayerIds = players.filter((p) => p.isHuman).map((p) => p.id);
  activeHumanIndex = 0;
  selfId = hotseat ? humanPlayerIds[0] : humanPlayerIds[0];
  ownHoleCards = {};
  revealedHoles = {};
  isHost = true;

  mountTableUI({ selfName: humanNames[0] || name, hotseat });
  showScreen("table");
  game.startHand();
  pumpEvents();
}

async function startOnlineFlow(name, stack, blindsMode) {
  const roomCode = root.getElementById("roomCode").value.trim().toUpperCase();
  const ChannelCtor =
    currentMode === "multitab" ? LocalChannel :
    currentMode === "lan" ? LanChannel :
    PeerChannel;
  isHost = !roomCode;
  const actualRoomCode = roomCode || genRoomCode();

  // LAN / 公网中继模式：记住用户输入的中继地址
  let relayUrl = null;
  if (currentMode === "lan") {
    relayUrl = root.getElementById("relayUrl")?.value.trim() || null;
    if (relayUrl) localStorage.setItem("holdem_relay_url", relayUrl);
    else localStorage.removeItem("holdem_relay_url");
  }

  channel = new ChannelCtor({ roomCode: actualRoomCode, isHost, name, relayUrl });

  try {
    await channel.open();
  } catch (e) {
    alert("打开房间失败：" + (e?.message || e));
    channel = null;
    return;
  }

  // 断线重连的 UI + 同步逻辑（对任意传输层都生效）
  channel.onMessage((msg, from) => {
    if (msg.type === "reconnecting") {
      showReconnectToast(`网络中断，正在重连 (${msg.attempt}/${msg.maxAttempts})...`);
    } else if (msg.type === "reconnected") {
      showReconnectToast("已恢复连接", { success: true });
    } else if (msg.type === "host_resumed") {
      showReconnectToast("房主已恢复", { success: true });
    } else if (msg.type === "peer_resumed") {
      // 房主端：对应客户端重连，补发最新状态 + 私密底牌
      if (isHost && game) {
        const pid = msg.peerId;
        channel.send({ type: "state", state: buildSnapshot() }, pid);
        const ownCards = ownHoleCards[pid] || game.players.find((p) => p.id === pid)?.holeCards;
        if (ownCards && ownCards.length > 0) {
          channel.send({ type: "hole_cards", cards: ownCards }, pid);
        }
        showReconnectToast(`${game.players.find((p) => p.id === pid)?.name || "玩家"} 已重连`, { success: true });
      }
    }
  });

  selfId = channel.getSelfId();
  root.getElementById("roomCodeDisplay").textContent = channel.getRoomCode();

  // 等待房 UI
  const hostStartBtn = root.getElementById("hostStartBtn");
  const waitingHint = root.getElementById("waitingHint");
  if (isHost) {
    waitingPlayers = [{ id: selfId, name, stack, isHost: true, ready: true }];
    hostStartBtn.style.display = "";
    waitingHint.textContent = "把房间码分享给朋友即可加入";
    renderWaitingPlayers();

    channel.onMessage((msg, from) => hostHandleLobbyMessage(msg, from, { stack, blindsMode }));
  } else {
    waitingPlayers = [];
    hostStartBtn.style.display = "none";
    waitingHint.textContent = "已连接房间，等待房主开始...";
    renderWaitingPlayers();

    channel.onMessage((msg, from) => clientHandleMessage(msg, from));
    channel.send({ type: "hello", name, peerId: selfId });
  }

  // 存储本地配置以便开始时使用
  window._holdemOnlineConfig = { name, stack, blindsMode };

  showScreen("waiting");
}

function hostHandleLobbyMessage(msg, from, lobbyCfg) {
  if (msg.type === "hello") {
    // 分配 id
    const pid = msg.peerId || from;
    if (!waitingPlayers.find((p) => p.id === pid)) {
      waitingPlayers.push({
        id: pid,
        name: msg.name || "访客",
        stack: lobbyCfg.stack,
        isHost: false,
        ready: true,
      });
    }
    // welcome 给新来者
    channel.send({
      type: "welcome",
      selfId: pid,
      players: waitingPlayers.map((p) => ({ id: p.id, name: p.name })),
      config: { stack: lobbyCfg.stack, blindsMode: lobbyCfg.blindsMode },
    }, pid);
    // 广播最新名单
    channel.send({ type: "lobby_update", players: waitingPlayers.map((p) => ({ id: p.id, name: p.name })) });
    renderWaitingPlayers();
  } else if (msg.type === "chat") {
    chat?.addMessage({ sender: msg.sender, text: msg.text });
    // 广播给其他人
    channel.send({ type: "chat", sender: msg.sender, text: msg.text });
  } else if (msg.type === "leave") {
    waitingPlayers = waitingPlayers.filter((p) => p.id !== msg.playerId);
    renderWaitingPlayers();
    channel.send({ type: "lobby_update", players: waitingPlayers.map((p) => ({ id: p.id, name: p.name })) });
  }
  // 开局后的消息（action）交由 runtime handler 处理
}

function clientHandleMessage(msg, from) {
  if (msg.type === "welcome") {
    selfId = msg.selfId;
    waitingPlayers = msg.players.map((p) => ({ id: p.id, name: p.name }));
    renderWaitingPlayers();
  } else if (msg.type === "lobby_update") {
    waitingPlayers = msg.players;
    renderWaitingPlayers();
  } else if (msg.type === "start_game") {
    // 客户端无需构建 Game，仅等待 state/events
    const cfg = msg.config || {};
    mountTableUI({ selfName: waitingPlayers.find((p) => p.id === selfId)?.name || "玩家", hotseat: false });
    ownHoleCards = {};
    revealedHoles = {};
    showScreen("table");
  } else if (msg.type === "state") {
    latestSnapshot = msg.state;
    renderMirror();
  } else if (msg.type === "events") {
    // 按事件处理（客户端视角）
    for (const ev of msg.events) handleMirrorEvent(ev);
  } else if (msg.type === "hole_cards") {
    ownHoleCards[selfId] = msg.cards;
    sfx?.deal();
    renderMirror();
  } else if (msg.type === "chat") {
    chat?.addMessage({ sender: msg.sender, text: msg.text });
  } else if (msg.type === "emoji") {
    tableView?.floatEmojiOver(msg.playerId, msg.emoji);
  } else if (msg.type === "disconnected") {
    alert("与房主断开连接");
    cleanupGame();
    showScreen("lobby");
  }
}

function renderWaitingPlayers() {
  const container = root.getElementById("waitingPlayers");
  container.textContent = "";
  for (const p of waitingPlayers) {
    const div = document.createElement("div");
    div.className = "waiting-player";
    div.textContent = p.name + (p.isHost ? " (房主)" : "");
    container.appendChild(div);
  }
}

function leaveRoom() {
  if (channel && !isHost) channel.send({ type: "leave", playerId: selfId });
  cleanupGame();
  showScreen("lobby");
}

function startOnlineGame() {
  if (!isHost) return;
  const cfg = window._holdemOnlineConfig || {};
  if (waitingPlayers.length < 2) {
    alert("至少需要 2 位玩家才能开始");
    return;
  }
  // 构造玩家（真人 + 可选 AI 补位；此处仅真人）
  const players = waitingPlayers.map((p, i) => ({
    id: p.id, name: p.name, stack: cfg.stack || 10000, isHuman: true,
  }));
  // 随机座位
  shuffleInPlace(players);

  game = new Game({
    players,
    smallBlind: cfg.blindsMode === "tourney" ? 25 : 50,
    bigBlind: cfg.blindsMode === "tourney" ? 50 : 100,
    blindsMode: cfg.blindsMode || "fixed",
  });

  humanPlayerIds = players.map((p) => p.id);
  activeHumanIndex = 0;
  ownHoleCards = {};
  revealedHoles = {};

  // 重新绑定消息处理器以支持 action
  channel.onMessage((msg, from) => hostHandleRuntimeMessage(msg, from));

  channel.send({
    type: "start_game",
    config: {
      stack: cfg.stack,
      blindsMode: cfg.blindsMode,
      players: players.map((p) => ({ id: p.id, name: p.name })),
    },
  });

  mountTableUI({ selfName: players.find((p) => p.id === selfId)?.name || "房主", hotseat: false });
  showScreen("table");
  game.startHand();
  pumpEvents();
}

function hostHandleRuntimeMessage(msg, from) {
  if (msg.type === "action") {
    if (game && game.stage !== STAGE.GAME_OVER) {
      const result = game.applyAction(msg.playerId, msg.action);
      if (result?.error) {
        // 忽略非法动作
      }
      pumpEvents();
    }
  } else if (msg.type === "request_state") {
    // 重连客户端主动请求当前状态（无服务端 resume 的中继会走这条路径）
    if (isHost && game) {
      const pid = from || msg.playerId;
      if (!pid) return;
      channel.send({ type: "state", state: buildSnapshot() }, pid);
      const p = game.players.find((x) => x.id === pid);
      if (p?.holeCards?.length) {
        channel.send({ type: "hole_cards", cards: p.holeCards.slice() }, pid);
      }
    }
  } else if (msg.type === "chat") {
    chat?.addMessage({ sender: msg.sender, text: msg.text });
    channel.send({ type: "chat", sender: msg.sender, text: msg.text });
  } else if (msg.type === "emoji") {
    tableView?.floatEmojiOver(msg.playerId, msg.emoji);
    channel.send(msg);
  } else if (msg.type === "leave") {
    // 离开处理（简化：标记 sittingOut）
    const p = game?.players.find((x) => x.id === msg.playerId);
    if (p) { p.sittingOut = true; p.folded = true; }
  }
}

// ── UI 挂载 ──

function mountTableUI({ selfName, hotseat }) {
  tableView = new TableView(root);
  privacy = new PrivacyShield(root);

  controls = new Controls(root, (action) => {
    onHumanAction(action);
  });

  chat = new Chat(root, {
    selfName,
    onSend: (text) => sendChat(text),
    onEmoji: (emoji) => sendEmoji(emoji),
  });

  history = new HandHistory(root);
}

function onHumanAction(action) {
  // 客户端（非房主）：无本地 game 实例，直接把动作发给房主
  if (isOnlineMode() && !isHost) {
    channel.send({ type: "action", playerId: selfId, action });
    controls.hide();
    return;
  }

  // 本地 / 房主路径：需要查出当前 actor
  const actor = game ? game.players[game.actionIndex] : null;
  if (!actor) return;

  // 本地 / 房主
  const pid = hotseatActiveId() || actor.id;
  const result = game.applyAction(pid, action);
  if (result?.error) return;
  controls.hide();
  pumpEvents();
}

function hotseatActiveId() {
  if (currentMode !== "hotseat" || !game) return null;
  const actor = game.players[game.actionIndex];
  if (actor && actor.isHuman) return actor.id;
  return null;
}

function sendChat(text) {
  if (!text) return;
  const selfName = getSelfName();
  chat.addMessage({ sender: selfName, text });
  if (channel) channel.send({ type: "chat", sender: selfName, text });
}

function sendEmoji(emoji) {
  tableView?.floatEmojiOver(selfId, emoji);
  if (channel) channel.send({ type: "emoji", sender: getSelfName(), playerId: selfId, emoji });
}

function getSelfName() {
  if (game) {
    const p = game.players.find((x) => x.id === selfId);
    if (p) return p.name;
  }
  return root.getElementById("nameInput").value.trim() || "玩家";
}

function isOnlineMode() {
  return currentMode === "multitab" || currentMode === "online" || currentMode === "lan";
}

// ── 事件循环（房主 / 本地） ──
//
// 阶段切换（preflop → flop / flop → turn / turn → river）会在 UI 上插入
// 1.2s 喘息时间（参考 wp.apk GameRoundQueueManage.ROUND_DELAY），让玩家
// 看清新公共牌再决定，避免事件洪流压死视觉。

const ROUND_DELAY_MS = 1200;
let _pumpQueue = [];
let _pumpTimer = null;
const _pendingBatch = []; // 当前批次的事件（用于联机广播）

function shouldDelayAfter(ev) {
  return ev.type === "stage" && (ev.stage === "flop" || ev.stage === "turn" || ev.stage === "river");
}

function pumpEvents() {
  if (!game) return;
  const events = game.drainEvents();
  if (events.length === 0) return;
  _pumpQueue.push(...events);
  _drainPump();
}

function _drainPump() {
  if (_pumpTimer) return; // 已在等待 — 等定时器回调来继续
  while (_pumpQueue.length > 0) {
    const ev = _pumpQueue.shift();
    _processOneEvent(ev);
    if (shouldDelayAfter(ev) && _pumpQueue.length > 0) {
      // 把当前批次广播 + 渲染，然后挂起 1.2s
      _flushBatch();
      renderAuthoritative();
      _pumpTimer = setTimeout(() => {
        _pumpTimer = null;
        _drainPump();
      }, ROUND_DELAY_MS);
      return;
    }
  }
  // 队列消尽 → 收尾广播 + 渲染 + AI 调度
  _flushBatch();
  renderAuthoritative();
  scheduleAIIfNeeded();
}

function _processOneEvent(ev) {
  // 当事件被实际"上桌"时（而非引擎压栈时）重打 deadline 时间戳
  // 这样阶段延迟期间被推迟的 action_required 仍能给玩家完整 15s 决策窗口
  if (ev.type === "action_required" && ev.timeoutMs > 0) {
    ev = { ...ev, deadline: Date.now() + ev.timeoutMs };
  }
  handleAuthoritativeEvent(ev);
  _pendingBatch.push(ev);
}

function _flushBatch() {
  if (_pendingBatch.length === 0) return;
  if (isOnlineMode() && isHost && channel) {
    channel.send({ type: "state", state: buildSnapshot() });
    channel.send({ type: "events", events: sanitizeEventsForClients(_pendingBatch) });
    for (const ev of _pendingBatch) {
      if (ev.type === "deal_hole") {
        if (ev.playerId !== selfId) {
          channel.send({ type: "hole_cards", cards: ev.cards }, ev.playerId);
        } else {
          ownHoleCards[selfId] = ev.cards;
        }
      }
    }
  }
  // 本地 deal_hole 已由 handleAuthoritativeEvent 落到 ownHoleCards，此处无需再做
  _pendingBatch.length = 0;
}

function _resetPump() {
  if (_pumpTimer) { clearTimeout(_pumpTimer); _pumpTimer = null; }
  _pumpQueue.length = 0;
  _pendingBatch.length = 0;
}

function sanitizeEventsForClients(events) {
  // 过滤掉底牌事件（只含卡号的除外——deal_hole 不能广播）
  return events.filter((e) => e.type !== "deal_hole");
}

function buildSnapshot() {
  const s = game.snapshot();
  return s;
}

function handleAuthoritativeEvent(ev) {
  if (ev.type === "hand_start") {
    ownHoleCards = {};
    revealedHoles = {};
    // 记录开局筹码快照 + 清空底牌/公共牌缓存
    handStartStacks = {};
    handStartHoles = {};
    lastCommunityCards = [];
    lastActionBubbles = {};
    if (game) {
      for (const p of game.players) handStartStacks[p.id] = p.stack;
    }
    pendingHandResult = null;
    tableView?.showDealerLog(`第 ${ev.handNumber} 手 · 盲注 ${ev.smallBlind}/${ev.bigBlind}`);
  } else if (ev.type === "deal_hole") {
    // 本地 / hotseat 下：真人玩家都记录自己的底牌
    const p = game.players.find((x) => x.id === ev.playerId);
    if (p?.isHuman) ownHoleCards[ev.playerId] = ev.cards;
    // 本地/房主：全量保存以便结算展示
    handStartHoles[ev.playerId] = ev.cards.slice();
    if (p?.id === selfId) sfx?.deal();
  } else if (ev.type === "stage") {
    const stageCN = STAGE_NAME_CN[ev.stage];
    tableView?.showDealerLog(`—— ${stageCN} ——`);
    if (["flop", "turn", "river"].includes(ev.stage)) {
      tableView?.showStageBanner(stageCN);
      sfx?.flop();
    }
    if (ev.community) lastCommunityCards = ev.community.slice();
    // 新一轮开始，保留弃牌胶囊，清除其余
    pruneActionBubbles();
  } else if (ev.type === "action") {
    const p = game.players.find((x) => x.id === ev.playerId);
    if (!p) return;
    const desc = actionDescription(ev);
    tableView?.showDealerLog(`${p.name} ${desc}`, 1800);
    // 飘字 + 飞筹码
    if (tableView) {
      tableView.floatActionLabel(p.id, shortActionLabel(ev), ev.action);
      if (ev.amount && ev.amount > 0 && ev.action !== "fold" && ev.action !== "check") {
        tableView.flyChipsToPot(p.id, ev.amount);
      }
    }
    playActionSfx(ev.action);
    // 行动胶囊
    lastActionBubbles[ev.playerId] = {
      action: ev.action,
      amount: ev.amount || 0,
      totalBet: ev.totalBet || 0,
      stage: game.stage,
      handNumber: game.handNumber,
    };
  } else if (ev.type === "showdown") {
    lastCommunityCards = ev.community.slice();
    for (const h of ev.hands) revealedHoles[h.id] = h.holeCards;
    pendingHandResult = pendingHandResult || {};
    pendingHandResult.showdownHands = ev.hands;
    pendingHandResult.community = ev.community.slice();
  } else if (ev.type === "award") {
    pendingHandResult = pendingHandResult || {};
    pendingHandResult.winners = ev.winners;
    pendingHandResult.reason = ev.winners[0]?.reason;
    const winnerIds = ev.winners.map((w) => w.id);
    tableView?.highlightWinners(winnerIds);
    // 赢家彩带 + 飞向赢家的筹码
    for (const w of ev.winners) {
      tableView?.burstConfetti(w.id);
    }
    sfx?.win();
  } else if (ev.type === "action_required") {
    currentActionDeadline = ev.deadline
      ? { playerId: ev.playerId, deadlineMs: ev.deadline, totalMs: ev.timeoutMs }
      : null;
    scheduleActionTimeout();
  } else if (ev.type === "hand_over") {
    // 牌桌清空公共牌，等待下一手
    currentActionDeadline = null;
    clearActionTimeout();
    tableView?.clearBoard();
    showHandResult();
  } else if (ev.type === "game_over") {
    currentActionDeadline = null;
    clearActionTimeout();
    showGameOver(ev.winner);
  }
}

// ── 行动超时（主机端自动 check / fold） ──

function clearActionTimeout() {
  if (_actionTimeoutId) { clearTimeout(_actionTimeoutId); _actionTimeoutId = null; }
}

// ── 设置弹窗（主题 + 牌色） ──

function bindSettingsPopup() {
  const btn = document.getElementById("settingsToggle");
  const popup = document.getElementById("settingsPopup");
  const themeWrap = document.getElementById("settingsThemes");
  const deckWrap = document.getElementById("settingsDecks");
  if (!btn || !popup || !themeWrap || !deckWrap) return;

  function buildRadios(wrap, name, options, labels, current) {
    wrap.replaceChildren();
    for (const v of options) {
      const lab = document.createElement("label");
      lab.className = "settings-radio";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = v;
      if (v === current) input.checked = true;
      const span = document.createElement("span");
      span.textContent = labels[v];
      lab.appendChild(input);
      lab.appendChild(span);
      wrap.appendChild(lab);
    }
  }

  buildRadios(themeWrap, "theme", THEMES, THEME_LABELS, getTheme());
  buildRadios(deckWrap, "deck", DECK_MODES, DECK_LABELS, getDeckMode());

  themeWrap.addEventListener("change", (e) => {
    if (e.target.name === "theme") {
      setTheme(e.target.value);
      reRenderTable();
    }
  });
  deckWrap.addEventListener("change", (e) => {
    if (e.target.name === "deck") {
      setDeckMode(e.target.value);
      reRenderTable();
    }
  });

  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    popup.classList.toggle("open");
  });
  document.addEventListener("click", (ev) => {
    if (!popup.contains(ev.target) && ev.target !== btn) popup.classList.remove("open");
  });
}

function reRenderTable() {
  try {
    if (isHost) renderAuthoritative();
    else renderMirror();
  } catch (_) {}
}

// 把当前 deadline 推给 TableView（rAF 驱动 SVG 圆环）
function applyActionDeadlineToTable() {
  if (!tableView) return;
  if (currentActionDeadline) {
    tableView.setActionDeadline(
      currentActionDeadline.playerId,
      currentActionDeadline.deadlineMs,
      currentActionDeadline.totalMs,
    );
  } else {
    tableView.setActionDeadline(null);
  }
}

function scheduleActionTimeout() {
  clearActionTimeout();
  if (!isHost || !game) return;
  const d = currentActionDeadline;
  if (!d) return;
  const actor = game.players[game.actionIndex];
  if (!actor || !actor.isHuman) return; // AI 自有调度器
  const ms = Math.max(0, d.deadlineMs - Date.now());
  _actionTimeoutId = setTimeout(() => {
    _actionTimeoutId = null;
    if (!game) return;
    if (game.actionIndex < 0) return;
    const cur = game.players[game.actionIndex];
    if (!cur || cur.id !== d.playerId) return; // 已切换或已弃牌
    const ctx = buildActionContextFromGame(cur);
    const action = ctx.legalActions.includes("check") ? { type: "check" } : { type: "fold" };
    game.applyAction(cur.id, action);
    pumpEvents();
  }, ms);
}

function handleMirrorEvent(ev) {
  // 客户端镜像：使用 latestSnapshot 已更新；此处只处理 UI 信息
  if (ev.type === "hand_start") {
    ownHoleCards = {};
    revealedHoles = {};
    handStartStacks = {};
    lastCommunityCards = [];
    lastActionBubbles = {};
    if (latestSnapshot) {
      for (const p of latestSnapshot.players) handStartStacks[p.id] = p.stack;
    }
    pendingHandResult = null;
  } else if (ev.type === "stage") {
    if (ev.community) lastCommunityCards = ev.community.slice();
    const stageCN = STAGE_NAME_CN[ev.stage];
    if (["flop", "turn", "river"].includes(ev.stage)) {
      tableView?.showStageBanner(stageCN);
      sfx?.flop();
    }
    pruneActionBubbles();
  } else if (ev.type === "action") {
    const p = latestSnapshot?.players.find((x) => x.id === ev.playerId);
    if (p) {
      tableView?.showDealerLog(`${p.name} ${actionDescription(ev)}`, 1800);
      tableView?.floatActionLabel(p.id, shortActionLabel(ev), ev.action);
      if (ev.amount && ev.amount > 0 && ev.action !== "fold" && ev.action !== "check") {
        tableView?.flyChipsToPot(p.id, ev.amount);
      }
    }
    playActionSfx(ev.action);
    lastActionBubbles[ev.playerId] = {
      action: ev.action,
      amount: ev.amount || 0,
      totalBet: ev.totalBet || 0,
      stage: latestSnapshot?.stage || "",
      handNumber: latestSnapshot?.handNumber || 0,
    };
  } else if (ev.type === "showdown") {
    lastCommunityCards = ev.community.slice();
    for (const h of ev.hands) revealedHoles[h.id] = h.holeCards;
    pendingHandResult = pendingHandResult || {};
    pendingHandResult.showdownHands = ev.hands;
    pendingHandResult.community = ev.community.slice();
  } else if (ev.type === "award") {
    pendingHandResult = pendingHandResult || {};
    pendingHandResult.winners = ev.winners;
    pendingHandResult.reason = ev.winners[0]?.reason;
    tableView?.highlightWinners(ev.winners.map((w) => w.id));
    for (const w of ev.winners) tableView?.burstConfetti(w.id);
    sfx?.win();
  } else if (ev.type === "action_required") {
    // 客户端只展示倒计时；不参与超时判定（房主权威）
    currentActionDeadline = ev.deadline
      ? { playerId: ev.playerId, deadlineMs: ev.deadline, totalMs: ev.timeoutMs }
      : null;
  } else if (ev.type === "hand_over") {
    currentActionDeadline = null;
    tableView?.clearBoard();
    showHandResult();
  } else if (ev.type === "game_over") {
    currentActionDeadline = null;
    showGameOver(ev.winner);
  }
}

function actionDescription(ev) {
  switch (ev.action) {
    case "fold": return "弃牌";
    case "check": return "过牌";
    case "call": return `跟注 ${ev.amount || 0}`;
    case "raise": return `加注至 ${ev.totalBet || ev.amount}`;
    case "allin": return `全下 ${ev.amount}`;
    default: return ev.action;
  }
}

// 飘字用的短标签（配合飞筹码效果）
function shortActionLabel(ev) {
  switch (ev.action) {
    case "fold": return "弃牌";
    case "check": return "过牌";
    case "call": return `跟注 +${(ev.amount || 0).toLocaleString()}`;
    case "raise": return `加注 +${(ev.amount || 0).toLocaleString()}`;
    case "allin": return `全下 +${(ev.amount || 0).toLocaleString()}`;
    default: return ev.action;
  }
}

function renderAuthoritative() {
  if (!game || !tableView) return;
  const snap = game.snapshot();
  // 注入视角用底牌
  snap.ownHoleCards = ownHoleCards[currentPerspectiveId()] || null;
  snap.revealedHoles = revealedHoles;
  snap.actionBubbles = lastActionBubbles;
  tableView.render(snap, currentPerspectiveId());
  applyActionDeadlineToTable();

  // 行动条
  const idx = game.actionIndex;
  if (idx < 0 || game.stage === STAGE.HAND_OVER || game.stage === STAGE.SHOWDOWN || game.stage === STAGE.GAME_OVER) {
    controls?.hide();
    return;
  }

  const actor = game.players[idx];
  if (!actor) return;

  // 只在真人玩家轮到时显示操作条
  const isLocalTurn = shouldShowControlsForActor(actor);
  if (!isLocalTurn) {
    controls?.hide();
    return;
  }

  showControlsForActor(actor);
}

function shouldShowControlsForActor(actor) {
  if (!actor.isHuman) return false;
  if (currentMode === "solo") return actor.id === selfId;
  if (currentMode === "hotseat") return true; // 所有真人共用本机，统一显示
  if (isOnlineMode()) return actor.id === selfId;
  return false;
}

async function showControlsForActor(actor) {
  const ctx = buildActionContextFromGame(actor);
  const hole = ownHoleCards[actor.id] || [];

  // hot-seat：切换玩家前先显示隐私屏
  if (currentMode === "hotseat") {
    const lastShown = controls._lastShownPid;
    if (lastShown !== actor.id) {
      controls.hide();
      await privacy.ask(actor.name);
      controls._lastShownPid = actor.id;
    }
  } else {
    controls._lastShownPid = actor.id;
  }

  const opponents = Math.max(1, game.inHandPlayers().length - 1);
  controls.show(ctx, hole, {
    community: game.community.slice(),
    opponents,
    stage: game.stage,
  });
}

function buildActionContextFromGame(p) {
  const toCall = game.currentBet - p.currentBet;
  const minRaise = Math.max(game.currentBet + game.lastRaise, game.currentBet + game.bigBlind);
  const maxRaise = p.stack + p.currentBet;
  const legalActions = ["fold"];
  if (toCall === 0) legalActions.push("check");
  if (toCall > 0 && p.stack > 0) legalActions.push("call");
  if (p.stack > toCall) legalActions.push("raise");
  if (p.stack > 0) legalActions.push("allin");
  return {
    toCall, minRaise, maxRaise,
    currentBet: game.currentBet,
    pot: game.pot,
    bigBlind: game.bigBlind,
    playerCurrentBet: p.currentBet,
    legalActions,
  };
}

function renderMirror() {
  // 客户端镜像
  if (!latestSnapshot || !tableView) return;
  latestSnapshot.ownHoleCards = ownHoleCards[selfId] || null;
  latestSnapshot.revealedHoles = revealedHoles;
  latestSnapshot.actionBubbles = lastActionBubbles;
  tableView.render(latestSnapshot, selfId);
  applyActionDeadlineToTable();

  // 如果轮到自己 → 显示操作条
  const actIdx = latestSnapshot.actionIndex;
  const actor = actIdx >= 0 ? latestSnapshot.players[actIdx] : null;
  if (!actor || actor.id !== selfId || latestSnapshot.stage === STAGE.HAND_OVER || latestSnapshot.stage === STAGE.SHOWDOWN) {
    controls?.hide();
    return;
  }
  const p = actor;
  const toCall = latestSnapshot.currentBet - p.currentBet;
  const minRaise = Math.max(latestSnapshot.currentBet + latestSnapshot.lastRaise, latestSnapshot.currentBet + latestSnapshot.bigBlind);
  const maxRaise = p.stack + p.currentBet;
  const legalActions = ["fold"];
  if (toCall === 0) legalActions.push("check");
  if (toCall > 0 && p.stack > 0) legalActions.push("call");
  if (p.stack > toCall) legalActions.push("raise");
  if (p.stack > 0) legalActions.push("allin");
  const opponents = Math.max(1, latestSnapshot.players.filter((x) => !x.folded && !x.sittingOut).length - 1);
  controls.show({
    toCall, minRaise, maxRaise,
    currentBet: latestSnapshot.currentBet,
    pot: latestSnapshot.pot,
    bigBlind: latestSnapshot.bigBlind,
    playerCurrentBet: p.currentBet,
    legalActions,
  }, ownHoleCards[selfId] || [], {
    community: (latestSnapshot.community || []).slice(),
    opponents,
    stage: latestSnapshot.stage,
  });
}

function currentPerspectiveId() {
  // hot-seat: 当前行动玩家视角；否则固定为 selfId
  if (currentMode === "hotseat" && game) {
    const idx = game.actionIndex;
    if (idx >= 0) {
      const actor = game.players[idx];
      if (actor?.isHuman) return actor.id;
    }
  }
  return selfId;
}

// ── AI 调度 ──

function scheduleAIIfNeeded() {
  if (!game || !isHost) return;
  if (aiScheduleTimer) return;
  const idx = game.actionIndex;
  if (idx < 0) return;
  const actor = game.players[idx];
  if (!actor || actor.isHuman) return;
  if (game.stage === STAGE.HAND_OVER || game.stage === STAGE.SHOWDOWN || game.stage === STAGE.GAME_OVER) return;

  const delay = 900 + Math.random() * 600;
  aiScheduleTimer = setTimeout(async () => {
    aiScheduleTimer = null;
    if (!game) return;
    const curIdx = game.actionIndex;
    if (curIdx < 0) return;
    const curActor = game.players[curIdx];
    if (!curActor || curActor.isHuman) return;

    const ctx = buildActionContextFromGame(curActor);
    let action;
    try {
      // decide() 现在是 async（蒙特卡洛胜率走 Web Worker）
      action = await decide(game, curActor, ctx);
    } catch (e) {
      console.warn("[ai] decide failed, falling back:", e);
      action = ctx.legalActions.includes("check") ? { type: "check" } : { type: "fold" };
    }

    // 异步等待期间游戏可能已结束 / 切换玩家 — 兜底校验
    if (!game || game.actionIndex !== curIdx || game.players[curIdx]?.id !== curActor.id) return;

    const emoji = decideEmoji(action, 0.5);
    if (emoji) {
      tableView?.floatEmojiOver(curActor.id, emoji);
      if (channel) channel.send({ type: "emoji", sender: curActor.name, playerId: curActor.id, emoji });
    }
    const result = game.applyAction(curActor.id, action);
    if (result?.error) {
      // 退化为 check / fold
      const fallback = ctx.legalActions.includes("check") ? { type: "check" } : { type: "fold" };
      game.applyAction(curActor.id, fallback);
    }
    pumpEvents();
  }, delay);
}

// ── 结算 ──

function showHandResult() {
  if (!pendingHandResult) return;

  const modal = root.getElementById("handResult");
  const body = root.getElementById("handResultBody");
  const title = root.getElementById("handResultTitle");
  body.replaceChildren();

  const reason = pendingHandResult.reason;
  title.textContent = reason === "uncontested" ? "对手弃牌，本手结束" : "摊牌结算";

  const allPlayers = game?.players || latestSnapshot?.players || [];
  const winners = pendingHandResult.winners || [];
  const winnerMap = new Map();
  for (const w of winners) {
    // 合并同一个玩家多个池的赢额
    const prev = winnerMap.get(w.id) || { amount: 0, rank: null, cards: null };
    prev.amount += w.amount || 0;
    if (!prev.rank && w.rank) prev.rank = w.rank;
    if (!prev.cards && w.cards) prev.cards = w.cards;
    winnerMap.set(w.id, prev);
  }

  const showdownHands = pendingHandResult.showdownHands || [];
  const handMap = new Map();
  for (const h of showdownHands) handMap.set(h.id, h);

  // 公共牌展示（摊牌场景）
  if (lastCommunityCards.length > 0 && reason !== "uncontested") {
    const boardWrap = document.createElement("div");
    boardWrap.className = "result-board";
    const boardLabel = document.createElement("span");
    boardLabel.className = "result-board-label";
    boardLabel.textContent = "公共牌";
    boardWrap.appendChild(boardLabel);
    const boardCards = document.createElement("div");
    boardCards.className = "result-board-cards";
    for (const c of lastCommunityCards) boardCards.appendChild(renderCardEl(c));
    boardWrap.appendChild(boardCards);
    body.appendChild(boardWrap);
  }

  // 为每位参与玩家（未离桌）渲染一行
  const playersToShow = allPlayers.filter((p) => !p.sittingOut);
  // 按：赢家优先、弃牌者靠后排序
  playersToShow.sort((a, b) => {
    const aWin = winnerMap.has(a.id) ? 1 : 0;
    const bWin = winnerMap.has(b.id) ? 1 : 0;
    if (aWin !== bWin) return bWin - aWin;
    const aFold = a.folded ? 1 : 0;
    const bFold = b.folded ? 1 : 0;
    return aFold - bFold;
  });

  for (const p of playersToShow) {
    const startStack = handStartStacks[p.id] ?? p.stack;
    const delta = p.stack - startStack;
    const win = winnerMap.get(p.id);
    const hand = handMap.get(p.id);
    const isWinner = !!win;

    const row = document.createElement("div");
    row.className = "result-row" + (isWinner ? " winner" : "") + (p.folded ? " folded" : "");

    // 玩家信息列
    const info = document.createElement("div");
    info.className = "result-info";

    const nameDiv = document.createElement("div");
    nameDiv.className = "result-name";
    nameDiv.textContent = p.name;
    info.appendChild(nameDiv);

    const rankDiv = document.createElement("div");
    rankDiv.className = "result-rank";
    if (p.folded) rankDiv.textContent = "弃牌";
    else if (hand?.name) rankDiv.textContent = hand.name;
    else if (win?.rank) rankDiv.textContent = win.rank;
    else rankDiv.textContent = "—";
    info.appendChild(rankDiv);

    const deltaDiv = document.createElement("div");
    deltaDiv.className = "result-delta " + (delta > 0 ? "gain" : delta < 0 ? "loss" : "flat");
    if (delta > 0) deltaDiv.textContent = "+" + delta.toLocaleString();
    else if (delta < 0) deltaDiv.textContent = delta.toLocaleString(); // already has minus
    else deltaDiv.textContent = "±0";
    info.appendChild(deltaDiv);

    row.appendChild(info);

    // 手牌列：底牌 + 最佳 5 张（摊牌场景下显示；仅显示底牌时不高亮）
    const cardsWrap = document.createElement("div");
    cardsWrap.className = "result-cards-wrap";

    // 底牌
    const holeCards = p.folded
      ? (hand?.holeCards || handStartHoles[p.id])
      : (hand?.holeCards || revealedHoles[p.id] || ownHoleCards[p.id] || handStartHoles[p.id] || []);

    const bestSet = new Set((hand?.cards || win?.cards || []));

    const holeGroup = document.createElement("div");
    holeGroup.className = "result-holes";
    if (holeCards && holeCards.length > 0) {
      for (const c of holeCards) {
        holeGroup.appendChild(renderCardEl(c, { highlight: bestSet.has(c) }));
      }
    } else {
      // 未知底牌（比如房主对客户端只传了 totalBet）
      for (let i = 0; i < 2; i++) holeGroup.appendChild(renderCardEl(null, { back: true }));
    }
    cardsWrap.appendChild(holeGroup);

    // 最佳 5 张（仅摊牌时显示；未摊牌者只显示底牌）
    if (hand?.cards && !p.folded) {
      const sep = document.createElement("span");
      sep.className = "result-sep";
      sep.textContent = "→";
      cardsWrap.appendChild(sep);

      const bestGroup = document.createElement("div");
      bestGroup.className = "result-best";
      for (const c of hand.cards) bestGroup.appendChild(renderCardEl(c, { highlight: true }));
      cardsWrap.appendChild(bestGroup);
    }

    row.appendChild(cardsWrap);
    body.appendChild(row);
  }

  modal.style.display = "flex";

  // 自动聚焦「下一手」按钮（本地/房主）
  if (isHost && game) {
    setTimeout(() => {
      const btn = root.getElementById("nextHandBtn");
      if (btn) btn.focus();
    }, 100);
  }

  // 写入历史记录
  persistHandHistory(playersToShow, winnerMap, handMap);

  // 记录终生战绩 + 里程碑
  persistLifetimeStats(playersToShow, winnerMap, handMap);

  // 注意：此处不清 pendingHandResult，留给下一次 hand_start 清理
}

function persistLifetimeStats(playersToShow, winnerMap, handMap) {
  // 仅记录真人（单机视角下 selfId；hot-seat 时全员记录）
  const targetIds = currentMode === "hotseat" ? humanPlayerIds : [selfId];
  const totalPot = Object.values(winnerMap).reduce((sum, w) => sum + (w.amount || 0), 0)
    || (pendingHandResult?.winners || []).reduce((sum, w) => sum + (w.amount || 0), 0);
  for (const pid of targetIds) {
    const p = playersToShow.find((x) => x.id === pid);
    if (!p) continue;
    const startStack = handStartStacks[pid] ?? p.stack;
    const delta = p.stack - startStack;
    const hand = handMap.get(pid);
    const won = winnerMap.has(pid);
    const unlocks = recordHand({
      selfDelta: delta,
      selfBestHand: hand,
      pot: totalPot,
      won,
    });
    for (const m of unlocks) {
      showMilestoneToast(m);
      sfx?.win();
    }
  }
}

function persistHandHistory(playersToShow, winnerMap, handMap) {
  if (!history) return;
  const handNumber = game?.handNumber || latestSnapshot?.handNumber || 0;
  const entry = {
    time: Date.now(),
    handNumber,
    community: lastCommunityCards.slice(),
    reason: pendingHandResult?.reason || null,
    players: playersToShow.map((p) => {
      const hand = handMap.get(p.id);
      const holes = hand?.holeCards
        || revealedHoles[p.id]
        || ownHoleCards[p.id]
        || handStartHoles[p.id]
        || [];
      const startStack = handStartStacks[p.id] ?? p.stack;
      return {
        id: p.id,
        name: p.name,
        folded: !!p.folded,
        rank: hand?.name || (p.folded ? "弃牌" : null),
        holeCards: holes.slice(),
        delta: p.stack - startStack,
      };
    }),
    winners: (pendingHandResult?.winners || []).map((w) => ({ id: w.id, amount: w.amount, rank: w.rank })),
  };
  history.record(entry);
}

function startNextHand() {
  if (!game) return;
  if (game.stage === STAGE.GAME_OVER) return;
  // 至少 2 位未离桌玩家才继续
  const alive = game.players.filter((p) => p.stack > 0);
  if (alive.length < 2) {
    showGameOver(alive[0]?.id || null);
    return;
  }
  root.getElementById("handResult").style.display = "none";
  game.startHand();
  pumpEvents();
}

function showGameOver(winnerId) {
  const src = game?.players || latestSnapshot?.players || [];
  const winner = src.find((x) => x.id === winnerId);
  const body = root.getElementById("gameOverBody");
  body.textContent = "";

  const summary = document.createElement("div");
  summary.className = "game-over-summary";
  if (winner) {
    summary.textContent = `🏆 ${winner.name} 赢得最终胜利！`;
  } else {
    summary.textContent = "牌局结束";
  }
  body.appendChild(summary);

  // 最终排名
  const ranking = src.slice().sort((a, b) => b.stack - a.stack);
  const list = document.createElement("div");
  list.className = "game-over-ranks";
  ranking.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "rank-row";
    row.textContent = `#${i + 1}  ${p.name}  ${p.stack.toLocaleString()}`;
    list.appendChild(row);
  });
  body.appendChild(list);

  // 奖励金币（最多 100 coin / 人）
  if (winner && humanPlayerIds.includes(winner.id) && window.ArcadeHub) {
    window.ArcadeHub.addCoins(100);
  } else if (window.ArcadeHub) {
    window.ArcadeHub.addCoins(15);
  }

  root.getElementById("gameOver").style.display = "flex";
  root.getElementById("handResult").style.display = "none";
}

// ── 清理 ──

function cleanupGame() {
  if (aiScheduleTimer) { clearTimeout(aiScheduleTimer); aiScheduleTimer = null; }
  clearActionTimeout();
  currentActionDeadline = null;
  _resetPump();
  if (channel) { try { channel.close(); } catch (_) {} }
  channel = null;
  game = null;
  tableView = null;
  controls = null;
  chat = null;
  privacy = null;
  history = null;
  latestSnapshot = null;
  ownHoleCards = {};
  revealedHoles = {};
  waitingPlayers = [];
  pendingHandResult = null;
  root.getElementById("handResult").style.display = "none";
  root.getElementById("gameOver").style.display = "none";
  root.getElementById("actionBar").style.display = "none";
}

// ── 工具 ──

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function playActionSfx(action) {
  if (!sfx) return;
  switch (action) {
    case "fold":  sfx.fold(); break;
    case "check": sfx.check(); break;
    case "call":  sfx.call(); break;
    case "raise": sfx.raise(); break;
    case "allin": sfx.allin(); break;
  }
}

// 断线 / 重连 toast（节流：新 toast 替换旧的）
let _reconnectToastEl = null;
let _reconnectToastTimer = null;
function showReconnectToast(text, { success = false, duration = 2200 } = {}) {
  clearTimeout(_reconnectToastTimer);
  if (_reconnectToastEl) _reconnectToastEl.remove();
  const el = document.createElement("div");
  el.className = "reconnect-toast" + (success ? " success" : " warn");
  el.textContent = text;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  _reconnectToastEl = el;
  _reconnectToastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => { el.remove(); if (_reconnectToastEl === el) _reconnectToastEl = null; }, 300);
  }, duration);
}

// 新一轮下注开始时，只保留「弃牌」胶囊（弃牌状态贯穿整手）
function pruneActionBubbles() {
  const next = {};
  for (const [pid, b] of Object.entries(lastActionBubbles)) {
    if (b.action === "fold") next[pid] = b;
  }
  lastActionBubbles = next;
}

// ── 入口 ──

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
