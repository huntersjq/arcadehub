# 德州扑克 H5 — 借鉴 wp.apk 后的优化方案

> 输入资料
> - **wp.apk 拆解报告**：`/Users/justin/Projects/Texas/decrypted/TEXAS_HOLDEM_REPORT.md`（生产级在线赌博 app · 361 个 Texas 模块 · 20 个分类）
> - **H5 当前进度**：`./progress.md`（≈99% 完成 · ~5780 LoC · 4 种联机模式）
>
> 写作日期：2026-04-19

---

## TL;DR

H5 在**核心玩法引擎**和**联机/UI**层已对齐 wp.apk 的水准；差距集中在
**「视觉惊喜 / 工程化 / 跨端复用」**三块。本文给出一份按 ROI 排序的可执行路线图，并明确划出
**不该抄**的边界（反作弊 / KYC / 商业化保险等）。

**最高优先级三件事**（一周内即可拿下）：

1. **眯牌动画（squint）+ 翻牌镜头**——视觉差距最直观的一项
2. **引擎单元测试 + 牌型 fixture 覆盖**——99% 完成度但 0 测试是定时炸弹
3. **蒙特卡洛 Web Worker 化**——胜率计算阻塞主线程是当前最大性能债

---

## 1. 覆盖度对照（H5 vs wp.apk 的 20 个分类）

| wp.apk 分类 | wp.apk 模块数 | H5 现状 | 落差 / 评估 |
|---|---:|---|---|
| 01 牌引擎（Card / Comparator） | 20 | ✅ `engine/hand.js` `engine/deck.js` | H5 用 7 选 5 全枚举 + 轮子 A-2-3-4-5；干净。但 0 测试 |
| 02 牌桌（GameTable / cowboy 主题） | 11 | ✅ `ui/table.js` | H5 椭圆座位 + 横幅 + 光环；视觉好但只有一种皮肤 |
| 03 座位 / HUD | 23 | ✅ 同 `ui/table.js` | 已有 currentBet / stack / 状态胶囊 |
| 04 下注控制 | 5（少而精） | ✅ `ui/controls.js` | **已对齐 wp.apk 圆形按钮 + 1/3·1/2·2/3·1×·1.2×·全下** |
| 05 底池 / 边池 | 几个 | ✅ `engine/pot.js` | 边池构造 + 分账已写；缺动画 |
| 06 状态机 | 2 | ✅ `engine/game.js` | wp.apk 有 `RoundEnum` + `_roundQueue` + `ROUND_DELAY=1200`；H5 同步推进 |
| 07 保险 / Choose-outs | **39（最大！）** | ❌ 不做 | **故意排除**——非标准规则 + 商业化灰色 |
| 08 眯牌（Squint / 眯牌）动画 | 3 | ⚠️ **缺** | 这是亚洲扑克 UX 的标志性动作 |
| 09 结算 | 1 | ✅ `main.js` 渲染弹窗 | 横向展示 + 红绿盈亏 + 最佳 5 张高亮已有 |
| 10 自动行动 / Time-bank | 8 | ⚠️ 仅 AI 有；人类无 | 需要 pre-action（提前选 check / fold / call any） |
| 11 复盘 / 收藏手 | 20 | ⚠️ `ui/history.js` 只列表 | 缺**逐步动画回放** + 收藏标记 |
| 12 大厅入桌 | 21 | ✅ `main.js` 4 tab | 缺锦标赛专用大厅、桌子筛选 |
| 13 反作弊 / 反模拟器 | — | ❌ 不做 | **故意排除**——休闲游戏不需要 |
| 14 桌内聊天 / 表情 | 27 | ✅ `ui/chat.js` | 已实现，量级合适 |
| 15 Jackpot 元玩法 | 15 | ⚠️ 缺 | 可考虑：稀有牌型成就累积奖励 |
| 16 协议 / 网络 | 24 | ✅ `net/channel.js`（JSON）| **故意不上 protobuf**——3 种 channel 已够用 |
| 17 音频 | 4 | ✅ `ui/sfx.js`（Web Audio 合成）| 已对齐 |
| 18 通用 widget | 5 | — | 不必单列 |
| 19 大厅 common | 18 | ✅ 部分 | 锦标赛部分待补 |
| 20 房间 / 玩法配置 | 21 | ⚠️ 仅起手筹码 + 盲注 | 缺：Run-It-Twice、限时模式、Straddle、Ante |
| 21 加载 / i18n | 6 | ⚠️ 中文硬编码 | 需 i18n 框架（zh / en 起步） |

