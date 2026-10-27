// ui.js — 各屏渲染(landing / 模式选择 / 自评 / 答题 / 过渡 / 报告 / 关于弹层)
import { DOMAINS } from "./data/items.js";
import { renderRadar } from "./chart.js";
import { generateShareCard } from "./share.js";
import * as AI from "./ai.js";
import { domainSummary, facetText } from "./engine.js";
import { gradeOf } from "./scoring.js";
import { GRADE_LABELS, QUALITY_NOTE, ABOUT } from "./data/copy.js";
import { NORM_NOTE } from "./data/norms.js";
import { FACET_DEFS } from "./data/facet-defs.js";
import { fetchTestCount } from "./counter.js";

const ORDER = ["O", "C", "E", "A", "N"];
const OPT_LABELS = ["非常不像我", "不太像我", "说不清", "比较像我", "非常像我"];

/* ---------- 公共 ---------- */

function observeReveals(root = document) {
  const els = root.querySelectorAll(".reveal");
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      }
    },
    { threshold: 0.1 }
  );
  els.forEach((el) => io.observe(el));
}

function loadHistory() {
  try {
    const hist = JSON.parse(localStorage.getItem("ps-history") ?? "[]");
    return Array.isArray(hist) ? hist : [];
  } catch { return []; }
}

function fmtRemaining(ms) {
  const min = Math.max(1, Math.ceil(ms / 60000));
  return `约 ${min} 分钟`;
}

/* ---------- Landing ---------- */

export function renderLanding(app, state, h) {
  const hist = loadHistory();
  app.innerHTML = `
    <section class="landing">
      <div class="spectrum-mark" aria-hidden="true">
        <span style="--h:34%; --c:var(--o-fill); --i:0"></span>
        <span style="--h:72%; --c:var(--c-fill); --i:1"></span>
        <span style="--h:52%; --c:var(--e-fill); --i:2"></span>
        <span style="--h:88%; --c:var(--a-fill); --i:3"></span>
        <span style="--h:26%; --c:var(--n-fill); --i:4"></span>
      </div>
      <p class="eyebrow reveal">Big Five · Scientific Personality Assessment</p>
      <h1 class="serif-display reveal" style="--i:1">认识你自己,<br/><em>以科学的方式</em></h1>
      <p class="lede reveal" style="--i:2">基于心理学界主流的大五人格模型与 BFI-2 量表。60 题或 30 题作答之后,你会得到一份五维画像——15 个性格侧面的细分、你以为的自己与测出来的自己之间的距离,以及可选的 AI 深度解读:它会引用你具体每一题的作答,而不是泛泛而谈。</p>
      <div class="meta-row reveal" style="--i:3">
        <div class="meta-item"><b>60 / 30 题</b><span>完整版 / 快速版</span></div>
        <div class="meta-item"><b>15 个侧面</b><span>维度之下的细颗粒度</span></div>
        <div class="meta-item"><b>约 10 / 4 分钟</b><span>含自评与报告</span></div>
        <div class="meta-item"><b>100% 本地</b><span>无账号 · 数据不出浏览器</span></div>
      </div>
      <div class="reveal" style="--i:4"><button class="btn" data-action="begin">开始测评 <span class="arr">→</span></button></div>
      <p class="social-proof reveal" style="--i:4" id="test-count" hidden>已有 <b>—</b> 人完成测评</p>
      <div class="trait-strip reveal" style="--i:5">
        ${ORDER.map((k) => `<span class="trait-item"><span class="dot dot-${k}"></span>${DOMAINS[k].name}<span class="en">${DOMAINS[k].en}</span></span>`).join("")}
      </div>
      ${historyHtml(hist)}
    </section>`;
  app.querySelector("[data-action='begin']").addEventListener("click", h.begin);
  fetchTestCount().then((n) => {
    if (n == null) return;
    const el = app.querySelector("#test-count");
    if (!el) return;
    el.querySelector("b").textContent = n.toLocaleString("zh-CN");
    el.hidden = false;
  });
  app.querySelectorAll("[data-action='history-view']").forEach((b) =>
    b.addEventListener("click", () => h.viewHistory(+b.dataset.historyView))
  );
  observeReveals(app);
}

