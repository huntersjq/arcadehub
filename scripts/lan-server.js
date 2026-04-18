// arcadehub LAN 联机服务器
// ─────────────────────────────────────
// 单文件（仅用 Bun 标准库）：
//   1) 静态文件托管（整个仓库根目录）
//   2) WebSocket 中继 `/lan`，德扑联机信令 + 消息转发
//
// 启动：
//   bun scripts/lan-server.js [port]
//
// 协议（客户端 → 服务器）
//   首帧：{type:"init", room, isHost, peerId, name}
//   之后：{to?: peerId|null, payload: <原 channel.js 消息>}
//
// 服务器中继策略
//   房主发送 to=null        → 广播给所有 client
//   房主发送 to=peerId      → 单发给该 client
//   client 发送（to 忽略）  → 统一转给房主
//   服务器在转发时附加 `_from` 字段（发送者 peerId）
//
// 不做任何持久化。进程退出所有房间信息清空。

const port = parseInt(process.argv[2] || "8765", 10);
const ROOT = new URL("../", import.meta.url).pathname;

// room code → { host: ws | null, clients: Map<peerId, ws> }
const rooms = new Map();

// ws → { room, peerId, isHost, name }
const sessions = new WeakMap();

function getOrCreateRoom(code) {
  let r = rooms.get(code);
  if (!r) {
    r = { host: null, clients: new Map() };
    rooms.set(code, r);
  }
  return r;
}

function safeSend(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch (_) {}
}

function removeFromRoom(ws) {
  const s = sessions.get(ws);
  if (!s) return;
  const room = rooms.get(s.room);
  if (!room) return;
  if (s.isHost && room.host === ws) {
    room.host = null;
    // 通知所有客户端房主断开
    for (const cws of room.clients.values()) {
      safeSend(cws, { _from: "server", type: "disconnected" });
      try { cws.close(); } catch (_) {}
    }
    room.clients.clear();
  } else {
    room.clients.delete(s.peerId);
    // 通知房主：这位玩家离开
    if (room.host) {
      safeSend(room.host, { _from: s.peerId, type: "leave", playerId: s.peerId });
    }
  }
  if (!room.host && room.clients.size === 0) rooms.delete(s.room);
  sessions.delete(ws);
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map":  "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function contentTypeFor(pathname) {
  const dot = pathname.lastIndexOf(".");
  if (dot < 0) return "application/octet-stream";
  return CONTENT_TYPES[pathname.slice(dot).toLowerCase()] || "application/octet-stream";
}

const server = Bun.serve({
  port,
  hostname: "0.0.0.0",
  async fetch(req, srv) {
    const url = new URL(req.url);

    // WebSocket 信令中继
    if (url.pathname === "/lan") {
      const ok = srv.upgrade(req);
      if (ok) return;
      return new Response("Upgrade failed", { status: 426 });
    }

    // 静态文件
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";

    // 防目录穿越
    if (path.includes("..")) return new Response("Forbidden", { status: 403 });

    const filePath = ROOT + path.replace(/^\//, "");
    const file = Bun.file(filePath);
    if (!(await file.exists())) return new Response("Not Found", { status: 404 });

    return new Response(file, {
      headers: {
        "Content-Type": contentTypeFor(path),
        "Cache-Control": "no-cache",
      },
    });
  },
  websocket: {
    open(ws) {
      // 等待 init 帧
    },
    message(ws, rawMsg) {
      let msg;
      try { msg = JSON.parse(typeof rawMsg === "string" ? rawMsg : rawMsg.toString()); }
      catch { return; }

      const sess = sessions.get(ws);

      // 首帧：init
      if (!sess) {
        if (msg.type !== "init" || !msg.room || !msg.peerId) {
          safeSend(ws, { _from: "server", type: "error", error: "需要 init 帧" });
          try { ws.close(); } catch (_) {}
          return;
        }
        const room = getOrCreateRoom(msg.room);
        if (msg.isHost) {
          if (room.host) {
            safeSend(ws, { _from: "server", type: "error", error: "该房间已有房主" });
            try { ws.close(); } catch (_) {}
            return;
          }
          room.host = ws;
        } else {
          if (room.clients.has(msg.peerId)) {
            safeSend(ws, { _from: "server", type: "error", error: "peerId 冲突" });
            try { ws.close(); } catch (_) {}
            return;
          }
          room.clients.set(msg.peerId, ws);
        }
        sessions.set(ws, {
          room: msg.room, peerId: msg.peerId,
          isHost: !!msg.isHost, name: msg.name || "",
        });
        safeSend(ws, { _from: "server", type: "init_ok", peerId: msg.peerId });
        // 通知房主有新客户端加入
        if (!msg.isHost && room.host) {
          safeSend(room.host, {
            _from: msg.peerId,
            type: "hello",
            name: msg.name || "访客",
            peerId: msg.peerId,
          });
        }
        return;
      }

      // 后续帧：转发
      const room = rooms.get(sess.room);
      if (!room) return;

      const payload = msg.payload ?? msg;
      const to = msg.to || null;
      const tagged = { ...payload, _from: sess.peerId };

      if (sess.isHost) {
        if (to) {
          const target = room.clients.get(to);
          if (target) safeSend(target, tagged);
        } else {
          for (const cws of room.clients.values()) safeSend(cws, tagged);
        }
      } else {
        if (room.host) safeSend(room.host, tagged);
      }
    },
    close(ws) {
      removeFromRoom(ws);
    },
  },
});

const addrs = [];
try {
  const { networkInterfaces } = await import("node:os");
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) addrs.push(net.address);
    }
  }
} catch (_) {}

console.log(`\narcadehub LAN server · port ${port}`);
console.log(`  local:   http://127.0.0.1:${port}/`);
for (const ip of addrs) console.log(`  LAN:     http://${ip}:${port}/`);
console.log(`  德扑:    http://${addrs[0] || "127.0.0.1"}:${port}/games/texas-holdem/`);
console.log(`  WebSocket 中继: ws://.../lan`);
console.log();
