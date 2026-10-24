// items.js — BFI-2 正式题库(60 题)
// 英文条目与计分键:Big Five Inventory-2, Soto & John (2017), JPSP 113(1):117-143
//   (APA PsycTESTS doi:10.1037/t64008-000 与 eScholarship 开放版双源核对,程序化校验通过)
// 中文条目:BFI-2-CN 官方定稿译文,Zhang et al. (2022), Assessment 29(6):1262-1284,
//   取自作者 OSF 项目《5. Finalized Chinese BFI-2.pdf》(osf.io/bjfdc)。
//   其中 3 处按英文原义微调(经调研审计确认的语义偏移):
//   #28 careless「没有责任心」→「粗心马虎」(与 #58 irresponsible 拉开区分)
//   #29 not easily upset「不易生气」→「不易心烦」
//   #59 gets emotional easily「容易愤怒」→「容易情绪化」
// 反向题共 30(每 facet 2正2反):3,4,5,8,9,11,12,16,17,22,23,24,25,26,28,29,30,31,36,37,42,44,45,47,48,49,50,51,55,58
// 短版(BFI-2-S)30 题构成(官方短版条目映射到全版编号):
//   E:1,16R,21,26R,41,51R;A:2,7,12R,37R,47R,57;C:3R,23R,28R,33,43,53;
//   N:4R,24R,29R,34,54,59;O:5R,20,30R,40,55R,60
// 版权:条目 © Oliver P. John & Christopher J. Soto;中文版 © Zhang et al. (2022)。
//   非营利研究与教育用途可用,须保留本引用。

export const DOMAINS = {
  O: {
    key: "O", name: "开放性", en: "Openness",
    desc: "对新观念、审美与经验的开放程度",
    facets: ["智力好奇心", "审美敏感性", "创造想象力"],
  },
  C: {
    key: "C", name: "尽责性", en: "Conscientiousness",
    desc: "自律、条理与目标坚持",
    facets: ["条理性", "尽责感", "成就驱力"],
  },
  E: {
    key: "E", name: "外向性", en: "Extraversion",
    desc: "社交能量与主动程度",
    facets: ["社交性", "决断自信", "活力水平"],
  },
  A: {
    key: "A", name: "宜人性", en: "Agreeableness",
    desc: "共情、信任与合作倾向",
    facets: ["同情心", "尊重他人", "信任"],
  },
  N: {
    key: "N", name: "神经质", en: "Neuroticism",
    desc: "情绪敏感与波动程度",
    facets: ["焦虑", "低落倾向", "情绪波动"],
  },
};