function historyHtml(hist) {
  if (!hist.length) return "";
  const rows = hist.slice(0, 3).map((e, i) => {
    const d = (e.date ?? "").slice(0, 10);
    const mode = e.mode === "short" ? "快速版" : "完整版";
    const pcts = e.percentiles ?? {};
    const bars = ORDER.map((k) =>
      `<span class="hist-bar" title="${DOMAINS[k].name}:高于参考人群 ${pcts[k] ?? "—"}% 的人"><i style="width:${Math.max(4, Math.min(100, pcts[k] ?? 0))}%;background:var(--${k.toLowerCase()}-fill)"></i></span>`
    ).join("");
    const view = e.snapshot
      ? `<button class="btn btn-ghost hist-view" data-action="history-view" data-history-view="${i}">查看完整报告 →</button>`
      : `<span class="hist-slim">(早期记录,仅摘要)</span>`;
    return `
      <div class="history-row">
        <span class="hist-date">${d}</span>
        <span class="hist-mode">${mode}</span>
        <span class="hist-title">「${e.title ?? "—"}」</span>
        <span class="hist-bars">${bars}</span>
        ${view}
      </div>`;
  }).join("");
  const more = hist.length > 3 ? `<p class="hist-more">另有 ${hist.length - 3} 条更早的记录(本浏览器最多保留 5 条)</p>` : "";
  return `
    <div class="history-block reveal" style="--i:6">
      <p class="hist-head">你的测评记录 · 只存在这个浏览器里</p>
      ${rows}
      ${more}
    </div>`;
}

/* ---------- 模式选择 ---------- */

export function renderSetup(app, state, h) {
  app.innerHTML = `
    <section class="setup" style="padding:3rem 0 1rem">
      <p class="eyebrow reveal">第一步 · 选择方式</p>
      <h2 class="serif-display reveal" style="--i:1;font-size:clamp(1.8rem,4vw,2.4rem);margin:0.8rem 0 1.4rem">你想测多深?</h2>
      <div class="mode-grid">
        <button class="card mode-card reveal" style="--i:2" data-mode="short">
          <span class="mode-time">约 4 分钟 · 30 题</span>
          <h3>快速版</h3>
          <p>五维画像与 15 个侧面的概览。每个侧面只有 2 题,颗粒度较粗,适合好奇尝鲜。</p>
          <span class="mode-foot">想快速看看轮廓 →</span>
        </button>
        <button class="card mode-card reveal" style="--i:3" data-mode="full">
          <span class="mode-time">约 10 分钟 · 60 题</span>
          <h3>完整版</h3>
          <p>BFI-2 完整量表。每个侧面 4 题,结果更稳定,作答质量检测也更有说服力。</p>
          <span class="mode-foot">打算认真认识自己 →</span>
        </button>
      </div>
      <div class="consent reveal" style="--i:4">
        开始之前:题目没有对错与好坏之分,凭第一反应作答最准确;找一个不被打扰的几分钟。
        你的作答只保存在本浏览器里,不会上传到任何服务器。
        答完题后,会先请你对五个维度做一个自评,用于与实测结果对照——这是整份报告里最有意思的部分之一。
      </div>
      <button class="btn btn-ghost reveal" style="--i:5" data-action="back">← 返回首页</button>
    </section>`;
  app.querySelectorAll(".mode-card").forEach((b) =>
    b.addEventListener("click", () => h.chooseMode(b.dataset.mode))
  );
  app.querySelector("[data-action='back']").addEventListener("click", h.begin);
  observeReveals(app);
}

/* ---------- 自评 ---------- */

export function renderSelfRating(app, state, h) {
  app.innerHTML = `
    <section class="selfrate" style="padding:3rem 0 2rem">
      <div class="selfrate-intro">
        <p class="eyebrow reveal">第二步 · 自评</p>
        <h2 class="serif-display reveal" style="--i:1;font-size:clamp(1.8rem,4vw,2.4rem);margin:0.8rem 0 0.8rem">先凭直觉,给自己画个像</h2>
        <p class="lede reveal" style="--i:2">拖动滑杆,标出你认为自己在这五个维度上大概处于什么位置。不用犹豫,凭第一感觉即可——稍后报告会把它和你 ${state.mode === "short" ? "30 题" : "60 题"}的实际作答放在一起对照,两者之间的距离往往比分数本身更有信息量。</p>
      </div>
      <div class="card reveal" style="--i:3">
        ${ORDER.map(
          (k) => `
        <div class="slider-row">
          <div class="slider-label"><b>${DOMAINS[k].name}</b><span>${DOMAINS[k].desc}</span></div>
          <input type="range" min="0" max="100" value="50" data-domain="${k}" aria-label="自评:${DOMAINS[k].name}" />
          <span class="slider-val" data-val="${k}">50</span>
        </div>`
        ).join("")}
        <div class="slider-scale"><span>很低</span><span>中等</span><span>很高</span></div>
      </div>
      <div class="reveal" style="--i:4;margin-top:2rem">
        <button class="btn" data-action="go">确认自评,进入答题 →</button>
      </div>
    </section>`;
  app.querySelectorAll("input[type='range']").forEach((inp) =>
    inp.addEventListener("input", () => {
      app.querySelector(`[data-val='${inp.dataset.domain}']`).textContent = inp.value;
    })
  );
  app.querySelector("[data-action='go']").addEventListener("click", () => {
    const ratings = {};
    app.querySelectorAll("input[type='range']").forEach((inp) => (ratings[inp.dataset.domain] = +inp.value));
    h.confirmSelfRating(ratings);
  });
  observeReveals(app);
}

