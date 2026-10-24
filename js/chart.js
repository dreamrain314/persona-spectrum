// chart.js — SVG 雷达图(手写,零依赖)
import { DOMAINS } from "./data/items.js";

const ORDER = ["O", "C", "E", "A", "N"];

/**
 * 绘制五维雷达图。
 * @param {HTMLElement} container 挂载点
 * @param {{values:Object<string,number>, compare?:Object<string,number>, size?:number, animate?:boolean}} opts
 *   values: {O:0-100,...} 实测;compare: 自评(可选);animate: 入场生长动画(默认开)
 */
export function renderRadar(container, opts) {
  const size = opts.size ?? 460;
  const cx = size / 2, cy = size / 2, R = size * 0.36;
  const rings = [20, 40, 60, 80, 100];
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  const pt = (i, r) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  const valR = (v) => (Math.max(0, Math.min(100, v)) / 100) * R;

  const polygon = (values) =>
    ORDER.map((k, i) => pt(i, valR(values[k] ?? 0)).join(",")).join(" ");

  const ringEls = rings
    .map((v) => {
      const r = (v / 100) * R;
      const pts = ORDER.map((_, i) => pt(i, r).join(",")).join(" ");
      return `<polygon points="${pts}" class="radar-ring"/>`;
    })
    .join("");

  const axisEls = ORDER.map((_, i) => {
    const [x, y] = pt(i, R);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="radar-axis"/>`;
  }).join("");

  // 轴标签沿半径外移,避开多边形
  const labelEls = ORDER.map((k, i) => {
    const [x, y] = pt(i, R + size * 0.082);
    const anchor = Math.abs(x - cx) < 12 ? "middle" : x > cx ? "start" : "end";
    const dom = DOMAINS[k];
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="radar-label" data-domain="${k}">
      ${dom.name}<tspan class="radar-pct" x="${x}" dy="1.4em">${opts.values[k] ?? "—"}%</tspan>
    </text>`;
  }).join("");

  const compareEl = opts.compare
    ? `<polygon points="${polygon(opts.compare)}" class="radar-compare"/>`
    : "";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("class", "radar" + (opts.animate === false ? "" : " radar-enter"));
  svg.innerHTML = `
    <g class="radar-grid">${ringEls}${axisEls}</g>
    <g class="radar-shape">
      ${compareEl}
      <polygon points="${polygon(opts.values)}" class="radar-main"/>
    </g>
    ${labelEls}`;

  container.innerHTML = "";
  container.appendChild(svg);
  return svg;
}

/**
 * 侧面(facet)水平条列表(HTML 实现,编辑风细线)。
 * @param {HTMLElement} container
 * @param {Array<{label:string, pct:number|null, domain:string}>} facets
 */
export function renderFacetBars(container, facets) {
  container.innerHTML = facets
    .map(
      (f) => `
      <div class="facet-row">
        <span class="facet-name">${f.label}</span>
        <span class="facet-track"><span class="facet-fill d-${f.domain}" style="transform:scaleX(${(f.pct ?? 0) / 100})"></span>
          <span class="facet-mid"></span></span>
        <span class="facet-val">${f.pct ?? "—"}<i>%</i></span>
      </div>`
    )
    .join("");
}
