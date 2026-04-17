# 德州扑克（中文版）开发进度

> 分支：`claude/texas-holdem-poker-game-1TvHU`
> 最后更新：2026-04-17

## 项目目标

在 Arcade Hub 中实现一套**完整的中文版德州扑克**：
- 支持单人练习、本地多人、同浏览器多标签、跨设备 P2P 四种模式
- 可配置 AI 玩家数量（0–7）与难度（新手 / 普通 / 高手）
- 内建聊天与快捷表情
- 跨设备联机最终形态基于 **WebRTC + PeerJS**

## 整体完成度

```
[█████████████████████░░░░░] ≈ 80%
```

| 阶段 | 状态 |
|---|---|
| 规划与架构 | ✅ 完成 |
| 引擎层（牌堆 / 牌型 / 底池 / 状态机） | ✅ 完成 |
| AI 层（三档决策） | ✅ 完成 |
| UI 组件（牌桌 / 操作 / 聊天 / 隐私屏） | ✅ 完成 |
| 网络传输层（BroadcastChannel + PeerJS） | ✅ 完成 |
| 主编排 `main.js`（大厅 + 事件循环 + 网络协议） | ⏳ 待落地 |
| 结算弹窗渲染逻辑 | ⏳ 待落地 |
| Hub 注册（`hub/data.js` + 首页卡片） | ⏳ 待落地 |
| 语法校验 + 联调 | ⏳ 待落地 |

## 已完成模块明细

### 目录结构

```
games/texas-holdem/
├── index.html          # 中文 UI 骨架（大厅/等待房/牌桌/结算）
├── style.css           # 牌桌、扑克牌、动画、响应式
├── engine/
│   ├── deck.js         # 牌堆 + 可复现洗牌
│   ├── hand.js         # 7 选 5 牌型判定
│   ├── pot.js          # 底池 + 边池计算
│   └── game.js         # 完整状态机
├── ai/
│   └── bot.js          # 三档 AI 决策
├── ui/
│   ├── table.js        # 座位环绕 + 牌渲染
│   ├── controls.js     # 行动按钮 + 加注滑块
│   ├── chat.js         # 聊天 + 表情
│   └── privacy.js      # 本地多人隐私屏
└── net/
    └── channel.js      # 统一传输层（本地 / P2P）
```

### 引擎（engine/）

- **`deck.js`**：标准 52 张牌、mulberry32 PRNG、种子化洗牌（联机同步用）
- **`hand.js`**：
  - 7 张选 5 张最佳组合（`bestOfSeven`）
  - 完整判定：皇家同花顺 → 高牌（含 A-2-3-4-5 轮子）
  - `compareHands` 可按 rank + 逐位 tie-break
- **`pot.js`**：按玩家 `totalBet` 分层构建主池与边池；`splitPot` 处理平分余数
- **`game.js`**：
  - 盲注（固定 / 锦标赛递增）
  - 四条街下注（翻前/翻牌/转牌/河牌）
  - 全下 / 最小加注 / 非对抗收池 / 摊牌分账
  - 事件总线（`drainEvents`）驱动外层 UI / 网络
  - `snapshot()` 序列化，便于跨 Peer 同步

### AI（ai/bot.js）

- **三档难度**：
  - 🟢 新手：40 次蒙特卡洛，少诈唬
  - 🟡 普通：120 次蒙特卡洛，考虑底池赔率与位置
  - 🔴 高手：300 次蒙特卡洛 + 主动诈唬 + 激进加注
- 翻前使用启发式快路径；翻牌后走蒙特卡洛
- 加注尺度基于 `equity * pot`，偶尔全下
- `decideEmoji()`：根据决策随机触发情绪表情

### UI（ui/）

- **`table.js`**：
  - 椭圆座位环绕，自动以本地玩家为底部视角
  - 动态头像颜色（id 哈希 → HSL）
  - D / SB / BB 徽标、活跃玩家金色脉冲动画
  - 翻牌 "deal-in" 动画、赢家高亮、飘字表情
- **`controls.js`**：弃牌 / 过牌 / 跟注 / 加注（滑块）/ 全下；预设按钮（最小 / ½ / 1× 底池 / 全下）
- **`chat.js`**：消息列表、10 种快捷表情、Enter 发送
- **`privacy.js`**：Hot-Seat 模式下的遮挡屏，Promise 式切换

### 网络（net/channel.js）

两种实现，相同接口：
- **`LocalChannel`**：BroadcastChannel，同浏览器多标签
- **`PeerChannel`**：PeerJS WebRTC P2P，房主固定 peerId = `holdem-<房间码>`

定义的消息协议：
- `hello` / `welcome` / `lobby_update` / `start_game`
- `state` / `events` / `action`
- `chat` / `emoji` / `hole_cards` / `leave`

房主为权威，客户端只发 `action` / `chat` / `emoji`，监听房主广播。

### 样式与 UI

- **`style.css`**：绿色牌桌、金色配色、玻璃态面板、移动端适配
- **`index.html`**：完整中文骨架（大厅 4 个 Tab、等待房、牌桌、结算、游戏结束）

## 尚未完成

### 1. `main.js` 主编排（核心约 500 行）
这是阻断端到端可玩性的关键模块，承担：
- 大厅字段交互与 Tab 切换
- 根据模式实例化 `Game` + 传输层
- 事件循环：消费 `game.drainEvents()` → 更新 UI / 调度 AI / 广播网络
- AI 延迟拟人（0.8–1.5s 思考感）
- 本地多人触发隐私屏
- 联机房主权威逻辑 + 客户端镜像逻辑
- 结算弹窗渲染（DOM 骨架已在 HTML）

### 2. Hub 集成
- 在 `hub/data.js` 的 `gameRegistry` 添加条目
- 首页卡片金色主题，slug `texas-holdem`
- 可选：新增 "card" 分类

### 3. 验证与提交
- `node --check` 所有模块
- 本地至少走通：1 真人 + 3 AI 一整局摊牌
- 最终提交：`feat(texas-holdem): complete Chinese Hold'em`

## 代码量

| 类型 | 行数 |
|---|---|
| JavaScript | ~1500 |
| CSS | ~700 |
| HTML | ~170 |
| **合计** | **~2370** |

## 下一步

继续编写 `main.js` 的大厅 + 事件循环 + 网络协议实现，完成后接入 Hub 并做端到端联调。

---

> _本文档由开发过程自动汇总，后续实现完成后会继续更新。_
