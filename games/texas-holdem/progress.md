# 德州扑克（中文版）开发进度

> 分支：`main`
> 最后更新：2026-04-19

## 项目目标

在 Arcade Hub 中实现一套**完整的中文版德州扑克**：

- 支持单人练习、本地多人、同浏览器多标签、跨设备 P2P 四种模式
- 可配置 AI 玩家数量（0–7）与难度（新手 / 普通 / 高手）
- 内建聊天与快捷表情
- 跨设备联机最终形态基于 **WebRTC + PeerJS**

## 整体完成度

```
[█████████████████████████████] ≈ 99%
```

## 模块状态

| 阶段 | 状态 |
|---|---|
| 规划与架构 | ✅ 完成 |
| 引擎层（牌堆 / 牌型 / 底池 / 状态机） | ✅ 完成 |
| AI 层（三档决策） | ✅ 完成 |
| UI 组件（牌桌 / 操作 / 聊天 / 隐私屏 / 历史 / 统计） | ✅ 完成 |
| 网络传输层（BroadcastChannel + PeerJS） | ✅ 完成 |
| 主编排 `main.js`（大厅 + 事件循环 + 网络协议） | ✅ 完成 |
| 结算弹窗渲染（横向展示 + 胜负色 + 最佳 5 张高亮） | ✅ 完成 |
| Hub 注册（`hub/data.js` + 首页卡片 + 扑克图标 + 成就） | ✅ 完成 |
| 视觉特效（飞筹码、彩带、阶段横幅、活跃玩家光环） | ✅ 完成 |
| 扑克牌视觉（左上角标 + 主体大花色 / 脸牌花体字母） | ✅ 完成 |
| 每手结束清空桌面公共牌 | ✅ 完成 |
| 胜率实时分析（蒙特卡洛 + 等级着色进度条） | ✅ 完成 |
| 手牌牌型提示（一对 / 两对 / 同花 / …）实时展示 | ✅ 完成 |
| 动作状态胶囊（跟注 / 加注 / 弃牌 / 全下 悬挂座位顶部） | ✅ 完成 |
| 加注圆形按钮 + 底池预设圆泡（⅓ · ½ · ⅔ · 1× · 1.2×） | ✅ 完成 |
| 历史牌局记录（localStorage + 展开回看弹窗） | ✅ 完成 |
| 声音特效（Web Audio 过程化合成 · 发牌/下注/弃牌/赢家） | ✅ 完成 |
| 终生战绩 + 里程碑（皇家同花顺 / 四条 / 葫芦 / 胜场） | ✅ 完成 |
| 成就接入 hub（6 条 texas-holdem 专属成就） | ✅ 完成 |
| **局域网联机（WebSocket 中继，无需公网）** | ✅ 完成 |
| **GitHub Pages 部署（自动发布前端）** | ✅ 完成 |
| **Cloudflare Workers 公网中继（Durable Objects）** | ✅ 完成 |
| **断线重连（客户端退避 + 服务器 30s 宽限期）** | ✅ 完成 |
| 跨设备联机真机测试（PeerJS 公网） | ⏳ 待验证 |
| **引擎单元测试（vitest · 110 用例 / 5 spec 文件）** | ✅ 完成 |
| **蒙特卡洛 Web Worker（主线程零阻塞）** | ✅ 完成 |
| **眯牌（squint）模式（长按 3D 翻盖）** | ✅ 完成 |
| **行动倒计时圆环 + 15s 自动 fold** | ✅ 完成 |
| **引擎抽成 `@arcadehub/holdem-engine` 包** | ✅ 完成 |
| **WePoker 4-色花色（♠黑 ♥红 ♣绿 ♦蓝）+ 牌色 toggle** | ✅ 完成 |
| **3 套主题（经典绿 / 午夜蓝 / 黑金）+ 设置弹窗** | ✅ 完成 |
| **阶段切换 1.2s 喘息（Round Queue）** | ✅ 完成 |
| **Pre-action（过/弃 · 跟到底）** | ✅ 完成 |

## 已完成模块明细

### 目录结构

