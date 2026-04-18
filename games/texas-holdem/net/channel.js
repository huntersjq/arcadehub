// 联机传输层
// 统一对外暴露：connect(), onMessage(cb), send(msg), close(), getPeerId()
//
// 三种实现：
//   LocalChannel  - 基于 BroadcastChannel（同浏览器多标签）
//   PeerChannel   - 基于 PeerJS（跨设备 WebRTC P2P，需公网）
//   LanChannel    - 基于 WebSocket 中继到本地 LAN 服务器（无需公网）
//
// 协议（房主为权威）
//   {type:'hello', name, peerId}                   客户端→房主：请求加入
//   {type:'welcome', selfId, players, config}      房主→客户端：分配 id + 当前房间信息
//   {type:'lobby_update', players}                 房主→全体：大厅玩家名单变化
//   {type:'start_game', config, seed}              房主→全体：开局
//   {type:'state', state}                          房主→全体：状态同步
//   {type:'events', events}                        房主→全体：事件序列
//   {type:'action', playerId, action}              客户端→房主：玩家决策
//   {type:'chat', sender, text}                    双向：聊天
//   {type:'emoji', sender, playerId, emoji}        双向：飘字表情
//   {type:'hole_cards', cards}                     房主→目标客户端：私密底牌
//   {type:'leave', playerId}                       通知离开

function genRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// 基于 BroadcastChannel 的同浏览器多标签实现
export class LocalChannel {
  constructor({ roomCode, isHost, name }) {
    this.roomCode = roomCode || genRoomCode();
    this.isHost = !!isHost;
    this.name = name;
    this.selfId = "peer_" + Math.random().toString(36).slice(2, 10);
    this.listeners = [];
    this.closed = false;
  }

  async open() {
    this.channel = new BroadcastChannel("holdem_" + this.roomCode);
    this.channel.addEventListener("message", (e) => {
      if (this.closed) return;
      const { to, ...msg } = e.data || {};
      if (to && to !== this.selfId) return;
      for (const cb of this.listeners) cb(msg, msg._from || null);
    });
    return this;
  }

  getRoomCode() { return this.roomCode; }
  getSelfId() { return this.selfId; }

  onMessage(cb) { this.listeners.push(cb); }

  // 发送给所有人（房主广播） / 发送给房主（客户端）
  send(msg, to = null) {
    if (this.closed) return;
    const payload = { ...msg, _from: this.selfId };
    if (to) payload.to = to;
    this.channel.postMessage(payload);
  }

  close() {
    this.closed = true;
    if (this.channel) this.channel.close();
  }
}

// 基于 PeerJS 的 WebRTC P2P 实现
export class PeerChannel {
  constructor({ roomCode, isHost, name }) {
    this.isHost = !!isHost;
    this.name = name;
    this.roomCode = (roomCode || genRoomCode()).toUpperCase();
    this.peerId = null;        // 自己的 peerId
    this.hostPeerId = null;    // 房主 peerId
    this.listeners = [];
    this.connections = new Map(); // 房主侧：peerId -> DataConnection
    this.hostConn = null;         // 客户端侧：到房主的 DataConnection
    this.closed = false;
    this.onPeerConnected = null;
    this.onPeerDisconnected = null;
  }

