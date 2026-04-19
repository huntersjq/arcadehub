// 视觉偏好持久化
//
// 两个独立维度：
//   theme:     classic | midnight | blackgold        牌桌 + 主色调
//   deckMode:  four-color | two-color                花色着色（4 色: ♠黑 ♥红 ♣绿 ♦蓝；2 色: 红黑）
//
// 通过给 <body> 加 data-theme / data-deck 属性，让 CSS 选择器一处生效。

const THEME_KEY = "holdem_theme";
const DECK_KEY = "holdem_deck";

export const THEMES = ["classic", "midnight", "blackgold"];
export const DECK_MODES = ["four-color", "two-color"];

export const THEME_LABELS = {
  classic:   "经典绿",
  midnight:  "午夜蓝",
  blackgold: "黑金",
};
export const DECK_LABELS = {
  "four-color": "4 色（♣绿 ♦蓝）",
  "two-color":  "2 色（红黑）",
};

const DEFAULT_THEME = "classic";
const DEFAULT_DECK = "four-color"; // 默认 4 色（参考 WePoker / PokerStars 高阶玩家偏好）

export function getTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEMES.includes(v) ? v : DEFAULT_THEME;
  } catch (_) { return DEFAULT_THEME; }
}

export function setTheme(v) {
  if (!THEMES.includes(v)) v = DEFAULT_THEME;
  try { localStorage.setItem(THEME_KEY, v); } catch (_) {}
  applyTheme();
}

export function getDeckMode() {
  try {
    const v = localStorage.getItem(DECK_KEY);
    return DECK_MODES.includes(v) ? v : DEFAULT_DECK;
  } catch (_) { return DEFAULT_DECK; }
}

export function setDeckMode(v) {
  if (!DECK_MODES.includes(v)) v = DEFAULT_DECK;
  try { localStorage.setItem(DECK_KEY, v); } catch (_) {}
  applyTheme();
}

// 把当前偏好同步到 <body> 的 data-* 属性 — CSS 选择器据此切换
export function applyTheme() {
  const body = document.body;
  if (!body) return;
  body.dataset.theme = getTheme();
  body.dataset.deck  = getDeckMode();
}
