// Supabase Edge Function: moderate
// 部署方式:Supabase Dashboard → Edge Functions → Create → 粘贴本文件 → 部署
// Secrets 设置(Supabase CLI 或 Dashboard → Edge Functions → 该函数 → Secrets):
//   GLM_API_KEY   智谱 API Key(站长所有,绝不暴露给前端)
//   GLM_MODEL     审核模型(默认 glm-4-flash:免费、非推理、1-2s)
//   ADMIN_TOKEN   管理口令(随机长字符串,只配本地 manage 脚本使用)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由平台自动注入,无需手配。
//
// 职责:
//   1. 单条审核:POST { content } → { ok, reason }  前端发布时调用(LLM 开关在 settings 表)
//   2. 全盘扫描:POST { mode: "scan" } + x-admin-token → 逐条审核写回 comments.llm_flag
//      ('ok' | 'violation' | 'suspect'),站长在 Table Editor 按该列筛选管理

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* 空体按单条空内容处理 */ }

  if (body.mode === "scan") return scan(req);

  const content = String(body.content ?? "").slice(0, 500);
  if (!content) return json({ ok: true }, 200);
  const v = await judge(content);
  // 单条审核:明确违规(ok===false)即拦;suspect 仅在 scan 模式做人工复核分诊
  return json({ ok: v.ok !== false, reason: v.reason ?? "" }, 200);
});

async function scan(req: Request): Promise<Response> {
  const admin = req.headers.get("x-admin-token");
  if (!admin || admin !== (Deno.env.get("ADMIN_TOKEN") ?? "")) {
    return json({ error: "unauthorized" }, 401);
  }
  const S_URL = Deno.env.get("SUPABASE_URL")!;
  const S_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const rows: Array<{ id: number; content: string }> = [];
  let from = 0;
  for (;;) {
    const r = await fetch(
      `${S_URL}/rest/v1/comments?select=id,content&order=id.asc&limit=100&offset=${from}`,
      { headers: { apikey: S_KEY, Authorization: `Bearer ${S_KEY}` } },
    );
    const page = await r.json();
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    if (page.length < 100) break;
    from += 100;
    if (from > 5000) break; // 安全上限
  }

  let violation = 0, suspect = 0;
  for (const row of rows) {
    const v = await judge(String(row.content ?? ""));
    const flag = v.ok === false ? (v.suspect ? "suspect" : "violation") : "ok";
    if (flag === "violation") violation++;
    if (flag === "suspect") suspect++;
    await fetch(`${S_URL}/rest/v1/comments?id=eq.${row.id}`, {
      method: "PATCH",
      headers: {
        apikey: S_KEY,
        Authorization: `Bearer ${S_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ llm_flag: flag }),
    });
  }
  return json({ scanned: rows.length, violation, suspect }, 200);
}

/** 调 GLM 做语义审核;任何失败都放行(ok:true) */
async function judge(content: string): Promise<{ ok: boolean; suspect?: boolean; reason?: string }> {
  const key = Deno.env.get("GLM_API_KEY");
  if (!key) return { ok: true };
  try {
    const res = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: Deno.env.get("GLM_MODEL") ?? "glm-4-flash",
        messages: [
          {
            role: "system",
            content:
              "你是评论区内容安全审核员。判断评论是否包含:辱骂人身攻击、色情低俗、政治敏感、广告引流或诈骗。宽松标准:负面情绪、吐槽、口头禅都不算违规。只输出一个 JSON 对象:{\"ok\":true} 或 {\"ok\":false,\"reason\":\"简短原因\"};suspect 仅在语义高度模糊难以判定时设为 true(如反讽),明确的违规直接 ok:false。",
          },
          { role: "user", content: "评论:" + content },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });
    const j = await res.json();
    const text = j?.choices?.[0]?.message?.content ?? "";
    const m = text.match(/\{[\s\S]*?\}/);
    if (!m) return { ok: true };
    const parsed = JSON.parse(m[0]);
    return { ok: parsed.ok !== false, suspect: !!parsed.suspect, reason: parsed.reason ?? "" };
  } catch {
    return { ok: true };
  }
}

function json(obj: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extra },
  });
}