/* ---------- 答题 ---------- */

export function renderQuiz(app, state, h) {
  const items = state.items;
  const idx = state.index;
  const item = items[idx];
  const rec = state.answers[item.num];
  const shownAt = performance.now();

  // 下一题可前进到「答题前沿」(第一个未作答题);已在前沿或末题时变灰
  const nextItem = items[idx + 1];
  let frontier = items.findIndex((it) => state.answers[it.num] == null);
  if (frontier === -1) frontier = items.length;
  const canNext = !!nextItem && idx + 1 <= frontier;
  const remainingMs = (items.length - idx - 1) * 20000; // 按每题 20 秒估算

  app.innerHTML = `
    <section class="quiz-wrap">
      <div class="quiz-top">
        <span>第 ${idx + 1} 题 / 共 ${items.length} 题</span>
        <span>预计剩余 ${fmtRemaining(remainingMs)}</span>
        <span class="quiz-nav">
          <button data-action="prev" ${idx === 0 ? "disabled" : ""}>← 上一题</button>
          <button data-action="next" ${canNext ? "" : "disabled"}>下一题 →</button>
        </span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="transform:scaleX(${idx / items.length})"></div></div>
      <div class="quiz-item qitem-enter">
        <p class="quiz-lead">下面每句话都在描述「我是一个……的人」——凭第一感觉,选出它像不像你</p>
        <p class="quiz-stem">我${item.zh}。</p>
        <div class="options">
          ${OPT_LABELS.map(
            (t, i) => `
          <button class="opt${rec && rec.v === i + 1 ? " picked" : ""}" data-v="${i + 1}">
            <span class="opt-num">${i + 1}</span>
            <span class="opt-text">${t}</span>
          </button>`
          ).join("")}
        </div>
        <p class="quiz-hint">键盘 <kbd>1</kbd>–<kbd>5</kbd> 快速作答 · <kbd>←</kbd> 上一题 · <kbd>→</kbd> 下一题</p>
      </div>
    </section>`;

  app.querySelectorAll(".opt").forEach((b) =>
    b.addEventListener("click", () => h.answer(+b.dataset.v, performance.now() - shownAt))
  );
  app.querySelector("[data-action='prev']")?.addEventListener("click", h.prevQuestion);
  app.querySelector("[data-action='next']")?.addEventListener("click", () => {
    if (canNext) h.nextQuestion();
  });
}

/* ---------- 过渡 ---------- */

export function renderComputing(app) {
  app.innerHTML = `
    <section class="computing">
      <div class="thinking-line"></div>
      <p class="serif-display">正在勾勒你的轮廓……</p>
      <p class="steps">SCORING · NORMING · MATCHING</p>
    </section>`;
}

/* ---------- 报告 ---------- */

