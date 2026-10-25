// engine.js — 规则引擎:离线解读生成(称号/交互洞察/场景/证据挑选)
import { ITEMS, DOMAINS } from "./data/items.js";
import { COPY, TITLES, MOTTOS, INTERACTIONS, SCENES, GRADE_LABELS } from "./data/copy.js";
import {
  domainScores, facetScores, domainPercentiles, facetPercentiles,
  responseQuality, selfRatingGaps, salientDomains, gradeOf, itemScore,
} from "./scoring.js";

/** 汇总一次测评的全部结果 */
export function computeAll(state) {
  const itemCount = state.items.length;
  const ds = domainScores(state.answers);
  const fs = facetScores(state.answers);
  const dp = domainPercentiles(ds);
  const fp = facetPercentiles(fs);
  const quality = responseQuality(state.answers, itemCount);
  const gaps = state.selfRatings ? selfRatingGaps(dp, state.selfRatings) : null;
  const salient = salientDomains(dp);

  const { title, motto } = buildTitle(salient, dp);

  return {
    itemCount,
    domainScores: ds,
    facetScores: fs,
    domainPcts: dp,
    facetPcts: fp,
    grades: Object.fromEntries(Object.keys(dp).map((k) => [k, gradeOf(dp[k])])),
    quality,
    gaps,
    salient,
    title,
    motto,
    interactions: matchInteractions(dp),
    scenes: buildScenes(salient, dp),
    evidence: pickEvidence(state.items, state.answers),
  };
}

/** 称号:主特征维度作词根,次特征做修饰;全体不显著时为"平衡"称号 */
function buildTitle(salient, dp) {
  const marked = salient.filter((s) => s.dev >= 15);
  if (marked.length === 0) {
    return { title: TITLES.balance, motto: MOTTOS.balance };
  }
  const main = marked[0];
  const mainKey = main.key + (main.pct > 50 ? "hi" : "lo");
  const noun = TITLES.nouns[mainKey];
  let title = noun.name;
  let motto = noun.motto;
  if (marked.length >= 2) {
    const second = marked[1];
    const adj = TITLES.adjectives[second.key + (second.pct > 50 ? "hi" : "lo")];
    if (adj) title = adj + noun.name;
  }
  return { title, motto };
}

/** 维度交互洞察:按优先级返回命中的规则文案(最多 3 条) */
function matchInteractions(dp) {
  const hit = [];
  for (const rule of INTERACTIONS) {
    if (hit.length >= 3) break;
    if (rule.match(dp)) hit.push({ id: rule.id, title: rule.title, text: rule.text });
  }
  return hit;
}

/** 场景解读:按主/次特征维度取文案 */
function buildScenes(salient, dp) {
  const out = {};
  const main = salient[0];
  const level = main && main.dev >= 15 ? (main.pct > 50 ? "hi" : "lo") : "mid";
  const key = main ? main.key : null;
  for (const scene of ["workplace", "relationship", "learning"]) {
    const table = SCENES[scene];
    out[scene] = key && table[key] ? table[key][level] ?? table[key].mid : table.fallback;
  }
  return out;
}

/**
 * 为 AI 解读挑选"具体题目作答证据":
 * 每维度取计分后偏离中性最远的两题(一高一低);另附极速作答提示。
 */
export function pickEvidence(items, answers) {
  const evidence = [];
  const byDomain = {};
  for (const it of items) {
    const rec = answers[it.num];
    if (!rec) continue;
    (byDomain[it.domain] ??= []).push({ it, rec });
  }
  for (const d of Object.keys(byDomain)) {
    const scored = byDomain[d]
      .map(({ it, rec }) => ({ it, rec, s: itemScore(it, rec.v) }))
      .sort((a, b) => Math.abs(b.s - 3) - Math.abs(a.s - 3));
    // 一高一低:高于中性的取最偏一条、低于中性的取最偏一条;某侧缺失时从剩余补最偏
    const picked = [];
    const highs = scored.filter((p) => p.s > 3);
    const lows = scored.filter((p) => p.s < 3);
    if (highs.length) picked.push(highs[0]);
    if (lows.length) picked.push(lows[0]);
    for (const cand of scored) {
      if (picked.length >= 2) break;
      if (!picked.includes(cand)) picked.push(cand);
    }
    for (const p of picked) {
      evidence.push({
        domain: d,
        num: p.it.num,
        text: p.it.zh,
        raw: p.rec.v,
        reverse: p.it.reverse,
        scored: p.s,
        fast: p.rec.ms > 0 && p.rec.ms < 1200,
      });
    }
  }
  return evidence;
}

/** 维度摘要段(规则引擎文本) */
export function domainSummary(domain, grade) {
  return COPY.domains[domain].grades[grade]?.text ?? "";
}

/** 侧面解读段 */
export function facetText(domain, facetIdx, grade) {
  const fid = `${domain}${facetIdx + 1}`;
  return COPY.facets[fid].grades[grade]?.text ?? "";
}

export function gradeLabel(grade) {
  return GRADE_LABELS[grade] ?? "";
}