```
games/texas-holdem/
├── index.html          # 中文 UI 骨架（大厅/等待房/牌桌/结算/历史）
├── style.css           # 牌桌、扑克牌、动画、响应式
├── progress.md         # 本文档
├── main.js             # 主编排：大厅 / 事件循环 / 网络协议 / AI 调度
├── engine/
│   ├── deck.js         # 牌堆 + 可复现洗牌
│   ├── hand.js         # 7 选 5 牌型判定
│   ├── pot.js          # 底池 + 边池计算
│   └── game.js         # 完整状态机
├── ai/
│   └── bot.js          # 三档 AI 决策 + 蒙特卡洛胜率（已对外导出）
├── ui/
│   ├── table.js        # 座位环绕 + 牌渲染 + 特效（彩带/飞筹码/横幅/胶囊）
│   ├── controls.js     # 圆形按钮 + 滑块 + 实时胜率 + 牌型提示
│   ├── chat.js         # 聊天 + 表情
│   ├── privacy.js      # 本地多人隐私屏
│   ├── history.js      # 历史牌局记录（双 tab：历史 · 统计）
│   ├── stats.js        # 终生战绩 + 里程碑追踪 + toast
│   └── sfx.js          # Web Audio 过程化合成音效
└── net/
    └── channel.js      # 统一传输层（LocalChannel / PeerChannel / LanChannel）

scripts/
└── lan-server.js       # Bun 单文件：静态托管 + WebSocket 中继
```

### 视觉与交互

**牌桌与牌面**

- 椭圆座位环绕，本地视角永远居底
- 活跃玩家金色脉冲光环 + 扩散动画
- 翻牌/转牌/河牌 大字横幅切换
- 公共牌 deal-in 动画（带 stagger）
- 结束当手后桌面自动清空

**扑克牌（已多次迭代到 WePoker 风格）**

- 左上角：点数（大）+ 花色（小）
- 主体下半部：
  - 数字牌 → 大花色符号
  - J/Q/K/A → 花体斜体字母（Playfair Display）+ 金色边框
- A 牌金边更醒目
- 红心/方块红色，黑桃/梅花黑色

**动作与筹码**

- 每次下注：筹码从玩家座位飞向底池（CSS 关键帧）
- 飘字提示：弃牌 / 过牌 / 跟注 / 加注 / 全下（颜色区分）
- 赢家座位彩带爆炸（多色五彩纸屑）
- 底池数字滚动计数动画

**结算弹窗**

- 公共牌条（顶部）
- 每位玩家一行：名字 · 牌型 · 盈亏（+红 / -绿）· 底牌 → 最佳 5 张
- 最佳 5 张金框高亮
- 赢家行金色描边高亮
- 弃牌行灰度

**多语言界面**

- 简体中文全局
- 大厅 4 个模式 Tab（单人 / 本地多人 / 多窗口联机 / 跨设备联机）

### 引擎与 AI

- `Game` 状态机：盲注、四条街、边池、摊牌、破产离桌
- 事件总线驱动外层 UI 与网络（单一数据源）
- `snapshot()` 用于客户端镜像
- AI 三档：
  - 🟢 新手：40 次蒙特卡洛，少诈唬
  - 🟡 普通：120 次，考虑底池赔率与位置
  - 🔴 高手：300 次 + 主动诈唬 + 激进加注
- AI 调度 0.9–1.5s 拟人延迟 + 表情反馈

### 网络

- `LocalChannel`（BroadcastChannel，同浏览器多标签）
- `PeerChannel`（PeerJS WebRTC，房主固定 `holdem-<ROOM>`）
- 房主权威 + 客户端镜像；底牌点对点私发

### Hub 集成

- `hub/data.js` 注册 `texas-holdem`（puzzle 分类，金色 `#f5c518`）
- `hub/icons.js` 新增扇形扑克牌图标
- `hub-integration.js` slug 映射
- Service Worker 缓存 v5，含所有模块

## 局域网联机（LAN 模式）使用

完全不依赖 PeerJS 公网信令，走本地 WebSocket 中继。适合两台同 Wi-Fi 电脑对战。

**启动：**
```bash
bun scripts/lan-server.js 8765
# 或： pnpm run lan / npm run lan
```

服务器会同时：
- 托管整个仓库静态文件（替代 `python3 -m http.server`）
- 在 `/lan` 开放 WebSocket 中继

启动后控制台会打印 LAN 地址，例如：
```
LAN: http://192.168.1.9:8765/
德扑: http://192.168.1.9:8765/games/texas-holdem/
```

