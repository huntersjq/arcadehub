# 部署指南

arcadehub 德州扑克支持 4 种部署形态。按需组合使用。

## 一览

| 场景 | 前端 | 后端 | 能做的事 |
|---|---|---|---|
| 本地开发 | `bun run lan` | 同一进程内 WS 中继 | 本机 / 局域网全模式 |
| GitHub Pages + PeerJS | Pages | 无（PeerJS 公网信令） | 外网跨设备联机，单人练习、本地多人 |
| GitHub Pages + Cloudflare Workers | Pages | Workers + Durable Objects | 外网联机（WS 中继） |
| 四合一 | Pages | Workers（可选） + PeerJS（默认） | 所有模式都可用 |

## 1. GitHub Pages（托管前端，已配置）

仓库根目录的 `.github/workflows/static.yml` 会在每次 `push` 到 `main` 时自动部署整个仓库到 Pages。

**一次性设置：**

1. 打开仓库 → **Settings** → **Pages**
2. Source 选 **GitHub Actions**
3. 提交推送一次，等 Action 绿灯
4. 访问 `https://<user>.github.io/arcadehub/games/texas-holdem/`

> 根目录的 `.nojekyll` 文件已就位，避免 Jekyll 处理静态资源。

**能直接用的模式（无需其他服务）：**

- 单人练习
- 本地多人（同一台电脑）
- 多窗口联机（同浏览器多标签，BroadcastChannel）
- **跨设备联机**（基于 PeerJS 公网信令，WebRTC P2P）→ 两台外网设备即可对战

**局域网联机 / 公网中继联机** 需要额外的中继服务器，见下一节。

---

## 2. Cloudflare Workers 中继（可选，提供可靠公网联机）

如果你不想依赖 PeerJS 公共信令服务器，或者想要一个稳定的公网 WebSocket 中继，按下列步骤部署。

### 2.1 准备

```bash
# 首次登录 Cloudflare（会打开浏览器授权）
bun x wrangler login
```

### 2.2 部署

```bash
cd scripts
bun x wrangler deploy
```

wrangler 会读 `scripts/wrangler.toml`，部署 `relay-worker.js` 到你的账户，输出类似：

```
Published arcadehub-relay (xxx ms)
  https://arcadehub-relay.<YOUR-SUBDOMAIN>.workers.dev
```

### 2.3 在前端填中继地址

在德州扑克大厅：

1. 点 **LAN / 中继** tab
2. 在「中继地址」输入框填入（注意协议换成 `wss://`，路径加 `/lan`）：

   ```
   wss://arcadehub-relay.YOURNAME.workers.dev/lan
   ```

3. 房主创建房间 → 记下房间码分享给朋友 → 朋友填入同样的中继地址 + 房间码加入

这个地址会被记在 `localStorage.holdem_relay_url`，下次自动回填。

### 2.4 免费额度

Cloudflare Workers 免费层：
- 10 万次请求/天
- 无限 WebSocket 时长（在连接内）
- Durable Objects 免费层 ≈ 1M 请求/月

正常对局的流量完全在免费范围内。

---

## 3. 本地开发（不部署，只本机 + LAN）

```bash
bun run lan
# 或
bun scripts/lan-server.js 8765
```

控制台会打印 LAN 地址：

```
local:   http://127.0.0.1:8765/
LAN:     http://192.168.x.y:8765/
德扑:    http://192.168.x.y:8765/games/texas-holdem/
```

两台同 Wi-Fi 的电脑访问 LAN 地址即可。**中继地址留空**，LanChannel 自动用同源 `/lan`。

---

## 4. 四种模式在不同部署下是否可用

| 模式 \ 部署 | 本机 `bun run lan` | GitHub Pages | Pages + Workers |
|---|---|---|---|
| 单人 / 本地多人 / 多窗口 | ✅ | ✅ | ✅ |
| 跨设备联机（PeerJS） | ✅ | ✅ | ✅ |
| LAN / 中继 · 留空 | ✅（同源 LAN 中继） | ❌（Pages 无 WS 服务） | ❌ |
| LAN / 中继 · 填 Workers URL | ✅ | ✅ | ✅ |

**推荐组合：** Pages 发布前端 + 部署一个 Workers 中继，两个链接都塞给朋友，稳定可用无依赖。

---

## 5. 故障排查

### Pages 静态资源 404
- 确认 Pages source 是 GitHub Actions（不是旧的 Deploy from branch）
- 确认根目录有 `.nojekyll`
- 部署日志里 artifact 是否包含 `games/texas-holdem/`

### Workers 报 `invalid room code`
- URL 必须带 `?room=XXXXXX`，LanChannel 自动追加，不要手填
- 房间码由字母数字组成，最长 12 位

### Workers 连接超时
- 浏览器 DevTools → Network → WS → 看握手响应
- 直接 `curl https://arcadehub-relay.xxx.workers.dev/health` 应返回 `OK`

### PeerJS `connection failed`
- PeerJS 公共信令偶尔抽风，重试或切到 Workers 中继

---

## 6. 断线重连

LAN / 公网中继模式都内置断线重连：

- **客户端**：WS 断开后指数退避重试（0.5 / 1 / 2 / 4 / 8 秒 · 共 5 次）。会以相同 `peerId` + `resume:true` 重新 init。
- **服务器**：掉线后保留会话 30 秒（宽限期）。窗口内重连则完全恢复；过期才视为永久离开。
- **房主补发**：客户端重连后，房主端会自动补发最新的 `state` + 该玩家私密 `hole_cards`，无需手动刷新。
- **UI**：顶部 toast 红色「网络中断，正在重连 (n/5)...」→ 绿色「已恢复连接」。

对 PeerJS 模式（跨设备联机）的重连目前未实现（PeerJS 自身对客户端重连支持有限），建议外网联机优先用 LAN / 公网中继模式。