export function renderReport(app, state, h) {
  const r = state.results;
  const hasSelf = !!state.selfRatings;

  app.innerHTML = `
    <section class="report">
      <div class="report-title-block">
        <p class="eyebrow reveal">你的人格称号 · ${state.mode === "short" ? "快速版" : "完整版"}</p>
        <h1 class="serif-display reveal" style="--i:1">${r.title}</h1>
        <p class="report-motto reveal" style="--i:2">「${r.motto}」</p>
        <p class="title-note reveal" style="--i:3">称号是对你分数组合的记忆装置,不是人格分类——你的五个维度都是连续的刻度。</p>
        ${state.viewingHistory ? `<p class="history-banner reveal" style="--i:3">你正在回看 ${String(state.viewingHistory).slice(0, 10)} 的历史报告,数据与当时完全一致。</p>` : ""}
      </div>

      ${qualityHtml(r)}
      ${pctExplainerHtml(r)}

      <div class="radar-section">
        <div class="card reveal" style="--i:2">
          <div id="radar-mount"></div>
          <div class="radar-legend">
            <span class="key"><span class="swatch"></span>实测</span>
            ${hasSelf ? `<span class="key"><span class="swatch dash"></span>自评</span>` : ""}
            <span class="key"><span class="swatch tick"></span>人群中位(50)</span>
          </div>
        </div>
        <div class="reveal" style="--i:3">
          <p class="unit-note">五维速览 · 数字 = 你高于百分之多少的人</p>
          <div class="mini-list">
            ${ORDER.map(
              (k) => `
            <div class="mini-row" title="${DOMAINS[k].name}:高于参考人群 ${r.domainPcts[k] ?? "—"}% 的人">
              <span class="tag tag-${k}">${DOMAINS[k].name}</span>
              <span class="mini-grade">${GRADE_LABELS[r.grades[k]] ?? "—"}</span>
              <span class="mini-pct">${r.domainPcts[k] ?? "—"}<i>%</i></span>
            </div>`
            ).join("")}
          </div>
          ${gapHtml(r, state)}
        </div>
      </div>

      <div class="domain-list">
        ${ORDER.map((k, di) => domainBlockHtml(k, r, di)).join("")}
      </div>

      ${insightHtml(r)}
      ${sceneHtml(r)}
      ${aiHtml(state, r)}
      <div id="comments-mount" class="comments-section" hidden></div>

      <div class="report-actions">
        <button class="btn" data-action="share">生成分享卡</button>
        <button class="btn btn-ghost" data-action="restart">重新测评</button>
      </div>
      <p class="report-note">量表:BFI-2(Soto &amp; John, 2017)· 中文版:BFI-2-CN(Zhang et al., 2022)· ${NORM_NOTE}本工具用于自我认识,非临床诊断。</p>
    </section>`;

  renderRadar(document.getElementById("radar-mount"), {
    values: r.domainPcts,
    compare: hasSelf ? state.selfRatings : undefined,
  });

  // 条形动画:进入视口后触发 scaleX
  const bars = app.querySelectorAll(".domain-bar, .facet-list");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.3 }
  );
  bars.forEach((b) => io.observe(b));

  app.querySelector("[data-action='restart']").addEventListener("click", h.restart);
  app.querySelectorAll(".acc-head").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest(".acc-item").classList.toggle("open");
    });
  });
  app.querySelector("[data-action='share']").addEventListener("click", () => {
    import("./share.js").then(({ generateShareCard }) =>
      generateShareCard({
        title: r.title,
        motto: r.motto,
        values: r.domainPcts,
        dateStr: new Date().toLocaleDateString("zh-CN"),
        url: location.host || "persona spectrum",
      })
    );
  });
  bindAI(app, state, r);
  import("./comments.js").then(({ renderComments }) =>
    renderComments(app.querySelector("#comments-mount"), r.title)
  );
  observeReveals(app);
}

/**
 * 「数字怎么读」说明块。
 * 百分位是整份报告的统一度量,这里用受访者自己落差最大的那个维度做例子
 * 讲一次;其余位置就不必重复标注单位,避免满屏 %ile / P 缩写。
 */
function pctExplainerHtml(r) {
  const ex = ORDER.reduce(
    (best, k) =>
      r.domainPcts[k] == null
        ? best
        : best == null || Math.abs(r.domainPcts[k] - 50) > Math.abs(r.domainPcts[best] - 50)
          ? k
          : best,
    null
  );
  const key = ex ?? "O";
  const pct = r.domainPcts[key] ?? 50;
  return `
    <div class="pct-explainer reveal">
      <span class="eyebrow">数字怎么读 · 百分位</span>
      <p>报告里所有数字都是<b>百分位</b>:你超过了参考人群里百分之多少的人。</p>
      <div class="pct-demo">
        <p class="pct-demo-line">以你的<b>${DOMAINS[key].name}</b>为例<span class="pct-demo-num">${pct}</span></p>
        <div class="pct-bar" role="img" aria-label="${DOMAINS[key].name}百分位 ${pct},每 100 人里约有 ${pct} 人低于你">
          <span class="pct-bar-fill" style="--sx:${pct / 100}"></span>
          <span class="pct-bar-mid"></span>
          <span class="pct-bar-cursor" style="--sx:${pct / 100}"></span>
        </div>
        <div class="pct-bar-labels"><span>最低</span><span>50 · 人群中间</span><span>最高</span></div>
        <p class="pct-demo-note">意思是:每 100 个参照样本中,大约 <b>${pct}</b> 人在这项上得分比你低,<b>${100 - pct}</b> 人比你高。</p>
      </div>
    </div>`;
}

function qualityHtml(r) {
  const q = r.quality;
  if (q.confidence === "high") return "";
  const flagNames = {
    excessiveNeutral: `中庸作答比例 ${q.neutralRatio}%(大量选择"不确定")`,
    straightLining: `最长连续同值作答 ${q.maxRun} 题(直线作答信号)`,
    tooFast: `平均每题仅 ${(q.avgMs / 1000).toFixed(1)} 秒`,
  };
  return `
    <div class="quality-note ${q.confidence} reveal">
      本次作答质量:${q.confidence === "medium" ? "一般" : "较低"} —— <b>${q.flags.map((f) => flagNames[f] ?? f).join(";")}</b>。
      ${QUALITY_NOTE[q.confidence] ?? ""}
    </div>`;
}

