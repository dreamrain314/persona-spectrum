// facet-defs.js — 15 侧面的标准定义(与作答分数无关,折叠行展开时显示)
// 来源:Soto & John (2017) 对各 facet 的描述(经 Sauer et al., 2022,
//  German J Exerc Sport Res 所列 "Description of the Big Five facets,
//  adapted from Soto and John (2017)" 表核对),中文为本项目对齐译法。
// 键名与 items.js 的 facet 编号一致:{domain}{1..3}。

export const FACET_DEFS = {
  /* 开放性 Open-Mindedness */
  O1: { en: "Intellectual Curiosity", text: "对抽象观念的兴趣,以及从思考本身获得的乐趣。" },
  O2: { en: "Aesthetic Sensitivity", text: "对艺术、音乐或文学的兴趣。" },
  O3: { en: "Creative Imagination", text: "富有创造性、有新意的思考方式。" },

  /* 尽责性 Conscientiousness */
  C1: { en: "Organization", text: "做事有系统、有条理、井然有序。" },
  C2: { en: "Responsibility", text: "为人可靠、沉稳,可以托付。" },
  C3: { en: "Productiveness", text: "做事高效,并能坚持到底。" },

  /* 外向性 Extraversion */
  E1: { en: "Sociability", text: "行为外向主动,享受与人交往。" },
  E2: { en: "Assertiveness", text: "有支配性与果断自信的倾向。" },
  E3: { en: "Energy Level", text: "情绪热情高涨、精力充沛。" },

  /* 宜人性 Agreeableness */
  A1: { en: "Compassion", text: "乐于助人、无私的行为倾向。" },
  A2: { en: "Respectfulness", text: "待人礼貌、尊重,倾向回避冲突。" },
  A3: { en: "Trust", text: "天性宽恕,相信他人是真诚与善意的。" },

  /* 神经质 Negative Emotionality */
  N1: { en: "Anxiety", text: "容易感到有压力、焦虑和担忧。" },
  N2: { en: "Depression", text: "容易感到悲伤、情绪低落。" },
  N3: { en: "Emotional Volatility", text: "有喜怒无常、情绪化的倾向。" },
};
