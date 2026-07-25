// 离线验收 TripChart 的几何层:合成一段行程 -> features + series -> 逐通道算 layout
// -> 拼一张 dark 主题 SVG 供肉眼检查(真机之外唯一能看到图长什么样的手段)。
// Run: npx tsx scripts/test-trip-chart.ts > /tmp/trip-chart.svg
import { extractFeatures } from '../src/analysis/features';
import { buildSeries } from '../src/analysis/series';
import { bandFor, CHANNEL_LABEL_ZH, isOutOfBand } from '../src/analysis/bands';
import { buildTripChartLayout } from '../src/components/tripChartGeom';
import { findingChannels } from '../src/analysis/verdict';
import { TOKENS } from '../src/styles/tokens';
import { Sample } from '../src/obd/ElmSession';

const t = TOKENS.dark;

// 对齐截图里那次行程:16 分钟、水温冲到 108、STFT 在 -12.5..13.28 之间大幅跳动。
const samples: Sample[] = [];
for (let i = 0; i < 480; i++) {
  const ms = i * 2000;
  const warm = Math.min(1, i / 120);
  samples.push({ t: ms, key: 'rpm', value: 800 + Math.sin(i / 9) * 500 + warm * 700, raw: '' });
  samples.push({ t: ms, key: 'speed', value: Math.max(0, Math.sin(i / 22) * 55), raw: '' });
  samples.push({ t: ms, key: 'coolant_temp', value: Math.round(24 + warm * 84 + Math.sin(i / 40) * 6), raw: '' });
  samples.push({ t: ms, key: 'oil_temp', value: Math.round(22 + warm * 86), raw: '' });
  samples.push({ t: ms, key: 'stft_b1', value: Math.round(Math.sin(i / 4) * 1100 + Math.sin(i / 37) * 300) / 100, raw: '' });
  samples.push({ t: ms, key: 'ltft_b1', value: Math.round(Math.sin(i / 60) * 120) / 100, raw: '' });
}

const features = extractFeatures(samples);
const series = buildSeries(samples);

const CARD_W = 360;
const CHART_H = 118;
const HEAD_H = 52;
const FOOT_H = 26;
const CARD_H = HEAD_H + CHART_H + FOOT_H;
const GAP = 14;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const parts: string[] = [];
let cy = 16;

for (const ch of features.channels) {
  const pts = series[ch.key] ?? [];
  const band = bandFor(ch.key);
  const L = buildTripChartLayout(pts, band, { h: CHART_H });
  if (!L) continue;
  const out = band ? pts.filter((p) => isOutOfBand(p.v, band)).length : 0;
  const badge = band
    ? out > 0
      ? [`${out} 点超出正常范围`, t.red]
      : ['全程正常范围内', t.green]
    : ['无阈值参考', t.label3];

  const g: string[] = [];
  g.push(`<rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" rx="16" fill="${t.card}"/>`);
  g.push(
    `<text x="16" y="26" font-size="16" font-weight="600" fill="${t.label}">${esc(CHANNEL_LABEL_ZH[ch.key] ?? ch.name)} <tspan font-size="11.5" font-weight="400" fill="${t.label3}">${esc(ch.unit)}</tspan></text>`,
  );
  g.push(
    `<text x="${CARD_W - 16}" y="26" font-size="12.5" font-weight="600" text-anchor="end" fill="${badge[1]}">${esc(badge[0])}</text>`,
  );
  const cells: [string, string][] = [
    ['最低', String(ch.min)],
    ['均值', String(ch.mean)],
    ['最高', String(ch.max)],
  ];
  cells.forEach(([k, v], i) => {
    const x = 16 + i * 62;
    g.push(`<text x="${x}" y="40" font-size="11.5" fill="${t.label3}">${esc(k)}</text>`);
    g.push(`<text x="${x}" y="52" font-size="13.5" font-weight="600" fill="${t.label2}">${esc(v)}</text>`);
  });

  // ---- 图表本体:与 TripChart.tsx 一一对应 ----
  const cx0 = 14;
  g.push(`<g transform="translate(${cx0},${HEAD_H})">`);
  const rect = (r: { x: number; y: number; width: number; height: number } | null, fill: string, op: number) =>
    r ? `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${fill}" opacity="${op}"/>` : '';
  g.push(rect(L.normalRect, t.green, 0.08));
  g.push(rect(L.aboveRect, t.red, 0.1));
  g.push(rect(L.belowRect, t.red, 0.1));
  for (const e of L.edges) {
    g.push(
      `<line x1="${L.plot.x}" y1="${e.y}" x2="${L.plot.x + L.plot.width}" y2="${e.y}" stroke="${t.red}" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>`,
    );
    const lab = L.edges.length > 1 && e.v > 0 ? `+${e.v}` : String(e.v);
    g.push(`<text x="${L.plot.x + L.plot.width + 5}" y="${e.y + 3.5}" font-size="9.5" fill="${t.label3}">${lab}</text>`);
  }
  g.push(
    `<polyline points="${L.linePoints}" fill="none" stroke="${t.blue}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
  for (const r of L.outRuns) {
    g.push(
      r.points
        ? `<polyline points="${r.points}" fill="none" stroke="${t.red}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<circle cx="${r.dot!.cx}" cy="${r.dot!.cy}" r="2.4" fill="${t.red}"/>`,
    );
  }
  g.push(`<circle cx="${L.lastDot.cx}" cy="${L.lastDot.cy}" r="3.2" fill="${t.blue}"/>`);
  g.push(`<text x="${L.plot.x}" y="${L.h - 3}" font-size="9.5" fill="${t.label3}">0</text>`);
  g.push(
    `<text x="${L.plot.x + L.plot.width}" y="${L.h - 3}" font-size="9.5" text-anchor="end" fill="${t.label3}">${L.durMin} 分钟</text>`,
  );
  g.push(`</g>`);

  const note = band ? `绿色带 = ${band.note};红色区 = 异常` : '该通道无本地阈值,仅展示曲线';
  g.push(`<text x="16" y="${HEAD_H + CHART_H + 14}" font-size="12" fill="${t.label3}">${esc(note)}</text>`);

  parts.push(`<g transform="translate(16,${cy})">${g.join('')}</g>`);
  cy += CARD_H + GAP;
}

const H = cy + 8;
const W = CARD_W + 32;
process.stdout.write(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, PingFang SC, system-ui">` +
    `<rect width="${W}" height="${H}" fill="${t.bg}"/>${parts.join('')}</svg>`,
);
process.stderr.write(
  `channels=${features.channels.map((c) => c.key).join(',')}\nruleAlerts=${JSON.stringify(features.ruleAlerts)}\n`,
);

// AI 层的通道推断:拿真报告里那种 evidence 串体检一遍,认错通道就等于徽标挂错卡片。
const probes: [string, string[]][] = [
  ['短期燃油修正 (STFT) 波动较大且末段偏负', ['stft_b1 min=-12.5', 'stft_b1 p95=4.69']],
  ['长期燃油修正 (LTFT) 处于正常小幅正值区间', ['ltft_b1 min=-1.56', 'ltft_b1 max=0.78']],
  ['发动机暖机完成,水温在正常区间', ['coolant_temp max=108']],
  ['数据不足,无法判断', []],
];
for (const [finding, evidence] of probes) {
  process.stderr.write(`probe "${finding.slice(0, 14)}…" -> [${findingChannels({ finding, evidence })}]\n`);
}
