// comments.js — 同称号评论区(Supabase PostgREST 直连,免 SDK)
// 数据:sql/comments.sql + comments-v2.sql + comments-v3.sql(回复所需列,缺失自动降级)
// 审核:一级前端词表(常开)→ 二级 LLM(settings 表开关,Edge Function 托管 key,失败放行)
// 安全:内容一律 textContent 渲染防注入;写入受 RLS 长度约束 + 前端 30s 节流
// 身份:无登录。author_uid 是本地生成的持久标识,仅用于展示"这是我发的",不含身份信息
//
// 为什么不加载 @supabase/supabase-js:该 SDK 需从 CDN 下载,移动端常因 CDN 拦截/超时失败,
// 且 import() 的失败 Promise 会被缓存导致"重新加载"无效。这里改为直接 fetch PostgREST,
// 零外部依赖;实时性改由可见时轮询提供,失败可重试。
import { COMMENT_CONFIG } from "./data/comment-config.js";
import { findBannedWord } from "./data/banned-words.js";

const NICK_MAX = 24;
const CONTENT_MAX = 500;
const THROTTLE_MS = 30_000;
const REPLY_MAX = 300;
const FETCH_TIMEOUT_MS = 12_000;
const POLL_MS = 25_000;
const UID_KEY = "ps-uid";
const NICK_KEY = "ps-nick";

// 本地持久标识:同一浏览器内不变,用于标出"这是我发的"。换浏览器/清理数据即失效——
// 这是刻意取舍:不引入账号,以保证"无登录、数据不出浏览器"的隐私承诺完整。
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* 忽略 */ } }

function localUid() {
  let u = lsGet(UID_KEY);
  if (!u) {
    u = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    lsSet(UID_KEY, u);
  }
  return u;
}

