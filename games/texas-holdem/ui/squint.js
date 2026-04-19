// 眯牌（squint）模式偏好持久化
//
// 关闭（默认）：自己的底牌正面朝上展示
// 开启：自己的底牌默认背面，长按"掀起"才能看
//
// table.js / controls.js / main.js 都引用这里的接口；UI 上的开关按钮在 main.js 绑定。

const KEY = "holdem_squint";

export function isSquintEnabled() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function setSquintEnabled(v) {
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (_) {}
}