**落差小结**：
- ✅ 8 类已对齐
- ⚠️ 7 类有部分落差，可针对性补
- ❌ 5 类故意排除（边界清晰）

---

## 2. 应该借鉴的 7 项（按价值排序）

### 2.1 眯牌（Squint / 眯牌）动画 — 最高视觉性价比
**wp.apk 出处**：`08_squint_animations` 分类，3 个模块（`Squint*` / `EyePeek` / `FateDetail`）

**做法**：长按底牌 → CSS 3D `transform: rotateY()` 把卡缓慢翻起一个小角度，只露出花色 + 点数；松手回弹。配合 `filter: drop-shadow` 营造立体感。

**落地位置**：`ui/table.js` + `style.css`，约 80 行 CSS + 30 行 JS。

```js
// ui/table.js 新增
function attachSquint(cardEl, cardCode) {
  let pressTimer = null;
  cardEl.addEventListener('pointerdown', () => {
    pressTimer = setTimeout(() => cardEl.classList.add('squint-active'), 120);
  });
  ['pointerup','pointerleave','pointercancel'].forEach(ev =>
    cardEl.addEventListener(ev, () => {
      clearTimeout(pressTimer);
      cardEl.classList.remove('squint-active');
    }));
}
```

```css
/* style.css */
.card { transform-style: preserve-3d; transition: transform 240ms cubic-bezier(.2,.8,.2,1); }
.card.squint-active { transform: perspective(800px) rotateY(-72deg) translateZ(8px); }
```

### 2.2 状态机解耦的「Round Queue + 延迟推进」
**wp.apk 出处**：`GameRoundQueueManage` (`06_phases_state/`)
```
ROUND_DELAY = 1200          // 每个阶段切换间至少 1.2s
_roundQueue = [...]          // 阶段事件入队
checkRound(next) → 决定能否推进
isDoubleRound                // 全押后跑两次
```

**为什么值得抄**：当前 `engine/game.js._advanceStage()` 同步推进，UI 没"喘息"；wp.apk 用队列保证每个阶段切换至少 1.2 秒，避免视觉信息洪流。

**落地位置**：`engine/game.js`（仅添 `eventBus` 上的 `delay` 元数据）+ `main.js` 的 `pumpEvents()`（消费 delay）。

### 2.3 Run-It-Twice (RIT)
**wp.apk 出处**：上面同一模块的 `isDoubleRound` / `cleanDoubleAllinRound`

**玩法**：发生全押后，剩余公共牌**发两次**，底池一半归两次中赢的人。极受欢迎、玩家粘性高。

**落地位置**：`engine/game.js._showdown()` 拆出 `_dealRemainingCommunity(times=1|2)`，在结算前若任一玩家 all-in 且剩余玩家同意，则 times=2 跑两次比 5 张牌。

### 2.4 牌局动画回放（Replay）
**wp.apk 出处**：`11_replay_review` 20 个模块

**当前**：`ui/history.js` 只列表 + 点开看「文字摘要」

**升级**：把每一手的**事件序列**完整存到 localStorage（已有 eventBus，只是没持久化），回放器用 `setTimeout` 链按时间还原动作 / 牌面。300 行内可以做完。

### 2.5 Pre-action（人类玩家的"自动反应"）
**wp.apk 出处**：`10_ai_and_auto/CheckMsgAuto` 等

**做法**：在自己回合**之前**，可勾选：
- 「过牌 / 弃牌」（toCall=0 时过牌、toCall>0 时弃牌）
- 「跟到底」「过到底」「弃到底」（多街生效）

**落地位置**：`ui/controls.js` 加一栏 toggle 按钮 + `main.js` 在 `action_required` 事件触达时优先消费 pre-action。

### 2.6 时间银行 + 行动倒计时
**wp.apk 出处**：`10_ai_and_auto`

**做法**：每位玩家 15s 决策窗口，每手有 3 次额外 "+15s" time-bank 储备。倒计时圆环绕座位走。

**落地位置**：`ui/table.js` 加 `<svg class="seat-timer">` 圆环 + `engine/game.js` `_askAction` 时附 `deadline` 字段。

### 2.7 牌桌皮肤切换 + 多视觉主题
**wp.apk 出处**：`02_game_table` 里 `cowboy` / `cowboy_diamond` 等命名暗示有多套桌布

**做法**：CSS variable 化主题（已用了不少 `--accent`），新增 3 套预设：经典绿 / 午夜蓝 / 黑金。`<select id="theme">` 切换，写入 localStorage。