function gapHtml(r, state) {
  if (!r.gaps) return "";
  const entries = Object.entries(r.gaps)
    .filter(([, g]) => Math.abs(g) >= 20)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 2);
  if (!entries.length) {
    return `<div class="gap-callout">自评与实测基本一致——你对自己的认知相当准。</div>`;
  }
  const lines = entries
    .map(([k, g]) => {
      const pct = r.domainPcts[k];
      const self = state.selfRatings[k];
      return g > 0
        ? `<b>${DOMAINS[k].name}</b>:你把自己放在 ${self},实测高于 ${pct}% 的人。你低估了自己的这一面——行为证据比你自己的印象走得更远。`
        : `<b>${DOMAINS[k].name}</b>:你把自己放在 ${self},实测只高于 ${pct}% 的人。你高估了自己的这一面——你希望的样子和题目捕捉到的样子之间有距离。`;
    })
    .join("<br/>");
  return `<div class="gap-callout"><span class="eyebrow" style="display:block;margin-bottom:0.5rem">你以为的 vs 测出来的</span>${lines}</div>`;
}

function domainBlockHtml(k, r, di) {
  const pct = r.domainPcts[k];
  const grade = r.grades[k];
  const facetRows = DOMAINS[k].facets
    .map((name, i) => {
      const fid = `${k}${i + 1}`;
      const pct = r.facetPcts[fid];
      return `
      <div class="facet-row" title="${name}:高于参考人群 ${pct ?? "—"}% 的人">
        <span class="facet-name">${name}</span>
        <span class="facet-track"><span class="facet-fill d-${k}" style="--sx:${(pct ?? 0) / 100}"></span><span class="facet-mid"></span></span>
        <span class="facet-val">${pct ?? "—"}<i>%</i></span>
      </div>`;
    })
    .join("");
  const acc = DOMAINS[k].facets
    .map((name, i) => {
      const fid = `${k}${i + 1}`;
      const g = gradeOf(r.facetPcts[fid]);
      return `
      <div class="acc-item">
        <button class="acc-head" type="button">
          <span>${name} · ${GRADE_LABELS[g] ?? "—"} · 高于 ${r.facetPcts[fid] ?? "—"}% 的人</span>
          <span class="acc-icon">+</span>
        </button>
        <div class="acc-body">
          <p class="facet-def">${FACET_DEFS[fid].text}<span class="facet-def-src">—— 侧面定义,Soto &amp; John (2017)</span></p>
          ${facetText(k, i, g)}
        </div>
      </div>`;
    })
    .join("");

  return `
    <div class="domain-block reveal">
      <div class="domain-head">
        <span class="tag tag-${k}">${DOMAINS[k].name}</span>
        <span class="dom-en">${DOMAINS[k].en} · ${DOMAINS[k].facets.join(" / ")}</span>
        <span class="domain-pct" title="${pct == null ? "无常模数据" : "每 100 个参照样本里约有 " + pct + " 人低于你"}"><i class="pct-pre">高于</i>${pct ?? "—"}<i>% 的人</i></span>
      </div>
      <div class="domain-bar">
        <span class="fill" style="background:var(--${k.toLowerCase()}-text);--sx:${(pct ?? 0) / 100}"></span>
        <span class="norm-dot"></span>
      </div>
      <div class="facet-list">${facetRows}</div>
      <div class="domain-summary"><p>${domainSummary(k, grade)}</p></div>
      <div class="accordion">${acc}</div>
    </div>`;
}

function insightHtml(r) {
  if (!r.interactions.length) return "";
  return `
    <div class="insight-block reveal">
      <h2>维度之间的化学反应</h2>
      <p class="lede" style="margin-bottom:1.4rem">单独看每个维度是一回事,它们组合起来是另一回事。以下是根据你的具体分数组合匹配的洞察:</p>
      <div class="card insight-card">
        ${r.interactions.map((it) => `<h3>${it.title}</h3><p>${it.text}</p>`).join("")}
      </div>
    </div>`;
}

function sceneHtml(r) {
  const meta = { workplace: "在职场", relationship: "在关系里", learning: "在学习和成长上" };
  return `
    <div class="insight-block reveal">
      <h2>三个场景里的你</h2>
      <p class="lede" style="margin-bottom:1.4rem">同样的性格特征,落在不同场景里会长出不同的样子。</p>
      <div class="scene-grid">
        ${Object.keys(meta)
          .map(
            (sc) => `
        <div class="card scene-card">
          <h3>${meta[sc]}</h3>
          <p>${r.scenes[sc] ?? ""}</p>
        </div>`
          )
          .join("")}
      </div>
    </div>`;
}

/* ---------- AI 面板 ---------- */

