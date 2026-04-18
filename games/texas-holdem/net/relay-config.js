// 默认中继地址配置
// ─────────────────
// 部署者改这一个常量，Pages 用户就不用手动填地址了。
//
// 留空  → 同源 /lan（本地 Bun 服务器，`bun run lan`）
// 填值  → 公网 Cloudflare Workers 中继，必须以 wss:// 开头，末尾 /lan
//
// 部署流程：
//   1) cd scripts && bun x wrangler deploy
//   2) 把下面的 URL 换成 wrangler 输出的地址
//   3) git commit && git push → Pages 自动发布

export const DEFAULT_RELAY_URL = "wss://arcadehub-relay.huntersg.workers.dev/lan";
