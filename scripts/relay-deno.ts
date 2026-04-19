// Deno Deploy WebSocket 中继
// ─────────────────────────────
// 协议与 scripts/lan-server.js / scripts/relay-worker.js 完全一致。
//
// 架构：
//   - Deno Deploy 多 isolate，同房间的连接可能落在不同 isolate
//   - 用 BroadcastChannel(\`holdem:<ROOM>\`) 跨 isolate 转发消息
//   - 每个 WS 连接在本地注册一个监听器，按 target peerId 过滤
//
// 断线重连：
//   - 无服务端状态，客户端 `resume:true` 始终被当作新 join（返回 init_ok 不带 resumed）
//   - 客户端检测到这种情况会主动发 `request_state` 给房主，房主补发状态
//
// 启动（本地调试）：
//   deno run --allow-net scripts/relay-deno.ts
//
// Deno Deploy 部署：
//   deployctl deploy --project=holdem-relay scripts/relay-deno.ts
// 或者把仓库连到 Deno Deploy，选 entry file = scripts/relay-deno.ts

const port = Number(Deno.env.get("PORT") ?? 8787);

// 本 isolate 内的连接：peerId → { ws, room, bc, handler }
interface LocalConn {
  ws: WebSocket;
  room: string;
  peerId: string;
  isHost: boolean;
  bc: BroadcastChannel;
  handler: (ev: MessageEvent) => void;
}
const connsByWs = new WeakMap<WebSocket, LocalConn>();

interface Envelope {
  from: string;         // 发送者 peerId
  to: string | null;    // 目标 peerId，null 表示「给房间内所有人（除自己）」
  targetHost?: boolean; // true 表示「发给房主，不管 peerId 是谁」
  payload: Record<string, unknown>; // 已带 _from 字段
}

function safeSend(ws: WebSocket, obj: unknown) {
  try { ws.send(JSON.stringify(obj)); } catch (_) {}
}

function onInit(ws: WebSocket, msg: Record<string, unknown>) {
  const room = String(msg.room || "").toUpperCase();
  const peerId = String(msg.peerId || "");
  const isHost = !!msg.isHost;
  const name = typeof msg.name === "string" ? msg.name : "";

  if (!room || !peerId) {
    safeSend(ws, { _from: "server", type: "error", error: "需要 init 帧（room + peerId）" });
    try { ws.close(); } catch (_) {}
    return;
  }

  // 每个连接一个独立的 BroadcastChannel 实例，便于 per-peer 过滤
  const bc = new BroadcastChannel("holdem:" + room);
  const handler = (ev: MessageEvent) => {
    const env: Envelope = ev.data;
    // 忽略自己发的
    if (env.from === peerId) return;
    // 定向消息：只发给目标
    if (env.to && env.to !== peerId) return;
    // 房主定向：只有 isHost 的连接处理
    if (env.targetHost && !isHost) return;
    // 广播（to null 且非 targetHost）：发给所有非自己的连接
    safeSend(ws, env.payload);
  };
  bc.addEventListener("message", handler);

  const conn: LocalConn = { ws, room, peerId, isHost, bc, handler };
  connsByWs.set(ws, conn);

  // 回执
  safeSend(ws, { _from: "server", type: "init_ok", peerId });

  // 非房主 → 通过 BC 广播 hello，定向给房主
  if (!isHost) {
    const env: Envelope = {
      from: peerId,
      to: null,
      targetHost: true,
      payload: { _from: peerId, type: "hello", name: name || "访客", peerId },
    };
    bc.postMessage(env);
  }
}

function onMessage(ws: WebSocket, raw: string) {
  const conn = connsByWs.get(ws);
  if (!conn) {
    // 首帧必须是 init
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type !== "init") {
      safeSend(ws, { _from: "server", type: "error", error: "需要 init 帧" });
      try { ws.close(); } catch (_) {}
      return;
    }
    onInit(ws, msg);
    return;
  }

  // 后续帧：转发
  let msg: Record<string, unknown>;
  try { msg = JSON.parse(raw); } catch { return; }

  const payload = (msg.payload ?? msg) as Record<string, unknown>;
  const to = (msg.to as string | null | undefined) || null;
  const tagged = { ...payload, _from: conn.peerId };

  const env: Envelope = conn.isHost
    ? { from: conn.peerId, to, payload: tagged }
    : { from: conn.peerId, to: null, targetHost: true, payload: tagged };

  conn.bc.postMessage(env);
}

function onClose(ws: WebSocket) {
  const conn = connsByWs.get(ws);
  if (!conn) return;
  connsByWs.delete(ws);
  conn.bc.removeEventListener("message", conn.handler);
  conn.bc.close();

  // 通知房主该 peer 离开（非房主）或通知所有客户端房主掉线
  if (conn.isHost) {
    const bc = new BroadcastChannel("holdem:" + conn.room);
    bc.postMessage({
      from: "server",
      to: null,
      payload: { _from: "server", type: "disconnected" },
    } satisfies Envelope);
    bc.close();
  } else {
    const bc = new BroadcastChannel("holdem:" + conn.room);
    bc.postMessage({
      from: conn.peerId,
      to: null,
      targetHost: true,
      payload: { _from: conn.peerId, type: "leave", playerId: conn.peerId },
    } satisfies Envelope);
    bc.close();
  }
}

Deno.serve({ port, hostname: "0.0.0.0" }, (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/" || url.pathname === "/health") {
    return new Response("arcadehub relay (deno): OK\n", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (url.pathname !== "/lan") {
    return new Response("Not Found", { status: 404 });
  }

  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  socket.addEventListener("message", (ev) => {
    if (typeof ev.data === "string") onMessage(socket, ev.data);
  });
  socket.addEventListener("close", () => onClose(socket));
  socket.addEventListener("error", () => onClose(socket));
  return response;
});

console.log(`arcadehub relay (deno) listening on :${port}`);