// 云模式下给解读 prompt 补一条系统消息(云 API 要求 messages[0] 为 system)
const AI_SYS_HINT = "你是人格光谱的心理测量学解读顾问,严格遵循用户消息中的写作要求,用中文输出。";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function aiHtml(state, r) {
  const cfg = AI.loadConfig();
  const cloudOn = AI.cloudConfigured();
  return `
    <div class="ai-section reveal">
      <div class="ai-head-row">
        <h2 class="serif-display" style="font-size:1.6rem">AI 深度解读 <span class="tag" style="background:var(--surface-warm);color:var(--muted)">可选</span></h2>
      </div>
      <div class="ai-panel" id="ai-panel">
        <p style="color:var(--muted);font-size:0.9rem;line-height:1.9">
          上面的报告由内置规则引擎即时生成,离线可用。而 AI 深度解读会通读你的五维与 15 个侧面分数、<b>你具体题目的作答(包括作答速度)</b>、自评与实测的落差,写一段真正只属于你的长解读,并支持继续追问("我适合什么方向的工作?")。
        </p>
        ${cloudOn ? `
        <p style="color:var(--muted);font-size:0.9rem;line-height:1.9">
          本页已接入 <b>WorkBuddy 云服务</b>:免密钥直接生成,无需注册、无需填写任何 Key。解读请求经云服务处理,你的作答数据仅用于生成本次解读。也可以展开下方「使用我自己的 API Key」,切换到你自己的大模型服务商。
        </p>` : `
        <p style="color:var(--muted);font-size:0.9rem;line-height:1.9">
          它需要你自己的大模型 API Key(OpenAI 兼容格式,智谱 / DeepSeek / OpenAI 均可)。Key 只保存在本浏览器,请求从你的浏览器直接发往你选的服务商——本站没有后端,也无法看到它。不填也完全不影响使用其他全部功能。
        </p>`}
        <div id="ai-config-area">${aiConfigAreaHtml(cfg, cloudOn)}</div>
        <div id="ai-output" class="ai-output" hidden></div>
        <div id="ai-chat" class="ai-chat" hidden>
          <div class="ai-chat-log" id="chat-log"></div>
          <div class="chat-input-row">
            <input type="text" id="chat-input" placeholder="继续追问,例如:我这样的组合适合什么工作?" />
            <button class="btn" id="chat-send">发送</button>
          </div>
        </div>
        <p class="ai-note">${aiNoteHtml(cloudOn)}</p>
      </div>
    </div>`;
}

function aiNoteHtml(cloudOn) {
  const base = "AI 解读内容由模型生成,仅供自我认识参考,不构成临床诊断。";
  if (cloudOn) {
    return "隐私:作答仅存于本浏览器。免密钥模式下,解读请求(含你的分数与题目作答)经 WorkBuddy 云服务处理,用于生成本次回复;自带 Key 模式下,Key 与对话均不离开本浏览器,请求直达你选的服务商。" + base;
  }
  return "隐私:Key 与对话均不离开本浏览器;智谱接口不允许浏览器直连,本页会在直连被拦时自动改走同源代理——代理仅在以 <b>node server.js</b> 启动本项目时存在,纯静态托管下请改用支持直连的服务商(DeepSeek / OpenAI)或自建中转。" + base;
}

function aiConfigAreaHtml(cfg, cloudOn) {
  if (cfg) return readyRowHtml(cfg);
  if (cloudOn) return cloudReadyHtml();
  return configFormHtml(null);
}

function cloudReadyHtml() {
  return `
    <div id="ai-cloud-ready">
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin:1.2rem 0">
        <button class="btn" id="ai-generate-cloud" disabled>正在连接云服务…</button>
        <span id="ai-cloud-status" style="font-size:0.85rem;color:var(--muted)">正在连接…</span>
      </div>
      <details class="ai-byok-details">
        <summary>使用我自己的 API Key(高级)</summary>
        ${configFormHtml(null)}
      </details>
    </div>`;
}

function configFormHtml(cfg) {
  const cur = cfg ?? { preset: "zhipu", base: AI.PRESETS.zhipu.base, model: AI.PRESETS.zhipu.model, key: "" };
  return `
    <div class="ai-config">
      <label>服务商
        <select id="ai-preset">
          ${Object.entries(AI.PRESETS)
            .map(([k, p]) => `<option value="${k}" ${k === cur.preset ? "selected" : ""}>${p.label}</option>`)
            .join("")}
        </select>
      </label>
      <label>接口地址(Base URL)
        <input type="text" id="ai-base" value="${cur.base}" placeholder="https://…/v1" />
      </label>
      <label>模型
        <input type="text" id="ai-model" value="${cur.model}" placeholder="glm-4-air / deepseek-chat …" />
      </label>
      <label>API Key
        <input type="password" id="ai-key" value="" placeholder="已保存过可留空(保持不变)" autocomplete="off" />
      </label>
    </div>
    <button class="btn" id="ai-save">保存配置</button>`;
}

