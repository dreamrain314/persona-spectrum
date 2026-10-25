// share.js — canvas 分享卡(1080×1350,本地绘制,不上传任何数据)
// 布局:上=眉标/称号/铭言,中=雷达(左)+五维条(右)双栏,下=页脚;单行/双行称号均不重叠
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
};

/**
 * 纯绘制:返回 canvas 元素(便于测试预览)。
 * @param {{title:string, motto:string, values:Object<string,number>, dateStr:string, url:string}} data
 */
export function drawShareCard(data) {
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

  // ── 顶部:眉标行 ──
  const titleFont = "600 92px 'Newsreader', 'Noto Serif SC', 'Songti SC', serif";
  g.fillStyle = PALETTE.muted;
  g.font = "500 26px 'SF Mono', 'Geist Mono', monospace";
  g.textAlign = "left";
  g.fillText("PERSONA SPECTRUM · 大五人格测评", 96, 118);
  g.textAlign = "right";
  g.fillText(data.dateStr, W - 96, 118);

  // ── 称号(最多两行,92px;9 字内单行)──
  g.fillStyle = PALETTE.ink;
  g.textAlign = "left";
  const titleLines = wrapText(g, data.title, titleFont, W - 192);
  g.font = titleFont;
  let ty = 268;
  for (const line of titleLines) {
    g.fillText(line, 96, ty);
    ty += 108;
  }

  // ── 铭言 ──
  g.fillStyle = PALETTE.muted;
  g.font = "italic 400 38px 'Newsreader', 'Noto Serif SC', serif";
  g.fillText("「" + data.motto + "」", 96, ty + 14);

  // ── 中部双栏:雷达(左)+ 五维条(右),区域固定,称号行数不影响 ──
  const midTop = 500, midBottom = 1150;
  const midCy = (midTop + midBottom) / 2;

  drawRadar(g, data.values, 310, midCy, Math.min(235, (midBottom - midTop) / 2 - 58));

  // 五维条(右栏:x 600-984)
  const barX = 620, barW = 984 - barX - 96; // 轨道宽,右侧留数值位
  const rowH = 64;
  const rowsTop = midCy - ((ORDER.length - 1) * rowH) / 2 - 18;
  ORDER.forEach((k, i) => {
    const y = rowsTop + i * rowH;
    g.fillStyle = PALETTE.muted;
    g.font = "500 30px 'SF Pro Display', 'PingFang SC', sans-serif";
    g.textAlign = "left";
    g.fillText(DOMAINS[k].name, barX, y + 38);
    g.fillStyle = PALETTE.hair;
    g.fillRect(barX, y + 18, barW, 16);
    g.fillStyle = PALETTE[k];
    g.fillRect(barX, y + 18, (barW * (data.values[k] ?? 0)) / 100, 16);
    g.fillStyle = PALETTE.ink;
    g.font = "600 34px 'SF Mono', 'Geist Mono', monospace";
    g.textAlign = "right";
    g.fillText(String(data.values[k] ?? "—"), 984, y + 40);
  });

  // ── 底部页脚 ──
  g.fillStyle = PALETTE.muted;
  g.font = "500 24px 'SF Pro Display', 'PingFang SC', sans-serif";
  g.textAlign = "center";
  g.fillText(`基于大五人格模型(BFI-2)· ${data.url}`, W / 2, 1262);

  return canvas;
}

/** 生成并触发下载 */
export function generateShareCard(data) {
  drawShareCard(data).toBlob((blob) => {
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
    const [lx, ly] = pt(i, R + 40);
    g.fillStyle = PALETTE.ink;
    g.font = "600 27px 'SF Pro Display', 'PingFang SC', sans-serif";
    g.textAlign = "center";
    g.fillText(DOMAINS[ORDER[i]].name, lx, ly + 10);
  });
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