**对战流程：**
1. 两台电脑连同一 Wi-Fi，浏览器都打开 `http://<LAN-IP>:8765/games/texas-holdem/`
2. 电脑 A：「**局域网联机**」tab → 房间码留空 → 开始游戏 → 记下 6 位房间码
3. 电脑 B：「**局域网联机**」tab → 填房间码 → 开始游戏 → 等待房出现两人
4. A 点「开始游戏」→ 牌局开始

**服务端设计：**
- 房主权威模型：房主跑完整的 `Game` 状态机，客户端只发 `action/chat/emoji`
- 服务器纯中继：收到客户端包 → 打上 `_from` 路由到房主；房主包 → 按 `to` 分发
- 私密底牌：`{to:peerId, payload:{type:"hole_cards"}}`，服务器只单发给目标

## 近期迭代（2026-04-18 本次落地）

### 交互与视觉
- ✨ **实时胜率分析**：翻前用启发式快路径，翻牌后用蒙特卡洛（flop 180 次 / turn 240 / river 300），进度条按 tier 着色（red/orange/green/gold）。
- ✨ **牌型提示**：底牌 + 公共牌 → `bestOfSeven` 计算当前最佳牌型（一对 / 两对 / 顺子 / 同花 / 葫芦 / 四条 / 同花顺 / 皇家同花顺），显示在操作条顶部。
- ✨ **动作状态胶囊**：每次行动后在对应座位上方悬挂彩色胶囊（弃牌红 / 过牌紫 / 跟注绿 / 加注蓝 / 全下金），下一轮清除（弃牌胶囊贯穿整手）。
- ✨ **圆形操作按钮**：WePoker 风格径向渐变 + 金属质感 + hover 浮起。加注按钮放大居中（96×96 vs 其余 74×74）。
- ✨ **底池预设圆泡**：最小 / ⅓ / ½ / ⅔ / 1× / 1.2× / 全下。

### 数据与音效
- ✨ **历史牌局记录**：每手结束写入 `localStorage["holdem_history"]`（最多 50 条），顶部 📜 按钮打开弹窗；可点击单条展开查看每家牌型 + 底牌 + 盈亏；带清空按钮。
- ✨ **终生战绩 + 里程碑**：`holdem_stats` 持久化总手数、胜场、胜率、最大底池、最大盈利、最佳牌型。里程碑（皇家同花顺 / 同花顺 / 四条 / 葫芦 / 胜 10-50-100 手 / 5k-20k 底池）首次达成即弹 toast 祝贺。
- ✨ **Hub 成就接入**：向 `hub/achievements.js` 新增 6 条 texas-holdem 专属成就（All In / Card Shark / Poker Pro / Full House / Four of a Kind / Royal Flush），读取 `holdem_stats` 解锁。
- ✨ **Web Audio 音效**：过程化合成的发牌 / 过牌 / 跟注 / 加注 / 全下 / 弃牌 / 翻牌 / 赢家 音效，零外部资源，可一键静音（状态持久化）。

## 2026-04-19 优化迭代（来自 wp.apk 拆解后的 5-PR 收割）

> 完整方案见 `OPTIMIZATION_PLAN.md`（370 行）

| PR | 主题 | 改动 | 验证 |
|---|---|---|---|
| #1 | `test(holdem): vitest + 73 engine specs` | hand/pot/deck/game 4 个 spec；修了 `eval5` 二对漏 cards 字段的隐藏 bug | 73 用例 309ms |
| #2 | `perf(holdem): monte-carlo equity in web worker` | `equity-core.js` 纯函数 + `equity.worker.js` module worker + `equity-client.js` 异步 API；`bot.decide()` 异步化；UI 实时胜率走 worker | Worker 自检：6.7ms 跑 200 次 |
| #3 | `feat(holdem): squint card peek (long-press 3D flip)` | `ui/squint.js` 偏好；`renderCardEl(_, {squintCover:true})` 加背面遮罩 + 长按翻起；顶栏 👁️/🙈 toggle | matrix3d 转换确认；视觉验过 |
| #4 | `feat(holdem): action countdown ring + 15s auto-fold` | 引擎事件加 `deadline`；TableView SVG 圆环 + rAF；主机端超时 auto check/fold；颜色档绿→黄→红 | 烟雾测：超时玩家被 auto-fold |
| #5 | `refactor(holdem): publish engine as @arcadehub/holdem-engine` | `engine/package.json` v0.1.0 + `index.js` 公共 API + README + 26 条出口测试；引擎已可被外部 import | 110 用例 232ms |

