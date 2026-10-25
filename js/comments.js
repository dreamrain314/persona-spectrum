// comments.js — 同称号评论区(Supabase,免后端)
// 数据:sql/comments.sql + comments-v2.sql;配置:js/data/comment-config.js
// 审核:一级前端词表(常开)→ 二级 LLM(settings 表开关,Edge Function 托管 key,失败放行)
// 安全:内容一律 textContent 渲染防注入;写入受 RLS 长度约束 + 前端 30s 节流
import { COMMENT_CONFIG } from "./data/comment-config.js";
import { findBannedWord } from "./data/banned-words.js";

const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const NICK_MAX = 24;
const CONTENT_MAX = 500;
const THROTTLE_MS = 30_000;
let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    clientPromise = import(SDK_URL).then(({ createClient }) =>
      createClient(COMMENT_CONFIG.supabaseUrl, COMMENT_CONFIG.supabaseAnonKey)
    );
  }
  return clientPromise;
}

function isConfigured() {
  return !!(COMMENT_CONFIG.enabled && COMMENT_CONFIG.supabaseUrl && COMMENT_CONFIG.supabaseAnonKey);
}

function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return min + " 分钟前";
  const h = Math.floor(min / 60);
  if (h < 24) return h + " 小时前";
  const d = Math.floor(h / 24);
  if (d < 30) return d + " 天前";
  return new Date(iso).toLocaleDateString("zh-CN");
}

export async function renderComments(mount, title) {
  if (!mount || !isConfigured()) return;
  mount.hidden = false;
  mount.innerHTML = `
    <h2 class="comments-title">同为「${title}」的人</h2>
    <p class="comments-sub">测出同一称号的访客在这里留言互通,新评论实时刷新。评论对所有人公开可见,请勿留下个人身份信息;不当内容会被移除。</p>
    <div class="comment-form">
      <input class="comment-nick" maxlength="${NICK_MAX}" placeholder="昵称(留空则显示 匿名访客)" />
      <textarea class="comment-input" maxlength="${CONTENT_MAX}" rows="3" placeholder="和同标签的人说点什么……"></textarea>
      <div class="comment-form-foot">
        <span class="comment-count">0/${CONTENT_MAX}</span>
        <button class="btn comment-submit">发布</button>
      </div>
    </div>
    <div class="comment-msg" hidden></div>
    <div class="comment-list"><div class="comment-empty">加载中……</div></div>`;

  const $ = (sel) => mount.querySelector(sel);
  const listEl = $(".comment-list");
  const msgEl = $(".comment-msg");
  const inputEl = $(".comment-input");
  const nickEl = $(".comment-nick");
  const countEl = $(".comment-count");
  const btnEl = $(".comment-submit");
  inputEl.addEventListener("input", () => (countEl.textContent = inputEl.value.length + "/" + CONTENT_MAX));

  const showMsg = (t) => { msgEl.textContent = t; msgEl.hidden = false; };
  const hideMsg = () => { msgEl.hidden = true; };

  const rowEl = (c) => {
    const item = document.createElement("div");
    item.className = "comment-item";
    if (c.id != null) item.dataset.cid = String(c.id);
    const head = document.createElement("div");
    head.className = "comment-head";
    const nick = document.createElement("b");
    nick.textContent = c.nickname || "匿名访客";
    const time = document.createElement("span");
    time.className = "comment-time";
    time.textContent = relTime(c.created_at);
    head.append(nick, time);
    const body = document.createElement("p");
    body.className = "comment-body";
    body.textContent = c.content;
    item.append(head, body);
    return item;
  };

  const renderList = (rows) => {
    listEl.innerHTML = "";
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "comment-empty";
      empty.textContent = "还没有人留言——成为第一个吧。";
      listEl.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    rows.forEach((c) => frag.appendChild(rowEl(c)));
    listEl.appendChild(frag);
  };

  let client = null;
  try {
    client = await getClient();
    const { data, error } = await client
      .from("comments")
      .select("id,nickname,content,created_at")
      .eq("title", title)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    renderList(data ?? []);
  } catch {
    listEl.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "comment-empty";
    empty.textContent = "评论区暂时无法加载,请稍后再试。";
    listEl.appendChild(empty);
    return;
  }

  // 实时接收新评论(真实 Supabase 环境;本地预览 mock 无 websocket,静默跳过)
  try {
    if (/supabase\.(co|com|net)$/.test(new URL(COMMENT_CONFIG.supabaseUrl).hostname)) {
      client
        .channel("comments-" + title)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "comments", filter: "title=eq." + title },
          (payload) => {
            const row = payload?.new;
            if (!row) return;
            if (row.id != null && listEl.querySelector(`[data-cid='${row.id}']`)) return;
            const empty = listEl.querySelector(".comment-empty");
            if (empty) empty.remove();
            listEl.prepend(rowEl(row));
          }
        )
        .subscribe();
    }
  } catch { /* 实时不可用不影响基础功能 */ }

  btnEl.addEventListener("click", async () => {
    hideMsg();
    const content = inputEl.value.trim();
    if (!content) { showMsg("写点内容再发布吧。"); return; }
    const last = +(localStorage.getItem("ps-last-comment-at") ?? 0);
    if (Date.now() - last < THROTTLE_MS) {
      showMsg("发布太频繁了,休息 " + Math.ceil((THROTTLE_MS - (Date.now() - last)) / 1000) + " 秒再试。");
      return;
    }
    // 一级审核:本地词表(常开,零成本)
    const hit = findBannedWord(content);
    if (hit) {
      showMsg("内容包含不允许的表述,请修改后再发布。");
      return;
    }
    btnEl.disabled = true;
    try {
      // 二级审核:LLM 语义审核(站长经 settings 表开关;超时/失败放行)
      let llmOn = false;
      if (COMMENT_CONFIG.moderateUrl) {
        try {
          const { data: s } = await client
            .from("settings")
            .select("value")
            .eq("key", "llm_moderation")
            .single();
          llmOn = String(s?.value ?? "").toLowerCase() === "on";
        } catch { llmOn = false; }
      }
      if (llmOn) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 6000);
          const res = await fetch(COMMENT_CONFIG.moderateUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, nickname: nickEl.value.trim() || "匿名访客" }),
            signal: ctrl.signal,
          });
          clearTimeout(timer);
          const j = await res.json().catch(() => ({}));
          if (j && j.ok === false && !j.suspect) {
            showMsg("内容未通过安全检查,请修改后再发布。");
            return;
          }
          // suspect / 超时 / 报错 → 放行(站长可在后台复查)
        } catch { /* LLM 不可用 → 放行 */ }
      }
      const { error } = await client.from("comments").insert({
        title,
        nickname: nickEl.value.trim() || "匿名访客",
        content,
      });
      if (error) throw error;
      localStorage.setItem("ps-last-comment-at", String(Date.now()));
      inputEl.value = "";
      countEl.textContent = "0/" + CONTENT_MAX;
      const { data, error: err2 } = await client
        .from("comments")
        .select("id,nickname,content,created_at")
        .eq("title", title)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!err2) renderList(data ?? []);
    } catch (e) {
      const code = String(e?.code ?? "");
      showMsg(
        code === "23514" || String(e?.message ?? "").includes("row-level security")
          ? "内容或昵称超出长度限制。"
          : "发布失败:" + String(e?.message ?? e)
      );
    } finally {
      btnEl.disabled = false;
    }
  });
}