**落地位置**：`style.css` 抽 `[data-theme="..."]` 选择器；`main.js` 启动读 `localStorage["holdem_theme"]`。

---

## 3. 不该抄的 5 项（边界清晰，避免污染）

| wp.apk 模块 | H5 不抄的原因 |
|---|---|
| 07 保险 / Choose-outs（39 个模块）| 真钱赌博的灰色商业化；非标准 NLHE 规则；与 Arcade Hub 休闲定位冲突 |
| 13 反作弊 / 反模拟器 / VPN block | 客户端反作弊只防小白，且无法在浏览器里实现；不收钱也无激励作弊 |
| KYC / 实名 / OCR (`libJV*Java.so`) | 不收钱不需要 |
| protobuf + UDP + Phoenix native lib | JSON over BroadcastChannel/WebRTC 已经够用，引入 protobuf 增加 60KB+ runtime 但**零收益** |
| 声网 RTC 实时语音（`libagora-rtc-sdk-jni.so`）| 复杂度高、隐私敏感、托管成本；保留聊天 + 表情已经够休闲场景 |

**判断准则**：所有「合规 / 反作弊 / 商业化变现」相关的模块都不抄；只抄「玩法体验 / 视觉 / 工程结构」。

---

## 4. 工程化升级（与功能优化并列）

### 4.1 单元测试（**P0**）

**现状**：~5780 LoC，**0 个测试**。`engine/hand.js` 的 `bestOfSeven` 是包含 `combinations(arr, 5)` 的纯函数，逻辑复杂（轮子 / 同花顺 / 葫芦 / 平分），最容易出错也最容易测。

**建议**：

```bash
# 在仓库根加：
pnpm i -D vitest
```

```ts
// games/texas-holdem/engine/__tests__/hand.spec.js
import { describe, it, expect } from 'vitest';
import { bestOfSeven, compareHands } from '../hand.js';

describe('bestOfSeven', () => {
  it('detects royal flush', () => {
    const r = bestOfSeven(['As','Ks','Qs','Js','Ts','2h','3d']);
    expect(r.rank).toBe(9);
    expect(r.name).toBe('皇家同花顺');
  });
  it('detects wheel straight A-2-3-4-5', () => {
    const r = bestOfSeven(['Ah','2c','3d','4s','5h','Kh','Qh']);
    expect(r.rank).toBe(4);
    expect(r.values[0]).toBe(5);
  });
  it('full house beats flush', () => {
    const fh = bestOfSeven(['As','Ad','Ah','Ks','Kd','2c','3c']);
    const fl = bestOfSeven(['2s','5s','7s','Ts','Js','3h','4d']);
    expect(compareHands(fh, fl)).toBeGreaterThan(0);
  });
  // ... 至少 30 个 fixture，覆盖每个 rank 的边界
});
```

**为什么是 P0**：联机牌局用的就是这套引擎，结算错一次就玩家流失。

### 4.2 蒙特卡洛 Web Worker 化（**P0**）

**现状**：`ai/bot.js#monteCarloEquity` 同步跑 300 次模拟（`hard` 难度），每次 `bestOfSeven` 是 21 选 5 = 21 次 `eval5`。
河牌时一次决策 ≈ 6300 次 hand eval，**主线程会卡 200-400ms**。`ui/controls.js` 也调用同一函数算"实时胜率"——人类回合每次必卡。

**做法**：把 `monteCarloEquity` 整体搬进 `ai/equity.worker.js`，主线程 `postMessage({holeCards, community, opponents, iterations})`，worker 回 `{equity}`。带版本号 token 取消旧请求。

**落地位置**：新文件 `ai/equity.worker.js` + 改 `ai/bot.js` `decide()` 改 `await equityRequest(...)`；`ui/controls.js` 同样改。

### 4.3 引擎抽成独立 ESM（**P1**，与之前 brainstorming 路线对齐）

**目标**：未来 `apps/mobile`（Expo + React Native）能直接 `import { Game } from '@arcadehub/holdem-engine'`。

**步骤**：
1. `engine/` 子目录加 `package.json`：name=`@arcadehub/holdem-engine`，type=module
2. `engine/index.js` 统一导出 `{ Game, STAGE, bestOfSeven, compareHands, buildPots }`
3. 移除 `import "./pot.js"` 这种路径，改用 `import { ... } from './pot.js'` 维持 zero-dep
4. 写 README + 用例
5. 未来打 npm package 即可

