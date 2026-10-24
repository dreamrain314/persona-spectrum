// scoring.js — BFI-2 计分引擎(纯函数,无副作用)
// answers: { [num]: { v: 1..5 李克特原值, ms: 作答耗时毫秒 } }
import { ITEMS, DOMAINS } from "./data/items.js";
import { NORMS } from "./data/norms.js";

/** 反向计分翻转:1↔5, 2↔4, 3 不变 */
export function itemScore(item, v) {
  return item.reverse ? 6 - v : v;
}

/** 各维度均分(1-5,保留两位);未作答的题不计入 */
export function domainScores(answers) {
  const out = {};
  for (const key of Object.keys(DOMAINS)) {
    const its = ITEMS.filter((i) => i.domain === key && answers[i.num] != null);
    if (!its.length) { out[key] = null; continue; }
    out[key] = +(its.reduce((s, i) => s + itemScore(i, answers[i.num].v), 0) / its.length).toFixed(2);
  }
  return out;
}

/** 各侧面均分,键为 `${domain}${facet}` 如 "O1" */
export function facetScores(answers) {
  const out = {};
  for (const key of Object.keys(DOMAINS)) {
    DOMAINS[key].facets.forEach((_, idx) => {
      const fid = `${key}${idx + 1}`;
      const its = ITEMS.filter(
        (i) => i.domain === key && i.facet === idx + 1 && answers[i.num] != null
      );
      if (!its.length) { out[fid] = null; return; }
      out[fid] = +(its.reduce((s, i) => s + itemScore(i, answers[i.num].v), 0) / its.length).toFixed(2);
    });
  }
  return out;
}

/** 正态分布 CDF(Abramowitz & Stegun 7.1.26 近似,误差 < 1e-7) */
export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
  return z >= 0 ? p : 1 - p;
}

/** 原始均分 → 常模百分位(0-100 整数)。无常模返回 null */
export function toPercentile(score, domain) {
  const norm = NORMS[domain];
  if (norm == null || score == null) return null;
  const z = (score - norm.mean) / norm.sd;
  return Math.round(normalCdf(z) * 100);
}

/** 批量:维度分 → 百分位映射 */
export function domainPercentiles(scores) {
  const out = {};
  for (const key of Object.keys(scores)) out[key] = toPercentile(scores[key], key);
  return out;
}

/** 侧面分 → 百分位(若常模含侧面级则用之,否则用维度常模近似) */
export function facetPercentiles(facets) {
  const out = {};
  for (const fid of Object.keys(facets)) {
    const d = fid[0];
    const norm = NORMS[fid] ?? NORMS[d];
    out[fid] = norm == null || facets[fid] == null ? null : Math.round(normalCdf((facets[fid] - norm.mean) / norm.sd) * 100);
  }
  return out;
}

/** 档位划分:百分位 → 1 极低 / 2 偏低 / 3 中等 / 4 偏高 / 5 极高 */
export function gradeOf(pct) {
  if (pct == null) return null;
  if (pct < 10) return 1;
  if (pct < 35) return 2;
  if (pct <= 65) return 3;
  if (pct <= 90) return 4;
  return 5;
}

/** 作答质量检测 */
export function responseQuality(answers, itemCount) {
  const entries = Object.values(answers);
  const vals = entries.map((a) => a.v);
  const neutralRatio = vals.filter((v) => v === 3).length / itemCount;

  // 最长连续同值段(直线作答信号)
  let maxRun = 1, run = 1;
  for (let i = 1; i < vals.length; i++) {
    run = vals[i] === vals[i - 1] ? run + 1 : 1;
    if (run > maxRun) maxRun = run;
  }
  const straightLining = maxRun >= Math.max(12, itemCount * 0.3);

  const avgMs = entries.reduce((s, a) => s + (a.ms ?? 0), 0) / itemCount;
  const tooFast = avgMs > 0 && avgMs < 1500; // 平均每题不足 1.5 秒

  const flags = [];
  if (neutralRatio > 0.4) flags.push("excessiveNeutral");
  if (straightLining) flags.push("straightLining");
  if (tooFast) flags.push("tooFast");

  let confidence = "high";
  if (flags.length >= 2 || straightLining) confidence = "low";
  else if (flags.length === 1) confidence = "medium";

  return {
    neutralRatio: Math.round(neutralRatio * 100),
    maxRun,
    avgMs: Math.round(avgMs),
    flags,
    confidence, // high | medium | low
  };
}

/** 自评 vs 实测:gap = 实测百分位 − 自评(0-100) */
export function selfRatingGaps(percentiles, selfRatings) {
  const out = {};
  for (const key of Object.keys(percentiles)) {
    if (percentiles[key] == null || selfRatings[key] == null) { out[key] = null; continue; }
    out[key] = percentiles[key] - selfRatings[key];
  }
  return out;
}

/** 主/次特征维度:按 |百分位 − 50| 排序,同分按固定顺序稳定 */
export function salientDomains(percentiles) {
  return Object.keys(percentiles)
    .filter((k) => percentiles[k] != null)
    .map((k) => ({ key: k, dev: Math.abs(percentiles[k] - 50), pct: percentiles[k] }))
    .sort((a, b) => b.dev - a.dev || a.key.localeCompare(b.key));
}