function readyRowHtml(cfg) {
  const label = AI.PRESETS[cfg.preset]?.label ?? cfg.base;
  const masked = cfg.key ? cfg.key.slice(0, 3) + "…" + cfg.key.slice(-4) + "(已保存)" : "未保存";
  return `
    <div class="ai-ready-row" style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin:1.2rem 0">
      <span style="font-size:0.85rem;color:var(--muted)">当前:${label} · ${cfg.model} · Key ${masked}</span>
      <button class="btn btn-ghost" id="ai-edit" style="padding:0.6rem 1.2rem">修改配置</button>
      <button class="btn btn-ghost" id="ai-use-cloud" style="padding:0.6rem 1.2rem" hidden>改用免密钥 AI</button>
      <button class="btn" id="ai-generate">生成 AI 深度解读 →</button>
    </div>`;
}

function bindAI(app, state, r) {
  const configArea = app.querySelector("#ai-config-area");
  const output = app.querySelector("#ai-output");
  const chatBox = app.querySelector("#ai-chat");
  const chatLog = app.querySelector("#chat-log");
  const chatInput = app.querySelector("#chat-input");
  let chatHistory = [];

  // 生成流程:BYOK 就绪行与云就绪行共用
  const runGenerate = async (btn) => {
    const btnLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "正在生成…";
    output.hidden = false;
    output.innerHTML = `<span class="ai-cursor"></span>`;
    let lastFull = "";
    let proxyNote = "";
    const refresh = () => {
      output.innerHTML =
        (proxyNote ? `<p class="ai-thinking">${proxyNote}</p>` : "") +
        (lastFull ? tinyMd(lastFull) + `<span class="ai-cursor"></span>` : `<p class="ai-thinking">模型思考中…深度解读的思考阶段通常需要一到三分钟,请稍候<span class="ai-cursor"></span></p>`);
    };
    try {
      const prompt = AI.buildInterpretationPrompt(state, r);
      await AI.streamChat(
        [{ role: "system", content: AI_SYS_HINT }, { role: "user", content: prompt }],
        (_d, full) => { lastFull = full; refresh(); },
        (_chunk, done) => { if (done) proxyNote = "(浏览器直连被跨域拦截,已自动经本地代理连接)"; else refresh(); }
      );
      output.innerHTML = (proxyNote ? `<p class="ai-thinking">${proxyNote}</p>` : "") + tinyMd(lastFull);
      chatBox.hidden = false;
    } catch (e) {
      const usingCloud = !AI.loadConfig();
      output.innerHTML =
        `<p style="color:var(--a-text)">生成失败:${esc(e.message ?? e)}</p>` +
        (usingCloud
          ? `<p style="color:var(--muted);font-size:0.85rem">免密钥模式由 WorkBuddy 云服务提供;若持续失败,可展开「使用我自己的 API Key」切换到你自己的服务商,或稍后重试。</p>`
          : `<p style="color:var(--muted);font-size:0.85rem">常见原因:Key 无效 / 模型名不对 / 该服务商不允许浏览器跨域调用(CORS)。可点"修改配置"更换服务商或填写自建中转地址。</p>`);
    } finally {
      btn.disabled = false;
      btn.textContent = btnLabel;
    }
  };

  const renderForm = (note) => {
    configArea.innerHTML =
      (note ? `<p id="ai-fallback-note" style="font-size:0.85rem;color:var(--muted);margin:1rem 0;line-height:1.8">${note}</p>` : "") +
      configFormHtml(AI.loadConfig());
    const presetSel = configArea.querySelector("#ai-preset");
    const baseInp = configArea.querySelector("#ai-base");
    const modelInp = configArea.querySelector("#ai-model");
    presetSel.addEventListener("change", () => {
      const p = AI.PRESETS[presetSel.value];
      if (p) { baseInp.value = p.base; modelInp.value = p.model; }
    });
    configArea.querySelector("#ai-save").addEventListener("click", () => {
      const key = configArea.querySelector("#ai-key").value.trim();
      const cfg = AI.loadConfig() ?? {};
      const presetChanged = cfg.preset !== presetSel.value;
      const effectiveKey = key || (presetChanged ? "" : cfg.key || "");
      if (!effectiveKey) {
        alert(presetChanged ? "切换了服务商,请填写该服务商的 API Key" : "请填写 API Key");
        return;
      }
      const next = {
        preset: presetSel.value,
        base: baseInp.value.trim(),
        model: modelInp.value.trim(),
        key: effectiveKey,
      };
      if (!next.base) { alert("请填写接口地址"); return; }
      AI.saveConfig(next);
      configArea.innerHTML = readyRowHtml(next);
      bindReady(next);
    });
  };

  // 云服务探测:成功即接通按钮;失败且访客没有自带 Key 时显式回退 BYOK 表单
  const wireCloud = () => {
    const btn = configArea.querySelector("#ai-generate-cloud");
    if (!btn) return;
    const status = configArea.querySelector("#ai-cloud-status");
    AI.cloudStatus().then((st) => {
      if (st.ok) {
        btn.disabled = false;
        btn.textContent = "生成 AI 深度解读(免密钥)→";
        if (status) status.textContent = `已连接 · 模型:${st.modelName}`;
        btn.addEventListener("click", () => runGenerate(btn));
      } else {
        btn.disabled = true;
        btn.textContent = "云服务不可用";
        if (status) status.textContent = st.reason;
        if (!AI.loadConfig()) {
          renderForm(`云服务当前不可用(${esc(st.reason)}),已回退到自带 Key 模式——填写自己的 API Key 即可使用。`);
        }
      }
    });
  };

  const bindReady = (cfg) => {
    configArea.querySelector("#ai-edit")?.addEventListener("click", renderForm);
    configArea.querySelector("#ai-generate")?.addEventListener("click", (e) => runGenerate(e.currentTarget));
    configArea.querySelector("#ai-use-cloud")?.addEventListener("click", () => {
      AI.clearConfig();
      configArea.innerHTML = cloudReadyHtml();
      wireCloud();
    });
  };

  const sendChat = async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";
    const userEl = document.createElement("div");
    userEl.className = "chat-msg user";
    userEl.textContent = text;
    chatLog.appendChild(userEl);
    const botEl = document.createElement("div");
    botEl.className = "chat-msg assistant";
    botEl.innerHTML = `<span class="ai-cursor"></span>`;
    chatLog.appendChild(botEl);
    chatLog.scrollTop = chatLog.scrollHeight;
    const messages = [
      { role: "system", content: AI.buildChatSystemPrompt(r) },
      ...chatHistory,
      { role: "user", content: text },
    ];
    try {
      let lastChatFull = "";
      const full = await AI.streamChat(
        messages,
        (_d, f) => {
          lastChatFull = f;
          botEl.innerHTML = tinyMd(f) + `<span class="ai-cursor"></span>`;
          chatLog.scrollTop = chatLog.scrollHeight;
        },
        () => {
          if (!lastChatFull) botEl.innerHTML = `<p class="ai-thinking">模型思考中…<span class="ai-cursor"></span></p>`;
        }
      );
      botEl.innerHTML = tinyMd(full);
      chatHistory.push({ role: "user", content: text }, { role: "assistant", content: full });
    } catch (e) {
      botEl.innerHTML = `<span style="color:var(--a-text)">请求失败:${esc(e.message ?? e)}</span>`;
    }
  };

  app.querySelector("#chat-send").addEventListener("click", sendChat);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChat();
  });

  const cfg = AI.loadConfig();
  if (cfg) {
    bindReady(cfg);
    if (AI.cloudConfigured()) {
      // 探测成功才露出"改用免密钥 AI"(云不可用时不该诱导访客切过去)
      AI.cloudStatus().then((st) => {
        if (st.ok) configArea.querySelector("#ai-use-cloud")?.removeAttribute("hidden");
      });
    }
  } else if (AI.cloudConfigured()) {
    wireCloud();
  } else {
    renderForm();
  }
}