  async open() {
    if (typeof Peer === "undefined") {
      throw new Error("PeerJS 未加载。请检查网络连接。");
    }
    // 房主使用固定 peerId: holdem-<ROOM>
    const wantId = this.isHost ? ("holdem-" + this.roomCode.toLowerCase()) : undefined;
    this.peer = new Peer(wantId, {
      // PeerJS 公共信令服务器（默认即用）
      debug: 1,
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("连接信令服务器超时")), 10000);
      this.peer.on("open", (id) => {
        clearTimeout(timer);
        this.peerId = id;
        resolve();
      });
      this.peer.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    if (this.isHost) {
      this.hostPeerId = this.peerId;
      this.peer.on("connection", (conn) => this._onIncoming(conn));
    } else {
      this.hostPeerId = "holdem-" + this.roomCode.toLowerCase();
      // 与房主建立连接
      await new Promise((resolve, reject) => {
        const conn = this.peer.connect(this.hostPeerId, { reliable: true });
        const timer = setTimeout(() => reject(new Error("连接房主超时，请检查房间码")), 12000);
        conn.on("open", () => {
          clearTimeout(timer);
          this.hostConn = conn;
          conn.on("data", (data) => this._dispatch(data, this.hostPeerId));
          conn.on("close", () => this._handleClose());
          resolve();
        });
        conn.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    }
  }

  _onIncoming(conn) {
    conn.on("open", () => {
      this.connections.set(conn.peer, conn);
      if (this.onPeerConnected) this.onPeerConnected(conn.peer);
      conn.on("data", (data) => this._dispatch(data, conn.peer));
      conn.on("close", () => {
        this.connections.delete(conn.peer);
        if (this.onPeerDisconnected) this.onPeerDisconnected(conn.peer);
      });
    });
  }

  _dispatch(data, from) {
    if (this.closed) return;
    for (const cb of this.listeners) cb(data, from);
  }

  _handleClose() {
    if (this.closed) return;
    this._dispatch({ type: "disconnected" }, this.hostPeerId);
  }

  getRoomCode() { return this.roomCode; }
  getSelfId() { return this.peerId; }
  getHostId() { return this.hostPeerId; }

  onMessage(cb) { this.listeners.push(cb); }

  // 房主侧：to 为 null 广播，否则发给指定 peerId
  // 客户端侧：忽略 to，统一发给房主
  send(msg, to = null) {
    if (this.closed) return;
    if (this.isHost) {
      if (to) {
        const conn = this.connections.get(to);
        if (conn && conn.open) conn.send(msg);
      } else {
        for (const conn of this.connections.values()) {
          if (conn.open) conn.send(msg);
        }
      }
    } else {
      if (this.hostConn && this.hostConn.open) this.hostConn.send(msg);
    }
  }

  close() {
    this.closed = true;
    for (const conn of this.connections.values()) try { conn.close(); } catch (_) {}
    if (this.hostConn) try { this.hostConn.close(); } catch (_) {}
    if (this.peer) try { this.peer.destroy(); } catch (_) {}
  }
}

// 基于 WebSocket 中继的实现
// 服务器选项：
//   A) 本地 LAN：scripts/lan-server.js（Bun），同源 /lan
//   B) 公网：scripts/relay-worker.js（Cloudflare Workers + Durable Objects）
//      通过构造参数 relayUrl 指定（例如 wss://arcadehub-relay.xxx.workers.dev/lan）
export class LanChannel {
  constructor({ roomCode, isHost, name, relayUrl }) {
    this.isHost = !!isHost;
    this.name = name || "";
    this.roomCode = (roomCode || genRoomCode()).toUpperCase();
    this.selfId = (isHost ? "host_" : "peer_") + Math.random().toString(36).slice(2, 10);
    this.relayUrl = relayUrl || null;
    this.ws = null;
    this.listeners = [];
    this.closed = false;
    this._pendingSend = [];
  }

  _buildUrl() {
    let base;
    if (this.relayUrl) {
      // 把 http(s):// 自动改成 ws(s)://
      base = this.relayUrl.replace(/^http/, "ws");
    } else {
      // 同源回退
      const loc = window.location;
      const scheme = loc.protocol === "https:" ? "wss:" : "ws:";
      base = `${scheme}//${loc.host}/lan`;
    }
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}room=${encodeURIComponent(this.roomCode)}`;
  }

  async open() {
    const url = this._buildUrl();

    await new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(url);
      this.ws = ws;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch (_) {}
        const hint = this.relayUrl
          ? "连接中继服务器超时，请确认中继地址可达。"
          : "连接 LAN 服务器超时（请确认已用 bun scripts/lan-server.js 启动）";
        reject(new Error(hint));
      }, 5000);

      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({
          type: "init",
          room: this.roomCode,
          isHost: this.isHost,
          peerId: this.selfId,
          name: this.name,
        }));
      });

      ws.addEventListener("message", (ev) => {
        let data;
        try { data = JSON.parse(ev.data); } catch { return; }
        if (!settled) {
          if (data.type === "init_ok") {
            settled = true;
            clearTimeout(timer);
            // 发出 pending 消息
            for (const [msg, to] of this._pendingSend) this._rawSend(msg, to);
            this._pendingSend = [];
            resolve();
            return;
          }
          if (data.type === "error") {
            settled = true;
            clearTimeout(timer);
            reject(new Error(data.error || "LAN 服务器拒绝连接"));
            return;
          }
        }
        // 普通转发
        const from = data._from || null;
        const { _from, ...payload } = data;
        for (const cb of this.listeners) cb(payload, from);
      });

      ws.addEventListener("close", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("LAN 服务器连接被关闭"));
          return;
        }
        if (!this.closed) {
          this._dispatch({ type: "disconnected" }, "server");
        }
      });

      ws.addEventListener("error", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("LAN 服务器连接失败（ws://host/lan）"));
        }
      });
    });
  }

  getRoomCode() { return this.roomCode; }
  getSelfId() { return this.selfId; }

  onMessage(cb) { this.listeners.push(cb); }

  _dispatch(msg, from) {
    for (const cb of this.listeners) cb(msg, from);
  }

  _rawSend(msg, to) {
    if (!this.ws || this.ws.readyState !== 1) return;
    const envelope = { to: to || null, payload: msg };
    this.ws.send(JSON.stringify(envelope));
  }

  send(msg, to = null) {
    if (this.closed) return;
    if (!this.ws || this.ws.readyState !== 1) {
      this._pendingSend.push([msg, to]);
      return;
    }
    this._rawSend(msg, to);
  }

  close() {
    this.closed = true;
    try { this.ws && this.ws.close(); } catch (_) {}
  }
}

export { genRoomCode };
