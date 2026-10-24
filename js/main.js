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
  restart() {
    state.mode = null; state.items = []; state.answers = {};
    state.index = 0; state.results = null; state.selfRatings = null;
    go("landing");
  },
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
  } else if (e.key === "ArrowLeft" && rec) {
    handlers.prevQuestion();
  }
});

function saveHistory(s) {
  try {
    const key = "ps-history";
    const hist = JSON.parse(localStorage.getItem(key) ?? "[]");
    hist.unshift({
      date: new Date().toISOString(),
      mode: s.mode,
      title: s.results?.title ?? "",
      motto: s.results?.motto ?? "",
      percentiles: s.results?.domainPcts ?? {},
    });
    localStorage.setItem(key, JSON.stringify(hist.slice(0, 5)));
  } catch { /* 隐私模式下静默跳过 */ }
}

go("landing");
