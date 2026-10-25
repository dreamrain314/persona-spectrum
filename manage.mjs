#!/usr/bin/env node
// 站长管理脚本 — 评论区 LLM 全盘扫描与查看
// 用法:
//   node manage.mjs scan   全盘 LLM 扫描,结果写回 comments.llm_flag(ok/violation/suspect)
//   node manage.mjs list   列出 violation / suspect 的评论(供 Table Editor 删除参考)
// 凭据:同目录 secret.json(复制 secret.example.json 填写;该文件已被 .gitignore 排除)
//   {
//     "supabaseUrl": "https://xxxx.supabase.co",
//     "readKey":     "publishable key(评论对匿名可读,list 用;非 secret)",
//     "moderateUrl": "https://xxxx.supabase.co/functions/v1/moderate",
//     "adminToken":  "你设置在 Edge Function Secrets 里的 ADMIN_TOKEN"
//   }

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
let secret;
try {
  secret = JSON.parse(readFileSync(join(here, "secret.json"), "utf8"));
} catch {
  console.error("缺少 secret.json — 复制 secret.example.json 填好后再运行。");
  process.exit(1);
}

const cmd = process.argv[2] ?? "";
const headers = { "Content-Type": "application/json", apikey: secret.readKey, Authorization: "Bearer " + secret.readKey };

if (cmd === "scan") {
  const res = await fetch(secret.moderateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": secret.adminToken },
    body: JSON.stringify({ mode: "scan" }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("扫描失败:", JSON.stringify(j));
    process.exit(1);
  }
  console.log(`扫描完成:共 ${j.scanned} 条,violation ${j.violation} 条,suspect ${j.suspect} 条。`);
  console.log("在 Supabase → Table Editor → comments 按 llm_flag 筛选查看与删除。");
} else if (cmd === "list") {
  const res = await fetch(
    secret.supabaseUrl.replace(/\/$/, "") + "/rest/v1/comments?select=id,title,nickname,content,llm_flag&llm_flag=in.(violation,suspect)&order=id.asc",
    { headers },
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return console.log("没有 violation / suspect 评论。");
  for (const r of rows) console.log(`#${r.id} [${r.llm_flag}] ${r.title} | ${r.nickname}: ${r.content}`);
} else {
  console.log("用法:node manage.mjs <scan|list>");
}
