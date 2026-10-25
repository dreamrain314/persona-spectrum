// main.js — 状态机与流程编排
import { ITEMS } from "./data/items.js";
import { renderAboutModal } from "./ui.js";
import {
  renderLanding, renderSetup, renderSelfRating,
  renderQuiz, renderComputing, renderReport,
} from "./ui.js";

const state = {
  screen: "landing",
  mode: null,          // "short" | "full"
  items: [],           // 当前模式使用的题目
  selfRatings: null,   // {O:50, C:50, E:50, A:50, N:50}
  answers: {},         // { num: { v, ms, edits } }
  index: 0,
  results: null,       // engine.computeAll 输出
  startedAt: null,
  viewingHistory: null, // 非空表示正在回看历史报告(值为记录日期)
};

const app = document.getElementById("app");
const screens = { landing: renderLanding, setup: renderSetup, self: renderSelfRating, quiz: renderQuiz, computing: renderComputing, report: renderReport };

function go(screen) {
  state.screen = screen;
  window.scrollTo({ top: 0 });
  screens[screen](app, state, handlers);
}

const handlers = {
  begin() { go("setup"); },
  chooseMode(mode) {
    state.mode = mode;
    state.items = mode === "short" ? ITEMS.filter((i) => i.short) : ITEMS.slice();
    state.answers = {};
    state.index = 0;
    state.startedAt = Date.now();
    go("self");
  },
  confirmSelfRating(ratings) {
    state.selfRatings = ratings;
    go("quiz");
  },
  answer(v, ms) {
    const item = state.items[state.index];
    const prev = state.answers[item.num];
    state.answers[item.num] = {
      v,
      ms,
      edits: prev ? prev.edits + 1 : 0,
    };
    const btns = document.querySelectorAll(".opt");
    btns.forEach((b) => b.classList.toggle("picked", +b.dataset.v === v));
    setTimeout(() => {
      if (state.index < state.items.length - 1) {
        state.index += 1;
        go("quiz");
      } else {
        go("computing");
        // 过渡动画后计算并出报告(计算本身是同步毫秒级,延迟纯为节奏)
        import("./engine.js").then(({ computeAll }) => {
          setTimeout(() => {
            state.results = computeAll(state);
            saveHistory(state);
            go("report");
          }, 1600);
        });
      }
    }, 320);
  },
  prevQuestion() {
    if (state.index > 0) {
      state.index -= 1;
      go("quiz");
    }
  },
  nextQuestion() {
    const next = state.items[state.index + 1];
    if (!next) return;
    let frontier = state.items.findIndex((it) => state.answers[it.num] == null);
    if (frontier === -1) frontier = state.items.length;
    if (state.index + 1 <= frontier) {
      state.index += 1;
      go("quiz");
    }
  },
  restart() {
    state.mode = null; state.items = []; state.answers = {};
    state.index = 0; state.results = null; state.selfRatings = null;
    state.viewingHistory = null;
    go("landing");
  },
  viewHistory,
};

// 「关于量表」全局入口(页眉)
document.querySelector("[data-action='about']").addEventListener("click", () => {
  renderAboutModal();
});

// 答题键盘快捷键 1-5 / ←
document.addEventListener("keydown", (e) => {
  if (state.screen !== "quiz") return;
  const cur = state.items[state.index];
  const rec = state.answers[cur?.num];
  if (e.key >= "1" && e.key <= "5") {
    const btn = document.querySelector(`.opt[data-v='${e.key}']`);
    if (btn && !btn.disabled) btn.click();
  } else if (e.key === "ArrowLeft") {
    handlers.prevQuestion();
  } else if (e.key === "ArrowRight") {
    handlers.nextQuestion();
  }
});

function saveHistory(s) {
  const entry = {
    date: new Date().toISOString(),
    mode: s.mode,
    title: s.results?.title ?? "",
    motto: s.results?.motto ?? "",
    percentiles: s.results?.domainPcts ?? {},
    snapshot: {
      mode: s.mode,
      items: s.items.map((i) => i.num),
      selfRatings: s.selfRatings,
      answers: s.answers,
      results: s.results,
    },
  };
  const key = "ps-history";
  const read = () => { try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; } };
  const write = (rows) => localStorage.setItem(key, JSON.stringify(rows.slice(0, 5)));
  try {
    const hist = read();
    hist.unshift(entry);
    write(hist);
  } catch {
    // localStorage 写满/隐私模式:降级为仅摘要(不带快照),测评主流程不受影响
    try {
      const slim = { ...entry };
      delete slim.snapshot;
      const hist = read();
      hist.unshift(slim);
      write(hist);
    } catch { /* 彻底不可用,放弃记录 */ }
  }
}

// 从历史记录完整回看:localStorage 快照 → 重建 state → 直接进报告
function viewHistory(idx) {
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem("ps-history") ?? "[]"); } catch { return; }
  const entry = hist[idx];
  if (!entry) return;
  const snap = entry.snapshot;
  if (!snap?.results) {
    alert("这条是早期版本存的记录,只留有摘要,看不了完整报告——重新测一次就有了。");
    return;
  }
  state.mode = snap.mode;
  state.items = snap.mode === "short" ? ITEMS.filter((i) => i.short) : ITEMS.slice();
  state.answers = snap.answers ?? {};
  state.selfRatings = snap.selfRatings ?? null;
  state.results = snap.results;
  state.viewingHistory = entry.date ?? null;
  state.index = Math.max(0, state.items.findIndex((it) => state.answers[it.num] == null));
  go("report");
}

go("landing");
