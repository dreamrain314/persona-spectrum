// cloud.js — WorkBuddy 云服务(keyless AI 解读)接入层
//
// 通过官方 SDK(@tencent-ai/workbuddy-cloud-sdk,CDN global 形式)调用云模型,
// 访客无需任何 API Key。任何一步失败(SDK 加载 / Origin 不匹配 / 模型列表为空)
// 都向上返回 { ok:false },由调用方回退到 BYOK(访客自带 Key)模式——
// 回退是显式的,不静默冒充成功。
//
// 与 ai.js 的 BYOK 流式接口保持同一回调约定:
//   onDelta(delta, full)      正文增量
//   onThinking(chunk, done)   思考增量 / 代理类信号(done=true)
//   signal                    AbortSignal,用于中止生成

import { CLOUD_CONFIG as CFG } from "./data/cloud-config.js";

const SDK_GLOBAL = "WorkBuddyCloud";

/** 同步判断:配置里是否启用了云服务(不代表此刻一定可用) */
export function isConfigured() {
  return !!CFG.enabled && !!CFG.endpoint && !!CFG.publishableKey;
}

let ready = null; // null=未探测 | {ok:true,modelId,modelName,cloud} | {ok:false,reason,sticky}
let loadingPromise = null;

function loadSdk() {
  const urls = CFG.sdkUrls ?? [];
  return new Promise((resolve, reject) => {
    let i = 0;
    const attempt = () => {
      if (i >= urls.length) return reject(new Error("所有 SDK CDN 均加载失败"));
      const s = document.createElement("script");
      s.src = urls[i++];
      s.onload = () => (window[SDK_GLOBAL] ? resolve() : attempt());
      s.onerror = () => { s.remove(); attempt(); };
      document.head.appendChild(s);
    };
    attempt();
  });
}

function withTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label + "超时")), ms)),
  ]);
}

async function pickModel(cloud) {
  const models = await cloud.llm.models.list();
  if (!Array.isArray(models) || models.length === 0) return null;
  const usable = models.filter((m) => m.disabled !== true && m.enabled !== false);
  if (!usable.length) return null;
  // 偏好表优先(模型目录是动态的,偏好命不中就退回第一个可用)
  for (const id of CFG.modelPreference ?? []) {
    const hit = usable.find((m) => m.id === id);
    if (hit) return { id: hit.id, name: hit.name ?? hit.id };
  }
  const m = usable[0];
  return { id: m.id, name: m.name ?? m.id };
}

/**
 * 确保云客户端就绪(幂等)。成功返回 { ok:true, modelId, modelName, cloud };
 * 失败返回 { ok:false, reason, sticky }。sticky=true 表示本次会话不必重试
 * (SDK 加载失败 / Origin 不匹配等重试无意义的场景)。
 */
export async function ensureReady() {
  if (ready) return ready;
  if (loadingPromise) return loadingPromise;
  if (!isConfigured()) {
    ready = { ok: false, reason: "未配置云服务", sticky: true };
    return ready;
  }
  loadingPromise = (async () => {
    try {
      if (!window[SDK_GLOBAL]) await withTimeout(loadSdk(), 15000, "SDK 加载");
      const factory = window[SDK_GLOBAL]?.createWorkBuddyCloud;
      if (typeof factory !== "function") throw new Error("SDK 全局对象不完整");
      const cloud = factory({
        endpoint: CFG.endpoint,
        oauthRelayBaseUrl: CFG.oauthRelayBaseUrl,
        publishableKey: CFG.publishableKey,
      });
      const model = await withTimeout(pickModel(cloud), 15000, "模型列表查询");
      if (!model) {
        ready = { ok: false, reason: "云端没有可用模型", sticky: true };
        return ready;
      }
      ready = { ok: true, modelId: model.id, modelName: model.name, cloud };
      return ready;
    } catch (e) {
      // Origin 不匹配 / 鉴权失败:本会话重试无意义
      const code = e?.error?.code ?? "";
      const sticky = code.startsWith("auth_") || String(e?.message ?? "").includes("SDK");
      ready = { ok: false, reason: friendlyError(e), sticky };
      return ready;
    }
  })();
  const r = await loadingPromise;
  loadingPromise = null;
  return r;
}

