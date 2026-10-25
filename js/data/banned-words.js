// banned-words.js — 评论区一级违禁词表(前端本地拦截,零成本零延迟)
// 匹配策略:原文 + 去分隔符归一化(全角→半角、去空格/星号/点等插符)后 includes 匹配
// 维护:直接增删词条;变体词(谐音/拼音)由 LLM 二级审核兜底

const WORDS = [
  // 人身攻击 / 辱骂
  "傻逼", "煞笔", "傻比", "sb", "脑残", "弱智", "白痴", "废物", "滚蛋", "去死",
  "该死", "畜生", "贱人", "婊子", "妈的", "他妈", "特么", "tm的", "狗屁", "放屁",
  "混蛋", "王八", "龟孙", "杂种", "婊", "娼", "妓女", "蠢货", "蠢猪", "低能",
  "智障", "脑瘫", "白痴", "二百五", "神经病", "有病吧", "恶心东西",
  // 色情低俗
  "约炮", "嫖娼", "卖淫", "援交", "一夜情", "裸聊", "色情", "做爱", "打炮",
  "口交", "肛交", "鸡巴", "阴茎", "阴道", "淫", "骚货", "发骚", "情色",
  // 政治敏感
  "法轮", "轮子功", "六四", "天安门事件", "共产党下台", "推翻政府", "分裂国家",
  "台独", "港独", "藏独", "疆独", "达赖", "反华",
  // 广告 / 引流 / 诈骗
  "加微信", "加vx", "加v信", "加qq", "代开发票", "刷单", "兼职日结", "博彩",
  "赌球", "六合彩", "网赚", "引流推广", "招嫖", "办证", "私贷", "高利贷",
  "免费领取", "点击链接", "扫码进群", "优惠券代购",
  // 暴力 / 违法
  "买凶", "杀人", "自杀教程", "毒品", "冰毒", "大麻", "枪支买卖", "爆炸物",
];

/** 全角→半角、小写 */
function toHalfwidth(s) {
  let out = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c === 0x3000) out += " ";
    else if (c > 0xff00 && c < 0xff5f) out += String.fromCharCode(c - 0xfee0);
    else out += ch;
  }
  return out.toLowerCase();
}

/** 去掉常见插符与空白(防"傻-逼""傻 逼"式混淆) */
const SEPARATOR = /[\s\*\·•・\-_~—!,。,、;:?？!.''"“”()（）\[\]【】]/g;

export function normalize(text) {
  return toHalfwidth(String(text ?? "")).replace(SEPARATOR, "");
}

const INDEX = [...new Set(WORDS.map((w) => normalize(w)))].filter(Boolean);

/** 返回命中的词条(原始内容包含或归一化后包含);未命中返回 null */
export function findBannedWord(content) {
  const raw = toHalfwidth(String(content ?? ""));
  const norm = normalize(content);
  for (const w of INDEX) {
    if (raw.includes(w) || norm.includes(w)) return w;
  }
  return null;
}
