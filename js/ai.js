// ai.js — BYOK(自带 Key)AI 深度解读层
// 访客可选配置 OpenAI 兼容接口;Key 仅存于 localStorage,不发送到任何第三方(含本站后端,本站无后端)。

export const PRESETS = {
  zhipu:   { label: "智谱 BigModel(浏览器直连被 CORS 拦,需本地模式)", base: "https://open.bigmodel.cn/api/paas/v4", model: "glm-5.3-flash" },
  deepseek:{ label: "DeepSeek(支持浏览器直连)",  base: "https://api.deepseek.com",             model: "deepseek-chat" },
  openai:  { label: "OpenAI(支持浏览器直连)",    base: "https://api.openai.com/v1",            model: "gpt-4o-mini" },
  custom:  { label: "自定义(OpenAI 兼容)",       base: "", model: "" },
};

const CFG_KEY = "ps-ai-config";

export function loadConfig() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export function saveConfig(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

class ApiError extends Error {
  constructor(status, detail) {
    super(`接口返回 ${status}:${detail.slice(0, 200)}`);
    this.status = status;
  }
}

/**
 * 流式对话(OpenAI 兼容 /chat/completions)。
 * 直连被 CORS 拦截时自动回落到本地代理(node server.js 的 /api/ai)。
 * 推理模型(如 GLM-5.3-Flash)的思考增量通过 onThinking 回调,不计入正文。
 * @param {Array<{role:string,content:string}>} messages
 * @param {Function} onDelta(delta, full) 正文增量
 * @param {Function} [onThinking] 思考中信号(收到 reasoning 增量时调用)
 * @returns {Promise<string>} 完整正文
 */
export async function streamChat(messages, onDelta, onThinking) {
  const cfg = loadConfig();
  if (!cfg?.key || !cfg.base) throw new Error("请先填写并保存 API 配置");

  const payload = JSON.stringify({
    model: cfg.model || "glm-5.3-flash",
    messages,
    stream: true,
    temperature: 0.7,
  });

  const runStream = async (url, headers) => {
    const res = await fetch(url, { method: "POST", headers, body: payload });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 401) {
        throw new ApiError(401, "Key 无效或与所选服务商不匹配(注意:每家服务商的 Key 不通用,切换服务商后需重新填写)");
      }
      throw new ApiError(res.status, detail);
    }
    if (!res.body) return "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "", full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") continue;
        try {
          const json = JSON.parse(dataStr);
          const delta = json.choices?.[0]?.delta ?? {};
          if (delta.reasoning_content) onThinking?.(delta.reasoning_content, false);
          if (delta.content) {
            full += delta.content;
            onDelta(delta.content, full);
          }
        } catch { /* 半行残包,下一轮补齐 */ }
      }
    }
    return full;
  };

  const directUrl = cfg.base.replace(/\/+$/, "") + "/chat/completions";
  const authHeaders = { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key };

  try {
    return await runStream(directUrl, authHeaders);
  } catch (e) {
    // 业务错误(key/模型名等)直接抛,回落没有意义
    if (!(e instanceof TypeError)) throw e;
    // 网络层失败:大概率是服务商不允许浏览器跨域。尝试本地代理(相对路径,兼容子路径部署)。
    try {
      const out = await runStream("api/ai/chat/completions", { ...authHeaders, "X-AI-Base": cfg.base });
      onThinking?.("", true); // 代理成功信号
      return out;
    } catch (e2) {
      // 404/405/501 都是「这个环境没有代理」:本地纯静态服务返回 404/501,GitHub Pages 对 POST 返回 405
      const proxyMissing =
        e2 instanceof TypeError || (e2 instanceof ApiError && [404, 405, 501].includes(e2.status));
      if (proxyMissing) {
        throw new Error(
          "浏览器直连被服务商跨域策略(CORS)拦截,且当前页面没有可用的本地代理(线上静态托管如 GitHub Pages 不提供代理)。" +
          "解决办法:① 本地使用:在项目目录运行 node server.js 并通过它打开本页;② 线上使用:改用支持浏览器直连的服务商(DeepSeek / OpenAI);" +
          "③ 自建中转:在「自定义」里填写你自己部署的允许跨端的 OpenAI 兼容地址。"
        );
      }
      throw e2;
    }
  }
}

/**
 * 构造 AI 深度解读的首条 prompt(注入题目级作答证据)。
 */