/** 条目:{ num, zh(官方译文), en, domain, facet(1-3), reverse, short } */
export const ITEMS = [
  { num: 1, zh: "性格外向,喜欢交际", en: "Is outgoing, sociable", domain: "E", facet: 1, reverse: false, short: true },
  { num: 2, zh: "心肠柔软,有同情心", en: "Is compassionate, has a soft heart", domain: "A", facet: 1, reverse: false, short: true },
  { num: 3, zh: "缺乏条理", en: "Tends to be disorganized", domain: "C", facet: 1, reverse: true, short: true },
  { num: 4, zh: "从容,善于处理压力", en: "Is relaxed, handles stress well", domain: "N", facet: 1, reverse: true, short: true },
  { num: 5, zh: "对艺术没有什么兴趣", en: "Has few artistic interests", domain: "O", facet: 2, reverse: true, short: true },
  { num: 6, zh: "性格坚定自信,敢于表达自己的观点", en: "Has an assertive personality", domain: "E", facet: 2, reverse: false, short: false },
  { num: 7, zh: "为人恭谦,尊重他人", en: "Is respectful, treats others with respect", domain: "A", facet: 2, reverse: false, short: true },
  { num: 8, zh: "比较懒", en: "Tends to be lazy", domain: "C", facet: 3, reverse: true, short: false },
  { num: 9, zh: "经历挫折后仍能保持积极心态", en: "Stays optimistic after experiencing a setback", domain: "N", facet: 2, reverse: true, short: false },
  { num: 10, zh: "对许多不同的事物都感兴趣", en: "Is curious about many different things", domain: "O", facet: 1, reverse: false, short: false },
  { num: 11, zh: "很少觉得兴奋或者特别想要(做)什么", en: "Rarely feels excited or eager", domain: "E", facet: 3, reverse: true, short: false },
  { num: 12, zh: "常常挑别人的毛病", en: "Tends to find fault with others", domain: "A", facet: 3, reverse: true, short: true },
  { num: 13, zh: "可信赖的,可靠的", en: "Is dependable, steady", domain: "C", facet: 2, reverse: false, short: false },
  { num: 14, zh: "喜怒无常,情绪起伏较多", en: "Is moody, has up and down mood swings", domain: "N", facet: 3, reverse: false, short: false },
  { num: 15, zh: "善于创造,能找到聪明的方法来做事", en: "Is inventive, finds clever ways to do things", domain: "O", facet: 3, reverse: false, short: false },
  { num: 16, zh: "比较安静", en: "Tends to be quiet", domain: "E", facet: 1, reverse: true, short: true },
  { num: 17, zh: "对他人没有什么同情心", en: "Feels little sympathy for others", domain: "A", facet: 1, reverse: true, short: false },
  { num: 18, zh: "做事有计划有条理", en: "Is systematic, likes to keep things in order", domain: "C", facet: 1, reverse: false, short: false },
  { num: 19, zh: "容易紧张", en: "Can be tense", domain: "N", facet: 1, reverse: false, short: false },
  { num: 20, zh: "着迷于艺术、音乐或文学", en: "Is fascinated by art, music, or literature", domain: "O", facet: 2, reverse: false, short: true },
  { num: 21, zh: "常常处于主导地位,像个领导一样", en: "Is dominant, acts as a leader", domain: "E", facet: 2, reverse: false, short: true },
  { num: 22, zh: "常与他人意见不和", en: "Starts arguments with others", domain: "A", facet: 2, reverse: true, short: false },
  { num: 23, zh: "很难开始行动起来去完成一项任务", en: "Has difficulty getting started on tasks", domain: "C", facet: 3, reverse: true, short: true },
  { num: 24, zh: "觉得有安全感,对自己满意", en: "Feels secure, comfortable with self", domain: "N", facet: 2, reverse: true, short: true },
  { num: 25, zh: "不喜欢知识性或者哲学性强的讨论", en: "Avoids intellectual, philosophical discussions", domain: "O", facet: 1, reverse: true, short: false },
  { num: 26, zh: "不如别人有活力", en: "Is less active than other people", domain: "E", facet: 3, reverse: true, short: true },
  { num: 27, zh: "宽宏大量", en: "Has a forgiving nature", domain: "A", facet: 3, reverse: false, short: false },
  { num: 28, zh: "有时比较粗心马虎", en: "Can be somewhat careless", domain: "C", facet: 2, reverse: true, short: true },
  { num: 29, zh: "情绪稳定,不易心烦", en: "Is emotionally stable, not easily upset", domain: "N", facet: 3, reverse: true, short: true },
  { num: 30, zh: "几乎没有什么创造性", en: "Has little creativity", domain: "O", facet: 3, reverse: true, short: true },
  { num: 31, zh: "有时会害羞,比较内向", en: "Is sometimes shy, introverted", domain: "E", facet: 1, reverse: true, short: false },
  { num: 32, zh: "乐于助人,待人无私", en: "Is helpful and unselfish with others", domain: "A", facet: 1, reverse: false, short: false },
  { num: 33, zh: "习惯让事物保持整洁有序", en: "Keeps things neat and tidy", domain: "C", facet: 1, reverse: false, short: true },
  { num: 34, zh: "时常忧心忡忡,担心很多事情", en: "Worries a lot", domain: "N", facet: 1, reverse: false, short: true },
  { num: 35, zh: "重视艺术与审美", en: "Values art and beauty", domain: "O", facet: 2, reverse: false, short: false },
  { num: 36, zh: "感觉自己很难对他人产生影响", en: "Finds it hard to influence people", domain: "E", facet: 2, reverse: true, short: false },
  { num: 37, zh: "有时对人比较粗鲁", en: "Is sometimes rude to others", domain: "A", facet: 2, reverse: true, short: true },
  { num: 38, zh: "有效率,做事有始有终", en: "Is efficient, gets things done", domain: "C", facet: 3, reverse: false, short: false },
  { num: 39, zh: "时常觉得悲伤", en: "Often feels sad", domain: "N", facet: 2, reverse: false, short: false },
  { num: 40, zh: "思想深刻", en: "Is complex, a deep thinker", domain: "O", facet: 1, reverse: false, short: true },
  { num: 41, zh: "精力充沛", en: "Is full of energy", domain: "E", facet: 3, reverse: false, short: true },
  { num: 42, zh: "不相信别人,怀疑别人的意图", en: "Is suspicious of others' intentions", domain: "A", facet: 3, reverse: true, short: false },
  { num: 43, zh: "可靠的,总是值得他人信赖", en: "Is reliable, can always be counted on", domain: "C", facet: 2, reverse: false, short: true },
  { num: 44, zh: "能够控制自己的情绪", en: "Keeps their emotions under control", domain: "N", facet: 3, reverse: true, short: false },
  { num: 45, zh: "缺乏想象力", en: "Has difficulty imagining things", domain: "O", facet: 3, reverse: true, short: false },
  { num: 46, zh: "爱说话,健谈", en: "Is talkative", domain: "E", facet: 1, reverse: false, short: false },
  { num: 47, zh: "有时对人冷淡,漠不关心", en: "Can be cold and uncaring", domain: "A", facet: 1, reverse: true, short: true },
  { num: 48, zh: "乱糟糟的,不爱收拾", en: "Leaves a mess, doesn't clean up", domain: "C", facet: 1, reverse: true, short: false },
  { num: 49, zh: "很少觉得焦虑或者害怕", en: "Rarely feels anxious or afraid", domain: "N", facet: 1, reverse: true, short: false },
  { num: 50, zh: "觉得诗歌、戏剧很无聊", en: "Thinks poetry and plays are boring", domain: "O", facet: 2, reverse: true, short: false },
  { num: 51, zh: "更喜欢让别人来领头负责", en: "Prefers to have others take charge", domain: "E", facet: 2, reverse: true, short: true },
  { num: 52, zh: "待人谦逊礼让", en: "Is polite, courteous to others", domain: "A", facet: 2, reverse: false, short: false },
  { num: 53, zh: "有恒心,能坚持把事情做完", en: "Is persistent, works until the task is finished", domain: "C", facet: 3, reverse: false, short: true },
  { num: 54, zh: "时常觉得郁郁寡欢", en: "Tends to feel depressed, blue", domain: "N", facet: 2, reverse: false, short: true },
  { num: 55, zh: "对抽象的概念和想法没什么兴趣", en: "Has little interest in abstract ideas", domain: "O", facet: 1, reverse: true, short: true },
  { num: 56, zh: "充满热情", en: "Shows a lot of enthusiasm", domain: "E", facet: 3, reverse: false, short: false },
  { num: 57, zh: "把人往最好的方面想", en: "Assumes the best about people", domain: "A", facet: 3, reverse: false, short: true },
  { num: 58, zh: "有时候会做出一些不负责任的行为", en: "Sometimes behaves irresponsibly", domain: "C", facet: 2, reverse: true, short: false },
  { num: 59, zh: "情绪多变,容易情绪化", en: "Is temperamental, gets emotional easily", domain: "N", facet: 3, reverse: false, short: true },
  { num: 60, zh: "有创意,能想出新点子", en: "Is original, comes up with new ideas", domain: "O", facet: 3, reverse: false, short: true },
];