function friendlyError(e) {
  const code = e?.error?.code ?? "";
  if (code.startsWith("auth_")) return "云服务鉴权未通过(当前页面不在应用发布域名下,属预期的降级场景)";
  if (code.startsWith("quota_")) return "云服务额度受限,请稍后再试";
  if (code.startsWith("gateway_") || code.startsWith("model_")) return "模型服务暂时不可用,请稍后重试";
  if (code.startsWith("request_")) return "请求参数有误,请刷新页面重试";
  if (e instanceof TypeError) return "网络连接失败";
  return String(e?.message ?? e).slice(0, 120);
}

/* ---------- 会话配额防护 ---------- */

const CALLS_KEY = "ps-cloud-calls";

function takeCallSlot() {
  try {
    const n = +(sessionStorage.getItem(CALLS_KEY) ?? "0");
    if (n >= (CFG.maxCallsPerSession ?? 40)) return false;
    sessionStorage.setItem(CALLS_KEY, String(n + 1));
    return true;
  } catch {
    return true; // sessionStorage 不可用时放行,不阻断正常使用
  }
}

/* ---------- 流式对话 ---------- */

const FALLBACK_SYS = "You are a helpful assistant. Be concise and helpful.";

/**
 * 云模型流式对话。onDelta/onThinking/signal 约定与 ai.js 的 BYOK streamChat 一致。
 */
export async function streamChat(messages, onDelta, onThinking, signal) {
  const st = await ensureReady();
  if (!st.ok) throw new Error(st.reason);
  if (!takeCallSlot()) {
    throw new Error(`本次浏览会话的云解读次数已达上限(${CFG.maxCallsPerSession}),请刷新页面或改用下方自带 Key 模式。`);
  }

  const msgs = messages?.[0]?.role === "system" ? messages : [{ role: "system", content: FALLBACK_SYS }, ...messages];
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  let full = "";
  try {
    const stream = st.cloud.llm.chat.completions.create({
      model: st.modelId,
      messages: msgs,
      stream: true,
      temperature: 0.7,
      signal: controller.signal,
    });
    for await (const chunk of withDeadline(stream, {
      firstTokenMs: CFG.firstTokenMs ?? 200000,
      stallMs: CFG.stallMs ?? 60000,
      maxTotalMs: CFG.maxTotalMs ?? 300000,
    })) {
      const delta = chunk?.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.reasoning_content) onThinking?.(delta.reasoning_content, false);
      if (delta.refusal) { full += delta.refusal; onDelta?.(delta.refusal, full); }
      if (delta.content) { full += delta.content; onDelta?.(delta.content, full); }
    }
    return full;
  } catch (e) {
    if (controller.signal.aborted && signal?.aborted) throw new Error("已中止生成");
    throw new Error(friendlyError(e));
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

// 给异步迭代器加三级时限:
//   firstTokenMs —— 出第一个 chunk 前的最大等待(推理模型思考阶段可能长达数分钟)
//   stallMs      —— 已有输出后,单个 chunk 间隔的最大等待
//   maxTotalMs   —— 整次调用硬上限
// 结束/失败时清理定时器并关闭底层 SSE 流,避免悬挂连接与 unhandled rejection
async function* withDeadline(iter, { firstTokenMs, stallMs, maxTotalMs }) {
  const t0 = Date.now();
  let got = false;
  let timer;
  const arm = (ms, label) =>
    new Promise((_, rej) => {
      clearTimeout(timer);
      timer = setTimeout(() => rej(new Error(label)), ms);
    });
  try {
    for (;;) {
      const left = maxTotalMs - (Date.now() - t0);
      if (left <= 0) throw new Error("模型响应超时");
      const wait = got ? stallMs : firstTokenMs;
      const next = await Promise.race([iter.next(), arm(Math.min(wait, left), "模型响应超时")]);
      if (next.done) return;
      got = true;
      yield next.value;
    }
  } finally {
    clearTimeout(timer);
    if (typeof iter.return === "function") iter.return().catch(() => {});
  }
}