export function buildInterpretationPrompt(state, results) {
  const dom = Object.keys(results.domainPcts)
    .map((k) => `${DOMAIN_LABEL[k]}:${results.domainScores[k]} 分 / 百分位 ${results.domainPcts[k]}(${gradeCn(results.grades[k])})`)
    .join("\n");
  const facets = Object.keys(results.facetPcts)
    .map((fid) => `${FACET_LABEL[fid] ?? fid}:${results.facetScores[fid]} / P${results.facetPcts[fid]}`)
    .join("、");

  const evidence = results.evidence
    .map((e) =>
      `- 题目「${e.text}」作答 ${e.raw}/5${e.reverse ? "(反向题)" : ""}${e.fast ? ",作答很快(可能凭直觉)" : ""}`
    )
    .join("\n");

  const gapText = results.gaps
    ? Object.entries(results.gaps)
        .filter(([, g]) => Math.abs(g) >= 20)
        .map(([k, g]) => `${DOMAIN_LABEL[k]}:${g > 0 ? "实测高于自评 " + g : "实测低于自评 " + Math.abs(g)} 分位`)
        .join("、") || "各自评与实测差异不大"
    : "未做自评";

  const qualityText = `置信度 ${results.quality.confidence}${results.quality.flags.length ? ",信号:" + results.quality.flags.join("/") : ""}`;

  return `你是一位受过心理测量学训练的人格解读顾问,正在为一位刚完成大五人格测试(BFI-2)的中文用户撰写个性化解读报告。

## 用户数据
模式:${state.mode === "short" ? "快速版 30 题" : "完整版 60 题"}

### 五维得分(1-5 均分 / 参考常模百分位)
${dom}

### 15 个侧面得分
${facets}

### 具体题目作答证据(解读时请引用这些原始作答)
${evidence}

### 自评与实测对照
${gapText}

### 作答质量
${qualityText}

## 写作要求(严格遵守)
1. **必须引用具体题目的作答**来支撑你的判断,例如"你在『我常常感到紧张』上打了高分,而这一题恰好落在焦虑侧面——这与你神经质维度整体偏高的模式一致"。不要只复述维度分数。
2. **禁止巴纳姆语句**:不许出现放在任何人身上都成立的表述(如"你外表坚强内心细腻""你有时外向有时内敛")。每个判断都要能从上面的数据里找到依据。
3. 诚实呈现 trade-off:高分有代价,低分有收益,不做单方面夸奖或贬低。
4. 若自评与实测有明显落差,单独用一段讨论这种"自我认知偏差"的可能含义。
5. 使用"你"称呼读者;不使用临床诊断词汇(如"抑郁倾向""焦虑症"),必要时提示这是自我认识参考而非诊断。
6. 输出 markdown,结构:## 一段总评(120字内)、## 逐维度解读(五段,每段 80-150 字)、## 你的盲点(2-3 条)、## 给你的三个具体建议(可执行、贴合数据)。
7. 全文中文,总长 900-1400 字,克制、具体、有洞察,像一位懂心理学的老朋友,不像营销文案。`;
}

const DOMAIN_LABEL = { O: "开放性", C: "尽责性", E: "外向性", A: "宜人性", N: "神经质" };
const FACET_LABEL = {
  O1: "智力好奇心", O2: "审美敏感性", O3: "创造想象力",
  C1: "条理性", C2: "尽责感", C3: "成就驱力",
  E1: "社交性", E2: "决断自信", E3: "活力水平",
  A1: "同情心", A2: "尊重他人", A3: "信任",
  N1: "焦虑", N2: "抑郁", N3: "情绪波动",
};
const GRADE_CN = { 1: "极低", 2: "偏低", 3: "中等", 4: "偏高", 5: "极高" };
function gradeCn(g) { return GRADE_CN[g] ?? "—"; }

/** 追问对话的系统提示(携带结果上下文的压缩版) */
export function buildChatSystemPrompt(results) {
  const dom = Object.keys(results.domainPcts)
    .map((k) => `${DOMAIN_LABEL[k]} P${results.domainPcts[k]}`)
    .join("、");
  const facets = Object.keys(results.facetPcts)
    .map((fid) => `${FACET_LABEL[fid] ?? fid} P${results.facetPcts[fid]}`)
    .join("、");
  return `你是用户的性格解读顾问,用户刚完成大五人格测试(BFI-2)。其结果:维度百分位——${dom};侧面百分位——${facets}。人格称号「${results.title}」。回答用户追问时:基于这些数据,具体、诚实、给 trade-off 而非空泛安慰;不使用临床诊断语言;中文回答,每次 300 字以内;数据未覆盖的话题(如童年经历)要说明测试数据无法回答。`;
}