/** 极简 markdown 渲染(先转义再生成标签,防注入) */
function tinyMd(t) {
  const esc = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .split(/\n\n+/)
    .map((block) => {
      if (block.startsWith("### ")) return `<h4>${inline(block.slice(4))}</h4>`;
      if (block.startsWith("## ")) return `<h4>${inline(block.slice(3))}</h4>`;
      if (block.startsWith("# ")) return `<h4>${inline(block.slice(2))}</h4>`;
      const lines = block.split("\n");
      if (lines.every((l) => /^(-|\d+[.)])\s/.test(l.trim()))) {
        return `<p>${lines.map((l) => "· " + inline(l.trim().replace(/^(-|\d+[.)])\s*/, ""))).join("<br/>")}</p>`;
      }
      return `<p>${inline(block).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
  function inline(s) {
    return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }
}

/* ---------- 关于弹层 ---------- */

export function renderAboutModal() {
  const existing = document.querySelector(".modal-back");
  if (existing) existing.remove();
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal"><h2>关于本测评</h2>${ABOUT.join("")}
    <div class="close-row"><button class="btn btn-ghost">关闭</button></div></div>`;
  document.body.appendChild(back);
  back.addEventListener("click", (e) => {
    if (e.target === back || e.target.closest("button")) back.remove();
  });
}
