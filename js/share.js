// share.js — canvas 分享卡生成(1080×1350,本地绘制,不上传任何数据)
import { DOMAINS } from "./data/items.js";

const ORDER = ["O", "C", "E", "A", "N"];

// 与 css 的暖白编辑风同一套色板
const PALETTE = {
  bg: "#FBFAF8",
  ink: "#111111",
  muted: "#787774",
  hair: "#E3E1DD",
  O: "#1F6C9F",
  C: "#346538",
  E: "#956400",
  A: "#9F2F2D",
  N: "#6B5B95",
  fillO: "#E1F3FE",
  fillC: "#EDF3EC",
  fillE: "#FBF3DB",
  fillA: "#FDEBEC",
  fillN: "#EDEAF6",
};

/**
 * 生成分享卡并触发下载。
 * @param {{title:string, motto:string, values:Object<string,number>, dateStr:string, url:string}} data
 */
export function generateShareCard(data) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");

  // 画布与内衬细框(纸感)
  g.fillStyle = PALETTE.bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = PALETTE.hair;
  g.lineWidth = 2;
  g.strokeRect(48.5, 48.5, W - 97, H - 97);

  // 顶部眉标
  g.fillStyle = PALETTE.muted;
  g.font = "500 26px 'SF Mono', 'Geist Mono', monospace";
  g.textAlign = "left";
  g.fillText("PERSONA SPECTRUM · 大五人格测评", 96, 128);
  g.textAlign = "right";
  g.fillText(data.dateStr, W - 96, 128);

  // 称号(衬线大字,允许两行)
  g.fillStyle = PALETTE.ink;
  g.textAlign = "left";
  const titleLines = wrapText(g, data.title, "600 96px 'Newsreader', 'Noto Serif SC', 'Songti SC', serif", W - 192);
  g.font = "600 96px 'Newsreader', 'Noto Serif SC', 'Songti SC', serif";
  let ty = 300;
  for (const line of titleLines) {
    g.fillText(line, 96, ty);
    ty += 118;
  }

  // 铭言
  g.fillStyle = PALETTE.muted;
  g.font = "italic 400 40px 'Newsreader', 'Noto Serif SC', serif";
  g.fillText(data.motto, 96, ty + 30);

  // 雷达图
  drawRadar(g, data.values, W / 2, ty + 120 + (H - (ty + 120) - 300) / 2, 260);

  // 五维条
  const barTop = H - 372;
  ORDER.forEach((k, i) => {
    const y = barTop + i * 58;
    const dom = DOMAINS[k];
    g.fillStyle = PALETTE.muted;
    g.font = "500 28px 'SF Pro Display', 'PingFang SC', sans-serif";
    g.textAlign = "left";
    g.fillText(dom.name, 96, y + 34);
    g.fillStyle = PALETTE.hair;
    g.fillRect(240, y + 12, W - 520, 18);
    g.fillStyle = PALETTE[k];
    g.fillRect(240, y + 12, ((W - 520) * (data.values[k] ?? 0)) / 100, 18);
    g.fillStyle = PALETTE.ink;
    g.font = "600 34px 'SF Mono', 'Geist Mono', monospace";
    g.textAlign = "right";
    g.fillText(String(data.values[k] ?? "—"), W - 96, y + 36);
  });

  // 底部
  g.fillStyle = PALETTE.muted;
  g.font = "500 24px 'SF Pro Display', 'PingFang SC', sans-serif";
  g.textAlign = "center";
  g.fillText(`基于大五人格模型(BFI-2)· ${data.url}`, W / 2, H - 92);

  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `人格光谱-${data.title}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, "image/png");
}

function drawRadar(g, values, cx, cy, R) {
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  const pt = (i, r) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  const valR = (v) => (Math.max(0, Math.min(100, v)) / 100) * R;

  [20, 40, 60, 80, 100].forEach((v) => {
    const r = (v / 100) * R;
    g.beginPath();
    ORDER.forEach((_, i) => {
      const [x, y] = pt(i, r);
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    });
    g.closePath();
    g.strokeStyle = PALETTE.hair;
    g.lineWidth = v === 100 ? 2 : 1;
    g.stroke();
  });
  ORDER.forEach((_, i) => {
    const [x, y] = pt(i, R);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(x, y);
    g.strokeStyle = PALETTE.hair;
    g.lineWidth = 1;
    g.stroke();
    // 轴标签
    const [lx, ly] = pt(i, R + 44);
    g.fillStyle = PALETTE.ink;
    g.font = "600 28px 'SF Pro Display', 'PingFang SC', sans-serif";
    g.textAlign = "center";
    g.fillText(DOMAINS[ORDER[i]].name, lx, ly + 10);
  });
  // 数据多边形
  g.beginPath();
  ORDER.forEach((k, i) => {
    const [x, y] = pt(i, valR(values[k] ?? 0));
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  });
  g.closePath();
  g.fillStyle = "rgba(31, 108, 159, 0.14)";
  g.fill();
  g.strokeStyle = PALETTE.O;
  g.lineWidth = 3;
  g.stroke();
  ORDER.forEach((k, i) => {
    const [x, y] = pt(i, valR(values[k] ?? 0));
    g.beginPath();
    g.arc(x, y, 5, 0, Math.PI * 2);
    g.fillStyle = PALETTE.O;
    g.fill();
  });
}

function wrapText(g, text, font, maxW) {
  g.font = font;
  const lines = [];
  let line = "";
  for (const ch of text) {
    if (g.measureText(line + ch).width > maxW) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines.length > 2 ? [lines[0], lines[1]] : lines;
}