function readNick() {
  return lsGet(NICK_KEY) || "";
}
function writeNick(v) {
  lsSet(NICK_KEY, v);
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

// PostgREST 请求:带 apikey 头 + 统一超时。任何一次失败都可安全重试(无缓存状态)
async function rest(path, { method = "GET", body, extraHeaders } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${COMMENT_CONFIG.supabaseUrl}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: COMMENT_CONFIG.supabaseAnonKey,
        Authorization: "Bearer " + COMMENT_CONFIG.supabaseAnonKey,
        ...(extraHeaders ?? {}),
      },
      ...(body !== undefined ? { body } : {}),
      signal: ctrl.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function renderComments(mount, title) {
  if (!mount || !isConfigured()) return;
  mount.hidden = false;
  mount.innerHTML = `
    <h2 class="comments-title">同为「${title}」的人</h2>
    <p class="comments-sub">测出同一称号的访客在这里留言互通。评论对所有人公开可见,请勿留下个人身份信息;不当内容会被移除。</p>
    <div class="comment-form">
      <input class="comment-nick" maxlength="${NICK_MAX}" placeholder="昵称(留空则显示 匿名访客)" value="${escAttr(readNick())}" />
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
  nickEl.addEventListener("change", () => writeNick(nickEl.value.trim()));

  const showMsg = (t) => { msgEl.textContent = t; msgEl.hidden = false; };
  const hideMsg = () => { msgEl.hidden = true; };
  const currentNick = () => nickEl.value.trim() || readNick() || "匿名访客";

  // 表若还没跑 comments-v3.sql,自动降级为不含回复的形态(评论区其余功能照常)
  let replySupported = true;
  const baseFields = () => (replySupported ? "id,nickname,content,created_at,parent_id,author_uid" : "id,nickname,content,created_at");

  async function fetchComments() {
    const q = `comments?select=${baseFields()}&title=eq.${encodeURIComponent(title)}&order=created_at.desc&limit=200`;
    const res = await rest(q);
    if (replySupported && res.status === 400) {
      // 多半是缺 parent_id/author_uid 列 —— 降级重试一次
      replySupported = false;
      return fetchComments();
    }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  /* ---------- 渲染 ---------- */

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // 单条评论(主/回复共用);主评论支持回复,回复只做展示(保持一层,避免深层嵌套难读)
  const rowEl = (c, opts = {}) => {
    const item = el("div", "comment-item" + (opts.reply ? " comment-reply" : ""));
    if (c.id != null) item.dataset.cid = String(c.id);
    const head = el("div", "comment-head");
    head.append(el("b", null, c.nickname || "匿名访客"));
    if (replySupported && c.author_uid && c.author_uid === localUid()) {
      head.append(el("span", "comment-mine", "我"));
    }
    head.append(el("span", "comment-time", relTime(c.created_at)));
    if (opts.replyTo) head.append(el("span", "comment-replyto", "回复 " + opts.replyTo));
    const body = el("p", "comment-body");
    body.textContent = c.content;
    item.append(head, body);

    if (!opts.reply && replySupported) {
      const foot = el("div", "comment-foot");
      const btn = el("button", "comment-reply-btn", "回复");
      btn.type = "button";
      btn.addEventListener("click", () => toggleReplyBox(item, c));
      foot.append(btn);
      item.append(foot);
    }
    return item;
  };

  const renderList = (rows) => {
    listEl.innerHTML = "";
    if (!rows.length) {
      listEl.append(el("div", "comment-empty", "还没有人留言——成为第一个吧。"));
      return;
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    const roots = rows.filter((r) => !r.parent_id || !byId.has(r.parent_id));
    const kids = new Map();
    rows
      .filter((r) => r.parent_id && byId.has(r.parent_id))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .forEach((r) => {
        if (!kids.has(r.parent_id)) kids.set(r.parent_id, []);
        kids.get(r.parent_id).push(r);
      });
    const frag = document.createDocumentFragment();
    roots.forEach((r) => {
      const children = kids.get(r.id) ?? [];
      const wrap = el("div", "comment-thread");
      wrap.append(rowEl(r));
      children.forEach((k) => wrap.append(rowEl(k, { reply: true, replyTo: r.nickname || "匿名访客" })));
      frag.append(wrap);
    });
    listEl.append(frag);
  };

  /* ---------- 回复框(内联展开) ---------- */

  function toggleReplyBox(itemEl, parent) {
    const existing = itemEl.parentElement?.querySelector(":scope > .reply-box");
    if (existing) { existing.remove(); return; }
    // 关闭其他已展开的回复框,页面上只留一个
    listEl.querySelectorAll(".reply-box").forEach((n) => n.remove());

    const box = el("div", "reply-box");
    const ta = el("textarea");
    ta.rows = 2;
    ta.maxLength = REPLY_MAX;
    ta.placeholder = `回复 ${parent.nickname || "匿名访客"}……`;
    const foot = el("div", "reply-foot");
    const count = el("span", "comment-count", `0/${REPLY_MAX}`);
    const send = el("button", "btn", "回复");
    const cancel = el("button", "btn btn-ghost", "取消");
    ta.addEventListener("input", () => (count.textContent = ta.value.length + "/" + REPLY_MAX));
    cancel.addEventListener("click", () => box.remove());
    send.addEventListener("click", async () => {
      const text = ta.value.trim();
      if (!text) return;
      send.disabled = true;
      send.textContent = "发送中…";
      try {
        await submit({ content: text, parentId: parent.id });
        box.remove();
        hideMsg();
      } catch (e) {
        showMsg(friendly(e));
      } finally {
        send.disabled = false;
        send.textContent = "回复";
      }
    });
    foot.append(count, cancel, send);
    box.append(ta, foot);
    itemEl.after(box);
    ta.focus();
  }

  /* ---------- 加载 / 失败 / 重试 ---------- */

  const renderLoadError = () => {
    listEl.innerHTML = "";
    const box = el("div", "comment-empty");
    box.append(document.createTextNode("评论没能加载出来——多半是网络波动,稍等一下可以重试。"));
    const retry = el("button", "btn btn-ghost", "重新加载");
    retry.id = "comment-retry";
    retry.addEventListener("click", () => {
      retry.disabled = true;
      retry.textContent = "加载中……";
      loadList();
    });
    box.append(retry);
    listEl.append(box);
    btnEl.disabled = true;
    showMsg("评论区服务暂不可用,发布已暂停;其他功能不受影响。");
  };

  async function loadList() {
    try {
      const rows = await fetchComments();
      hideMsg();
      btnEl.disabled = false;
      renderList(Array.isArray(rows) ? rows : []);
      startPolling();
    } catch {
      renderLoadError();
    }
  }

  // 可见时轻量轮询,替代需要 SDK 的 websocket 实时订阅;页面隐藏时不浪费请求
  let pollTimer = null;
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      if (document.hidden) return;
      // 用户正在输入或展开回复框时不重绘,避免打断
      if (document.activeElement === inputEl) return;
      if (listEl.querySelector(".reply-box textarea") === document.activeElement) return;
      try {
        const rows = await fetchComments();
        if (!Array.isArray(rows)) return;
        // 数量不同或内容摘要变化才重绘
        const sig = rows.map((r) => r.id).join(",");
        if (sig !== lastSig) { lastSig = sig; renderList(rows); }
      } catch { /* 轮询失败静默,不打断已渲染的内容 */ }
    }, POLL_MS);
  }
  let lastSig = "";

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  });

  /* ---------- 发布(主评论与回复共用) ---------- */

  async function submit({ content, parentId = null }) {
    const last = +(lsGet("ps-last-comment-at") ?? 0);
    if (Date.now() - last < THROTTLE_MS) {
      throw new Error("发布太频繁了,休息 " + Math.ceil((THROTTLE_MS - (Date.now() - last)) / 1000) + " 秒再试。");
    }
    const hit = findBannedWord(content);
    if (hit) throw new Error("内容包含不允许的表述,请修改后再发布。");

    let llmOn = false;
    try {
      const res = await rest(`settings?select=value&key=eq.llm_moderation`, { extraHeaders: { Accept: "application/json" } });
      if (res.ok) {
        const arr = await res.json();
        // 开关缺失默认关闭(倾向零成本:一级词表仍在拦)
        llmOn = String(arr?.[0]?.value ?? "").toLowerCase() === "on";
      }
    } catch { llmOn = false; }

    if (llmOn && COMMENT_CONFIG.moderateUrl) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(COMMENT_CONFIG.moderateUrl, {
          method: "POST",
          // 简单请求(text/plain,无自定义头):不触发 CORS 预检——Supabase 网关会吞掉
          // 预检导致浏览器直接报错。verify_jwt 已关,无需带密钥头;函数端按 JSON 解析 body。
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ content, nickname: currentNick() }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        const j = await res.json().catch(() => ({}));
        if (j && j.ok === false) throw new Error("内容未通过安全检查,请修改后再发布。");
        // 超时 / 报错 / LLM 不可用 → 放行(站长可全盘扫描复查)
      } catch (e) {
        if (e instanceof Error && /未通过安全检查|Content-Type/.test(e.message)) throw e;
        /* 其余情况放行 */
      }
    }

    const payload = {
      title,
      nickname: currentNick(),
      content,
      author_uid: replySupported ? localUid() : undefined,
      parent_id: replySupported && parentId ? parentId : undefined,
    };
    const build = (p) => {
      const o = { title: p.title, nickname: p.nickname, content: p.content };
      if (p.author_uid !== undefined) o.author_uid = p.author_uid;
      if (p.parent_id !== undefined) o.parent_id = p.parent_id;
      return o;
    };
    let res = await rest("comments", {
      method: "POST",
      body: JSON.stringify(build(payload)),
      extraHeaders: { "Content-Type": "application/json", Prefer: "return=minimal" },
    });
    if (replySupported && res.status === 400) {
      // 缺列 → 降级后重发(丢掉回复语义,作为主评论保留)
      replySupported = false;
      res = await rest("comments", {
        method: "POST",
        body: JSON.stringify(build({ ...payload, author_uid: undefined, parent_id: undefined })),
        extraHeaders: { "Content-Type": "application/json", Prefer: "return=minimal" },
      });
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 403 || /row-level security/i.test(detail)) throw new Error("内容或昵称超出长度限制。");
      if (res.status === 409 && /foreign key/i.test(detail)) throw new Error("要回复的那条评论已经被删除了。");
      throw new Error("发布失败(HTTP " + res.status + ")");
    }
    lsSet("ps-last-comment-at", String(Date.now()));
    // 刷新列表让用户看到自己的发言
    try {
      const rows = await fetchComments();
      lastSig = rows.map((r) => r.id).join(",");
      renderList(rows);
    } catch { /* 刷新失败不视为发布失败 */ }
  }

  btnEl.addEventListener("click", async () => {
    hideMsg();
    const content = inputEl.value.trim();
    if (!content) { showMsg("写点内容再发布吧。"); return; }
    btnEl.disabled = true;
    const label = btnEl.textContent;
    btnEl.textContent = "发送中…";
    try {
      await submit({ content });
      inputEl.value = "";
      countEl.textContent = "0/" + CONTENT_MAX;
    } catch (e) {
      showMsg(friendly(e));
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = label;
    }
  });

  await loadList();
}

function friendly(e) {
  const m = String(e?.message ?? e);
  if (/aborted/i.test(m)) return "网络超时了,换个网络再试一次。";
  return m;
}

function escAttr(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
