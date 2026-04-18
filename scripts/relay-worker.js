// Cloudflare Workers + Durable Objects WebSocket 中继
// ─────────────────────────────────────────────────
// 部署：
//   cd scripts && bun x wrangler deploy
//
// 协议与 scripts/lan-server.js 完全一致：
//   客户端 init 帧：{type:"init", room, isHost, peerId, name}
//   之后：{to?, payload}
//
// 与 LAN 版本的区别：
//   - 路由由 URL 参数 ?room=CODE 决定（将请求定向到同名 Durable Object）
//   - 每个房间 = 一个 Durable Object，进程级状态隔离
//   - Workers 自带 TLS，暴露 wss://

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.host = null;               // WebSocket
    this.clients = new Map();       // peerId → WebSocket
    this.sessions = new WeakMap();  // WebSocket → {peerId, isHost, name}
  }

  async fetch(request) {
    const upgrade = request.headers.get("Upgrade");
    if (upgrade !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this._accept(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  _accept(ws) {
    ws.accept();
    ws.addEventListener("message", (ev) => this._onMessage(ws, ev.data));
    ws.addEventListener("close",   () => this._onClose(ws));
    ws.addEventListener("error",   () => this._onClose(ws));
  }

  _send(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch (_) {}
  }

  _onMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw)); }
    catch { return; }

    const sess = this.sessions.get(ws);

    // 首帧 init
    if (!sess) {
      if (msg.type !== "init" || !msg.peerId) {
        this._send(ws, { _from: "server", type: "error", error: "需要 init 帧" });
        try { ws.close(); } catch (_) {}
        return;
      }
      if (msg.isHost) {
        if (this.host) {
          this._send(ws, { _from: "server", type: "error", error: "该房间已有房主" });
          try { ws.close(); } catch (_) {}
          return;
        }
        this.host = ws;
      } else {
        if (this.clients.has(msg.peerId)) {
          this._send(ws, { _from: "server", type: "error", error: "peerId 冲突" });
          try { ws.close(); } catch (_) {}
          return;
        }
        this.clients.set(msg.peerId, ws);
      }
      this.sessions.set(ws, {
        peerId: msg.peerId,
        isHost: !!msg.isHost,
        name: msg.name || "",
      });
      this._send(ws, { _from: "server", type: "init_ok", peerId: msg.peerId });
      // 通知房主有新客户端
      if (!msg.isHost && this.host) {
        this._send(this.host, {
          _from: msg.peerId,
          type: "hello",
          name: msg.name || "访客",
          peerId: msg.peerId,
        });
      }
      return;
    }

    // 转发
    const payload = msg.payload ?? msg;
    const to = msg.to || null;
    const tagged = { ...payload, _from: sess.peerId };
    if (sess.isHost) {
      if (to) {
        const target = this.clients.get(to);
        if (target) this._send(target, tagged);
      } else {
        for (const cws of this.clients.values()) this._send(cws, tagged);
      }
    } else if (this.host) {
      this._send(this.host, tagged);
    }
  }

  _onClose(ws) {
    const sess = this.sessions.get(ws);
    if (!sess) return;
    if (sess.isHost && this.host === ws) {
      this.host = null;
      for (const cws of this.clients.values()) {
        this._send(cws, { _from: "server", type: "disconnected" });
        try { cws.close(); } catch (_) {}
      }
      this.clients.clear();
    } else {
      this.clients.delete(sess.peerId);
      if (this.host) {
        this._send(this.host, { _from: sess.peerId, type: "leave", playerId: sess.peerId });
      }
    }
    this.sessions.delete(ws);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("arcadehub relay: OK\n", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (url.pathname !== "/lan") {
      return new Response("Not Found", { status: 404 });
    }

    const room = (url.searchParams.get("room") || "").toUpperCase();
    if (!room || !/^[A-Z0-9]{1,12}$/.test(room)) {
      return new Response("invalid room code", { status: 400 });
    }

    const id = env.ROOMS.idFromName(room);
    const stub = env.ROOMS.get(id);
    return stub.fetch(request);
  },
};
