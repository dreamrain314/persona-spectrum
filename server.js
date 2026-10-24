#!/usr/bin/env node
// server.js — 人格光谱本地服务器
// 静态文件 + AI 接口同源代理(解决智谱等不允许浏览器跨域 CORS 的服务商)
// 用法:node server.js [port]   默认 8082,要求 Node 18+
// 代理端点:POST /api/ai/chat/completions,请求头 X-AI-Base 指定上游 base(仅白名单域名)

const http = require("http");
const { readFile, stat } = require("fs/promises");
const path = require("path");
const { Readable } = require("stream");

const ROOT = __dirname;
const PORT = Number(process.argv[2] ?? 8082);
const ALLOWED_HOSTS = new Set([
  "open.bigmodel.cn",
  "api.bigmodel.cn",
  "api.z.ai",
  "api.deepseek.com",
  "api.openai.com",
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

if (typeof fetch !== "function" || !Readable.fromWeb) {
  console.error("需要 Node 18 或更高版本(当前 " + process.version + ")");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url ?? "/").split("?")[0];

  // ---- AI 代理 ----
  if (req.method === "POST" && urlPath === "/api/ai/chat/completions") {
    const base = String(req.headers["x-ai-base"] ?? "");
    let target;
    try {
      target = new URL(base.replace(/\/+$/, "") + "/chat/completions");
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end('{"error":{"message":"invalid X-AI-Base header"}}');
    }
    if (!ALLOWED_HOSTS.has(target.hostname)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end('{"error":{"message":"upstream host not allowed: ' + target.hostname + '"}}');
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    let upstream;
    try {
      upstream = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: String(req.headers["authorization"] ?? ""),
        },
        body,
      });
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      return res.end('{"error":{"message":"upstream unreachable: ' + e.message + '"}}');
    }
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream",
      "Cache-Control": "no-cache",
    });
    if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);
    else res.end();
    return;
  }

  // ---- 静态文件 ----
  let p = urlPath === "/" ? "/index.html" : urlPath;
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  try {
    const st = await stat(file);
    if (st.isDirectory()) throw new Error("dir");
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("not found");
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(500);
    res.end("read error");
  }
});

server.listen(PORT, () => {
  console.log("persona-spectrum → http://127.0.0.1:" + PORT + "  (AI 同源代理已就绪)");
});