### 4.4 TypeScript 化（**P2**，渐进）

**策略**：保持 ESM、不上构建器，先用 `// @ts-check` + JSDoc 给 `engine/` 做类型注解，IDE 立刻有提示，运行时无成本。

```js
/** @typedef {{ id:string, stack:number, holeCards:string[], folded:boolean, allIn:boolean }} Player */
/**
 * @param {string[]} sevenCards 7 张牌（"As", "Kh", ...）
 * @returns {{rank:number, name:string, values:number[], cards:string[]}|null}
 */
export function bestOfSeven(sevenCards) { ... }
```

引擎稳定后再决定要不要引 `tsc --emit` 或保留 JS+JSDoc。

### 4.5 i18n（**P2**）

**现状**：所有中文字符串散落在 `index.html` / 各 JS 里。

**最小可行 i18n**：
```js
// shared/i18n.js
const MESSAGES = {
  zh: { fold: '弃牌', call: '跟注', raise: '加注', allin: '全下', /* ... */ },
  en: { fold: 'Fold', call: 'Call', raise: 'Raise', allin: 'All-in' },
};
export const t = (key) => MESSAGES[currentLang][key] || key;
```
扫一遍把 `"弃牌"` 替换成 `t('fold')`。第一阶段只覆盖**操作 / 状态 / 牌型名**（约 60 个 key）。

---

## 5. 优先级路线图

### 🔥 P0 · 本周（1–3 天就能落地）

| # | 任务 | 估计 LoC | 文件 |
|---|---|---:|---|
| 1 | **Vitest 引入 + `bestOfSeven` 30 条 fixture** | ~150 | `engine/__tests__/hand.spec.js` |
| 2 | **蒙特卡洛 Web Worker 化** | ~100 | `ai/equity.worker.js` + 改 `bot.js` `controls.js` |
| 3 | **眯牌动画（长按 → CSS 3D 翻转）** | ~80 | `ui/table.js` + `style.css` |
| 4 | **行动倒计时圆环（15s 默认）** | ~60 | `ui/table.js` SVG 圆环 + `engine/game.js` `deadline` 字段 |

### ⚙️ P1 · 接下来 1–2 周

| # | 任务 | 估计 LoC | 文件 |
|---|---|---:|---|
| 5 | **Round Queue + 阶段间延迟（1.2s）** | ~80 | `engine/game.js` |
| 6 | **Pre-action（"过到底" / "弃到底"）** | ~120 | `ui/controls.js` + `main.js` |
| 7 | **Run-It-Twice** | ~150 | `engine/game.js._showdown()` |
| 8 | **引擎抽 npm package（`@arcadehub/holdem-engine`）** | ~50（迁移）| `engine/package.json` + `engine/index.js` |
| 9 | **多主题切换（经典绿 / 午夜蓝 / 黑金）** | ~120 CSS | `style.css` + `main.js` |
| 10 | **牌局逐步动画回放** | ~250 | `ui/history.js` 改造为 `replay.js` |

### 🎨 P2 · 下个月内

| # | 任务 | 估计 LoC | 文件 |
|---|---|---:|---|
| 11 | **Time-bank 系统**（3 × 15s 储备） | ~80 | `engine/game.js` + `ui/table.js` |
| 12 | **i18n 框架 + 英文** | ~100 + 60 字典 | `shared/i18n.js` |
| 13 | **JSDoc 类型注解 → 引擎模块** | ~200 | `engine/*.js` |
| 14 | **锦标赛模式完善**（盲注表 / 离桌 / 冠军特效）| ~200 | `engine/game.js` + `ui/table.js` |
| 15 | **稀有牌型 Jackpot 累积奖**（成就联动）| ~150 | `ui/stats.js` + `hub/achievements.js` |

### 🌌 P3 · 长期（按用户反馈再做）

- AI 对手建模（VPIP/PFR/AF 跟踪）+ 「读人」可视化
- 排行榜云端同步（GitHub Pages 配 Cloudflare Workers KV）
- 移动端原生外壳（Expo + 复用 `@arcadehub/holdem-engine`）
- Spectator 模式（旁观直播链接）

---

## 6. 推荐的 5 个第一周 PR

每个 PR 体量小（≤ 300 LoC），可独立评审：

### PR #1 · `chore(holdem): add vitest + bestOfSeven test suite`
- 新增 `engine/__tests__/hand.spec.js`（30 fixture）
- 仓库根 `package.json` 加 `vitest` 依赖
- `pnpm test` 命令