**5 个 PR 后**：5 个 spec 文件 / **110 单元测试** / 232 ms / 0 console error / 全部 commit 落在 main。

---

## 尚未完成 / 下一步规划

### 🎯 中期（下周）

1. **跨设备联机真机测试**（PeerJS 信令稳定性）
2. **锦标赛模式完善**（递增盲注表 / 破产离桌 / 冠军特效）
3. **Round Queue + 阶段间 1.2s 延迟**（OPTIMIZATION_PLAN P1 #5）
4. **Pre-action**：「过到底 / 弃到底 / 跟到底」（P1 #6）
5. **Run-It-Twice**（全押后跑两次）（P1 #7）

### 🎯 后续

6. **多牌桌主题**（经典绿 / 午夜蓝 / 黑金）
7. **完整动画回放器**（用历史 eventBus 复现整手）
8. **i18n 框架 + 英文**
9. **JSDoc 类型注解 → 引擎模块**
10. **稀有牌型 Jackpot 累积奖**

## 设计决策记录

- **房主权威模型**：客户端只发 `action / chat / emoji`，所有状态由房主推导后广播。保证一致性，避免伪造。
- **底牌点对点**：不在 `state` 中广播 `holeCards`，改为 `hole_cards` 消息单独发给目标 peer。
- **事件队列 + drain**：`Game` 不直接触碰 DOM，只 push 事件；外层 `pumpEvents()` 消费。方便测试与联机同步。
- **蒙特卡洛胜率**：比查表更灵活，支持任意多对手，iterations 按难度分级。
- **确定性洗牌**：`mulberry32(seed)` 可复现，方便联机双方同步（当前未启用，保留扩展位）。
- **扑克牌视觉**：左上角标 + 下半部大元素，避免与角标重叠（迭代 3 次后确定）。
- **结算色系**：遵循中国股市惯例 —— 红涨绿跌（赢家 +红 / 输家 -绿）。

## 文件行数

| 类型 | 行数 |
|---|---|
| JavaScript（游戏 · 含新增 ai/equity-* + ui/squint） | ~4060 |
| 单元测试（vitest · engine/__tests__ + ai/__tests__） | ~720 |
| LAN 服务器 | ~215 |
| CSS（含 squint 3D + 倒计时圆环） | ~1700 |
| HTML | ~310 |
| **合计** | **~7005** |

## 提交历史

- `bfe4f9d` feat(texas-holdem): complete main.js orchestrator and hub integration
- `c4418dd` feat(texas-holdem): UI polish, settlement redesign, WePoker-style cards
- （2026-04-18 第 1 轮：圆形按钮 / 动作胶囊 / 实时胜率 / 牌型提示 / 历史记录）
- （2026-04-18 第 2 轮：音效 / 终生战绩 + 里程碑 / hub 成就接入 / 战绩统计 tab）
- （2026-04-18 第 3 轮：LAN 联机模式，Bun WebSocket 中继服务器 + `LanChannel` + 新 tab，修复客户端 `onHumanAction` 早退 bug）
- （2026-04-18 第 4 轮：GitHub Pages 前端自动部署 + Cloudflare Workers Durable Objects 公网中继；`LanChannel` 支持自定义中继地址；`DEPLOY.md` 部署指南）
- （2026-04-18 第 5 轮：断线重连。客户端指数退避 500ms/1s/2s/4s/8s 五次重试；服务器保留会话 30s 宽限期；`resume:true` init 帧恢复；`peer_resumed`/`host_resumed` 事件；房主自动补发状态 + 底牌；红/绿 toast 提示）
- `45ae1d4` docs(texas-holdem): optimization plan grounded in wp.apk reverse-engineering
- `5ecd752` test(texas-holdem): add vitest + 73 engine specs (PR #1)
- `e1730c8` perf(texas-holdem): monte-carlo equity in web worker (PR #2)
- `e129ce8` feat(texas-holdem): squint card peek (PR #3)
- `4f25771` feat(texas-holdem): action countdown ring + 15s auto-fold (PR #4)
- `41f8887` refactor(texas-holdem): publish engine as @arcadehub/holdem-engine (PR #5)

---

> _本文档会在后续里程碑后持续更新。_
