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

const GRACE_MS = 30_000;

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.hostPeerId = null;
    // peerId → { ws: WS | null, isHost, name, offlineAt: number | null }
    this.peers = new Map();
    this.sessions = new WeakMap(); // ws → { peerId }
  }

  _sweep() {
    const now = Date.now();
    for (const [pid, p] of this.peers) {
      if (p.ws === null && p.offlineAt != null && now - p.offlineAt > GRACE_MS) {
        const wasHost = pid === this.hostPeerId;
        this.peers.delete(pid);
        if (wasHost) {
          this.hostPeerId = null;
          for (const [, other] of this.peers) {
            if (other.ws) this._send(other.ws, { _from: "server", type: "disconnected" });
            try { other.ws && other.ws.close(); } catch (_) {}
          }
          this.peers.clear();
        } else {
          const host = this.hostPeerId && this.peers.get(this.hostPeerId);
          if (host?.ws) this._send(host.ws, { _from: pid, type: "leave", playerId: pid });
        }
      }
    }
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
    try { ws && ws.send(JSON.stringify(obj)); } catch (_) {}
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
      this._sweep();

      const existing = this.peers.get(msg.peerId);
      const wantResume = !!msg.resume && existing && existing.ws === null;

      if (wantResume) {
        existing.ws = ws;
        existing.offlineAt = null;
        if (typeof msg.name === "string" && msg.name) existing.name = msg.name;
        this.sessions.set(ws, { peerId: msg.peerId });
        this._send(ws, { _from: "server", type: "init_ok", peerId: msg.peerId, resumed: true });
        if (!existing.isHost) {
          const host = this.hostPeerId && this.peers.get(this.hostPeerId);
          if (host?.ws) this._send(host.ws, { _from: msg.peerId, type: "peer_resumed", peerId: msg.peerId });
        } else {
          for (const [pid, p] of this.peers) {
            if (pid !== msg.peerId && p.ws) {
              this._send(p.ws, { _from: "server", type: "host_resumed" });
            }
          }
        }
        return;
      }

      if (msg.isHost) {
        if (this.hostPeerId && this.peers.has(this.hostPeerId)) {
          const curHost = this.peers.get(this.hostPeerId);
          if (curHost.ws) {
            this._send(ws, { _from: "server", type: "error", error: "该房间已有房主" });
            try { ws.close(); } catch (_) {}
            return;
          }
        }
        this.hostPeerId = msg.peerId;
      } else if (existing && existing.ws) {
        this._send(ws, { _from: "server", type: "error", error: "peerId 冲突" });
        try { ws.close(); } catch (_) {}
        return;
      }
      this.peers.set(msg.peerId, {
        ws, isHost: !!msg.isHost, name: msg.name || "", offlineAt: null,
      });
      this.sessions.set(ws, { peerId: msg.peerId });
      this._send(ws, { _from: "server", type: "init_ok", peerId: msg.peerId });
      if (!msg.isHost && this.hostPeerId) {
        const host = this.peers.get(this.hostPeerId);
        if (host?.ws) {
          this._send(host.ws, {
            _from: msg.peerId,
            type: "hello",
            name: msg.name || "访客",
            peerId: msg.peerId,
          });
        }
      }
      return;
    }

    this._sweep();
    const selfPeer = this.peers.get(sess.peerId);
    if (!selfPeer) return;

    const payload = msg.payload ?? msg;
    const to = msg.to || null;
    const tagged = { ...payload, _from: sess.peerId };
    if (selfPeer.isHost) {
      if (to) {
        const target = this.peers.get(to);
        if (target?.ws) this._send(target.ws, tagged);
      } else {
        for (const [pid, p] of this.peers) {
          if (pid !== sess.peerId && p.ws) this._send(p.ws, tagged);
        }
      }
    } else if (this.hostPeerId) {
      const host = this.peers.get(this.hostPeerId);
      if (host?.ws) this._send(host.ws, tagged);
    }
  }

  _onClose(ws) {
    const sess = this.sessions.get(ws);
    if (!sess) return;
    const peer = this.peers.get(sess.peerId);
    if (peer && peer.ws === ws) {
      peer.ws = null;
      peer.offlineAt = Date.now();
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