### PR #2 · `perf(holdem): move monte carlo equity to web worker`
- 新增 `ai/equity.worker.js`
- `ai/bot.js` 改 `monteCarloEquity` → `requestEquity()`（async）
- `ui/controls.js` 改实时胜率为异步请求 + 取消令牌

### PR #3 · `feat(holdem): squint card peek animation (long-press)`
- `ui/table.js` 给底牌挂 `attachSquint`
- `style.css` 加 `.card.squint-active` 3D 翻转
- 移动端兼容 touch / pointer events

### PR #4 · `feat(holdem): action countdown timer (15s) with svg ring`
- `ui/table.js` 座位组件加 SVG 圆环倒计时
- `engine/game.js` `_askAction` 附 `deadline = Date.now() + 15000`
- 超时自动 fold / check（含 pre-action 兜底）

### PR #5 · `refactor(holdem): publish engine as @arcadehub/holdem-engine`
- `engine/package.json`（name + type=module + main=index.js）
- 新增 `engine/index.js` 统一导出
- README 写入用例
- 引擎与 UI/AI 路径完全切断耦合（engine 不能 import 上层）

---

## 7. 风险与权衡

| 风险 | 评估 | 对策 |
|---|---|---|
| Web Worker 在 `file://` 协议下不可用 | 真实场景已是 GitHub Pages / LAN HTTP | 文档注明 `python3 -m http.server` 启动方式 |
| 测试引入后 LAN server 启动流程变化 | 不变（vitest 是 dev-only） | `package.json` 仅加 devDep |
| 引擎 npm 化破坏 ESM 相对路径 | 引擎本来就 ESM 内部相对引用 | 仅加 package.json，不改路径 |
| 眯牌 / 倒计时增加首屏 CSS | < 5KB 增量 | 可接受 |
| Run-It-Twice 改动状态机 | 影响联机协议 | 加 `version: 2` 协议字段，老版本退化为单跑 |

---

## 8. 不变的核心准则

1. **零依赖**：保持 `python3 -m http.server` 直接跑得起来；引入 vitest / web worker 不破坏这一点
2. **静态部署**：所有改动必须能在 GitHub Pages 静态托管下工作
3. **数据全部本地**：localStorage 优先；不引入登录、不引入服务端账户
4. **Hub 集成不变**：`hub/data.js` 注册不动，仍是 puzzle 分类金色 `#f5c518`
5. **房主权威协议保持兼容**：协议字段只增不删，加版本号兼容旧客户端

---

## 9. 度量成功

| 指标 | 当前 | P0 目标 | P1 目标 |
|---|---:|---:|---:|
| 引擎单元测试覆盖 | 0% | ≥ 60 行 fixture | ≥ 90% 分支覆盖 |
| 河牌时人类回合主线程阻塞 | 200-400ms | < 16ms（Worker 异步） | 同 |
| 阶段切换视觉节奏 | 即刻 | 1.2s 平滑 | 同 |
| 视觉主题数 | 1 | 1 | 3 |
| i18n 覆盖（操作 / 状态 / 牌型）| 0 | 0 | 中 + 英 |
| 「眯牌」动作支持 | 无 | ✅ | ✅ |

---

## 10. 附录：关键代码引用速查

| 主题 | wp.apk 出处 | H5 对应位置 |
|---|---|---|
| 状态机 + 阶段队列 | `decrypted/texas_modules/06_phases_state/GameRoundQueueManage.js` | `engine/game.js` `STAGE` + `_advanceStage` |
| 牌型比较算法 | `decrypted/texas_modules/01_card_engine/StraightFlushTypeComparator.js` | `engine/hand.js` `eval5` |
| 边池 / 资格 | (wp.apk 在服务器，无前端代码) | `engine/pot.js` `buildPots` |
| 加注预设按钮 | `decrypted/texas_modules/04_betting/`（已落地）| `ui/controls.js` `presetBtns` |
| 卡牌动画控制器 | `decrypted/texas_modules/01_card_engine/Holdem_CardsHandler.js` | `ui/table.js` `renderCardEl` |
| 协议层 | `decrypted/texas_modules/16_protocol_network/HMFClient.js`（不抄）| `net/channel.js`（保持 JSON）|

---

> **下一步动作建议**：
> 1. 先看本文档 § 5 的 P0 表，挑 1–2 项启动
> 2. 推荐从 **PR #1（测试）** 开始，因为后续所有改动都需要测试兜底
> 3. 完成 P0 4 项后回到本文档勾选 ✅，再决定是否进入 P1
