# 人格光谱 · Persona Spectrum

**线上地址**:https://dreamrain314.github.io/persona-spectrum/

基于大五人格模型(Big Five / OCEAN)的在线心理测评公共网页。纯静态、零构建、零依赖,可直接部署到 GitHub Pages 等任意静态托管。

> 线上(纯静态托管)说明:除 AI 深度解读外的全部功能开箱即用;AI 解读在线上支持 DeepSeek / OpenAI 等允许浏览器直连的服务商,智谱用户需本地模式(`node server.js`)或自建中转。

## 特性

- **专业量表**:BFI-2(Big Five Inventory-2, Soto & John, 2017),双模式——快速版 30 题(约 4 分钟)/ 完整版 60 题(约 10 分钟),5 维度 × 15 侧面(facet)细分
- **科学计分**:正反向计分、参考常模百分位换算、作答质量检测(中庸作答 / 直线作答 / 极速作答 → 结果置信度标注)
- **自评 vs 实测对照**:答题前先自评五维,报告呈现"你以为的自己 vs 测出来的自己"
- **规则引擎解读**(离线即时):维度 × 档位 + facet × 档位 + 维度交互洞察 + 人格称号系统,文案拒绝巴纳姆语句
- **AI 深度解读**(BYOK):访客可选填自己的 API Key(OpenAI / DeepSeek / 智谱等 OpenAI 兼容格式),AI 解读会**引用你具体题目的作答行为**(如"你在『我常感到紧张』一题打了高分"),并支持追问对话;不填 Key 完全不影响使用
- **分享卡片**:一键生成带人格称号与雷达图的分享图(canvas 本地绘制)
- **隐私**:全部计算在浏览器本地完成,作答仅存 localStorage,无账号、无后端、无追踪

## 本地运行

推荐用自带 AI 同源代理的 Node 服务器(智谱等不支持浏览器跨域直连的服务商需要它):

```bash
cd persona-spectrum
node server.js 8082        # 要求 Node 18+
# 浏览器打开 http://127.0.0.1:8082
```

纯静态预览(无 AI 代理,AI 解读仅支持 DeepSeek / OpenAI 等允许浏览器直连的服务商):

```bash
python -m http.server 8082
```

(ES modules 需要 http 服务,直接双击 index.html 会因 file:// 协议失败。)

## 部署

任意静态托管。GitHub Pages:push 本目录到仓库,Settings → Pages → 选择分支即可。

## 目录结构

```
persona-spectrum/
├── index.html            # 单页应用骨架(五个屏)
├── css/style.css         # 暖白编辑风设计系统
└── js/
    ├── main.js           # 状态机与流程编排
    ├── ui.js             # 各屏渲染
    ├── data/items.js     # BFI-2 题库(题面/维度/facet/反向/短版标记)
    ├── data/norms.js     # 参考常模(均值/标准差 + 出处)
    ├── data/copy.js      # 文案库(维度/facet/交互洞察/称号/场景)
    ├── scoring.js        # 计分引擎(纯函数)
    ├── engine.js         # 规则引擎解读生成
    ├── chart.js          # SVG 雷达图
    ├── share.js          # canvas 分享卡生成
    └── ai.js             # BYOK AI 层(prompt 构造/流式调用)
```

## 计分说明

- 每题 5 点李克特(1=非常不同意 … 5=非常同意),反向题 1↔5 翻转后计分
- 维度分 = 该维度条目均分;侧面(facet)分 = 该侧面条目均分
- 百分位按参考常模正态近似换算(z = (x − μ) / σ → Φ(z)),常模及出处见 `js/data/norms.js`
- 本工具定位为**自我认识参考**,非临床诊断

## 量表版权注记

- 英文条目:Big Five Inventory-2,© Oliver P. John & Christopher J. Soto (2017),JPSP 113(1):117-143
- 中文条目:BFI-2-CN 官方定稿译文,Zhang et al. (2022), Assessment 29(6):1262-1284(作者 OSF: osf.io/bjfdc);其中 3 处按英文原义做呈现层微调(#28/#29/#59)
- 常模:Zhang et al. (2022) 中国在职成人样本(N=486),OSF 公开数据按官方 R 脚本复算
- BFI-2 允许研究与教育用途免费使用,须保留引用;本项目为非商业自我认识工具,不对条目主张任何权利
