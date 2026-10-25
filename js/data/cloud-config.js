// cloud-config.js — WorkBuddy 云服务公共配置(免密钥 AI 解读)
//
// 由 cloud-service 激活后生成。publishableKey 按设计可出现在前端代码中(本身不含任何权限,
// 服务端按 Origin 精确匹配放行);endpoint 是当前应用的发布域名数据面地址,随发布保留。
//
// 降级行为:enabled=false、SDK 加载失败、或当前页面 Origin 不在发布域名下(如 GitHub Pages)
// 时,AI 面板自动回退到「访客自带 API Key(BYOK)」模式,与启用本配置前完全一致。

export const CLOUD_CONFIG = {
  enabled: true,
  endpoint: "https://persona-spectrum-35570.app.workbuddy.host",
  oauthRelayBaseUrl: "https://www.workbuddy.cn/v2/as/genie-baas/oauth",
  publishableKey: "wbpk_r95jfJgJi4X4guSqMYT37e_5gQRq6OFPYzkWlBo9LnfQi02IYKF7fzy",
  // SDK 加载地址:主用 jsdelivr,失败回退 unpkg(均为官方 CDN)
  sdkUrls: [
    "https://cdn.jsdelivr.net/npm/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js",
    "https://unpkg.com/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js",
  ],
  // 模型偏好:按顺序取列表中第一个可用(未禁用)的;都不在列表时退回第一个可用模型
  modelPreference: ["deepseek-v4-flash", "glm-4.6", "deepseek-v4.1-flash", "deepseek-v3-2-volc", "hunyuan-chat"],
  // 单个浏览器会话内云模型调用上限,防配额被恶意连点耗尽
  maxCallsPerSession: 40,
  // 超时策略(毫秒):首 token 耐心(推理模型思考阶段可达数分钟)、流中停滞判定、总上限
  firstTokenMs: 200000,
  stallMs: 60000,
  maxTotalMs: 300000,
};
