// counter.js — 匿名测评计数
// 只统计"测评完成"次数,不收集任何个人数据;任何失败都静默,不影响测评流程
import { COMMENT_CONFIG } from "./data/comment-config.js";

const BASE = COMMENT_CONFIG.supabaseUrl;
const KEY = COMMENT_CONFIG.supabaseAnonKey;
const HEADERS = { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` };
const TIMEOUT = 6000;

/** 报告生成时调用一次;fire-and-forget */
export function bumpTestCount() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  fetch(`${BASE}/rest/v1/rpc/increment_test_count`, { method: "POST", headers: HEADERS, signal: ctrl.signal })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
    })
    .catch(() => {})
    .finally(() => clearTimeout(timer));
}

/** 落地页读取总数;失败返回 null(展示层自行隐藏) */
export async function fetchTestCount() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const r = await fetch(`${BASE}/rest/v1/rpc/get_test_count`, { method: "POST", headers: HEADERS, signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const n = await r.json();
    return typeof n === "number" && n >= 0 ? n : null;
  } catch {
    return null;
  }
}
