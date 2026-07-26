// 离线验收 CarPlay 格子图:喂 DemoSession 同一套模拟数据 -> 8 个格子的几何 ->
// 拼一张 dark 主题 SVG,把 CarPlay 的 4×2 网格按真实分辨率摆出来供肉眼检查。
// 真机之外唯一能看到格子长什么样的手段(Hard rule:CarPlay 层不靠类型检查宣布完成)。
//
// Run: npx tsx scripts/test-carplay-tile.ts > /tmp/carplay-tile.svg
// 断言版(不出图,只查不变量): npx tsx scripts/test-carplay-tile.ts --check
import { CARPLAY_CHANNELS, bandForChannel, headroom, peakMetric } from '../src/carplay/channels';
import { buildDashboard, emptyStore, pushSamples, WINDOW_POINTS } from '../src/carplay/dashboardModel';
import { buildTileLayout, statusColor } from '../src/carplay/tileGeom';
import { tileToSvg } from '../src/carplay/tileSvg';
import { TOKENS } from '../src/styles/tokens';

const T = TOKENS.dark;

// 与 src/ble/DemoSession.tsx 的 generateSample 一致 —— demo 模式、HTML 原型、
// 本脚本三处必须是同一条曲线,否则「原型上好看」证明不了「真机上好看」。
function generateSample(t: number): Record<string, number> {
  const coolant = 25 + (90 - 25) * (1 - Math.exp(-t / 180));
  const stftBase = Math.sin(t / 3) * 4;
  const stftSpike = Math.sin(t / 20) > 0.95 ? Math.sin(t / 2) * 12 : 0;
  const stft = Math.max(-20, Math.min(20, stftBase + stftSpike));
  const rpm = Math.round(700 + Math.abs(Math.sin(t / 8)) * 2500);
  const speed = Math.max(0, Math.round(Math.sin(t / 10) * 40));
  const ltft = Math.sin(t / 60) * 3;
  const oil = Math.min(110, coolant + 10 + Math.sin(t / 30) * 3);
  return { rpm, speed, coolant, oil, stft, ltft };
}

const store = emptyStore();
let values: Record<string, number> = {};
// 跑 240 秒:水温爬过暖机段,STFT 至少撞一次 ±12 越界(验证红段真的画出来)
for (let i = 1; i <= 240; i++) {
  values = generateSample(i);
  pushSamples(store, values, i * 1000);
}

const trip = {
  elapsedSec: 240,
  distanceKm: 3.4,
  cold: true,
  samples: 240 * CARPLAY_CHANNELS.length,
  verdict: 'good' as const,
};

// ---------------------------------------------------------------- 断言模式
if (process.argv.includes('--check')) {
  const fail: string[] = [];
  const ok = (cond: boolean, msg: string) => {
    if (!cond) fail.push(msg);
  };

  // 1) 8 格,不多不少 —— CPGridTemplateMaximumItems = 8,多的会被系统忽略
  const tiles = buildDashboard({ values, store, trip, size: 240 });
  ok(tiles.length === 8, `格子数应为 8,实际 ${tiles.length}`);

  // 2) 每格都有 title(系统渲染在下方),且格子图里不能再画同一个通道名
  for (const t2 of tiles) {
    ok(t2.title.length > 0, '格子缺 title');
    const texts = t2.layout.prims.filter((p) => p.k === 'text').map((p) => (p as { text: string }).text);
    ok(!texts.includes(t2.title), `格子图里重复画了通道名「${t2.title}」—— 白占一行`);
  }

  // 3) 滚动窗口不超上限
  for (const c of CARPLAY_CHANNELS) {
    const n = store.series[c.key]?.length ?? 0;
    ok(n <= WINDOW_POINTS, `${c.label} 窗口 ${n} 超过 ${WINDOW_POINTS}`);
  }

  // 4) tier 降级:小格子必须真的少画东西
  const big = buildTileLayout({
    channel: CARPLAY_CHANNELS[0], samples: store.series.coolant ?? [],
    value: values.coolant, peak: store.peaks.coolant ?? -Infinity, size: 240,
  });
  const small = buildTileLayout({
    channel: CARPLAY_CHANNELS[0], samples: store.series.coolant ?? [],
    value: values.coolant, peak: store.peaks.coolant ?? -Infinity, size: 120,
  });
  ok(big.tier === 3 && small.tier === 1, `tier 判定错:240→${big.tier}, 120→${small.tier}`);
  ok(small.prims.length < big.prims.length, '120px 格子图元数没少于 240px —— 降级没生效');

  // 5) 余量取离最近一条边的距离,不是只算上界
  //    短期修正 ±12:v=-3.1 时离 -12 是 8.9,离 +12 是 15.1,必须报 8.9
  const stftBand = bandForChannel(CARPLAY_CHANNELS[2]);
  const h = headroom(-3.1, stftBand);
  ok(h !== null && Math.abs(h - 8.9) < 0.01, `余量应为 8.9,实际 ${h}`);
  // 越界时余量为负
  const hOut = headroom(-15, stftBand);
  ok(hOut !== null && hOut < 0, `越界时余量应为负,实际 ${hOut}`);

  // 6) 峰值口径:±类取绝对值
  ok(peakMetric(-15, stftBand) === 15, '±类通道峰值应取绝对值');
  const coolantBand = bandForChannel(CARPLAY_CHANNELS[0]);
  ok(peakMetric(-15, coolantBand) === -15, '单侧阈值通道峰值不应取绝对值');

  // 7) 状态色:无阈值通道不判绿,别让读者以为灰=正常
  ok(statusColor(3000, bandForChannel(CARPLAY_CHANNELS[4])) === T.label3, '无阈值通道应为灰');
  ok(statusColor(130, coolantBand) === T.red, '水温 130 应为红');
  ok(statusColor(60, coolantBand) === T.green, '水温 60 应为绿');
  ok(statusColor(110, coolantBand) === T.amber, '水温 110(>115*0.92)应为琥珀');

  // 8) 越界必须真的画出红段 —— 模拟数据里 STFT 撞过 ±12
  const stftTile = buildTileLayout({
    channel: CARPLAY_CHANNELS[2], samples: store.series.stft ?? [],
    value: values.stft, peak: store.peaks.stft ?? -Infinity, size: 240,
  });
  const hasRed = stftTile.prims.some((p) => p.k === 'poly' && p.stroke === T.red);
  const everOut = (store.series.stft ?? []).some((p) => Math.abs(p.v) > 12);
  ok(!everOut || hasRed, '窗口内有越界点但没画红段');

  // 9) 值缺失(车型不提供机油温度)不能崩,也不能画出假数值
  const missing = buildTileLayout({
    channel: CARPLAY_CHANNELS[1], samples: [], value: undefined, peak: -Infinity, size: 240,
  });
  const mTexts = missing.prims.filter((p) => p.k === 'text').map((p) => (p as { text: string }).text);
  ok(mTexts.includes('—'), '缺值时应画「—」而不是 0');

  // 10) 生成的 SVG 必须格式合法。踩过的坑:tokens.FONT 含双引号,原样进
  //     font-family="…" 会截断属性,整张图从第一个 <text> 起解析失败 ——
  //     上面 9 条断言全过、图却是空白。所以这条查每个标签内引号成对。
  for (const t3 of tiles) {
    const svg = tileToSvg(t3.layout);
    const tags = svg.match(/<[^>]*>/g) ?? [];
    const broken = tags.find((tag) => (tag.match(/"/g)?.length ?? 0) % 2 !== 0);
    ok(broken === undefined, `SVG 标签引号不成对(属性被截断):${broken?.slice(0, 80)}`);
  }

  if (fail.length) {
    console.error('FAIL:');
    for (const f of fail) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('ALL OK');
  process.exit(0);
}

// ---------------------------------------------------------------- 出图模式
// 按 CarPlay 真实布局摆:4 列 × 2 行,格子下方是系统渲染的 title。
const SIZE = Number(process.env.TILE ?? 176);
const SCREEN_W = Number(process.env.W ?? 1280);
const SCREEN_H = Number(process.env.H ?? 720);
const SYSBAR = 42;
const NAVBAR = 60;
const CAP_H = 22;

const tiles = buildDashboard({ values, store, trip, size: SIZE });
const cellW = (SCREEN_W - 24) / 4;
const zoneY = SYSBAR + NAVBAR;
const zoneH = SCREEN_H - zoneY - 20;
const rowH = zoneH / 2;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const parts: string[] = [];

parts.push(`<rect width="${SCREEN_W}" height="${SCREEN_H}" fill="#000"/>`);
// 系统 chrome(app 控制不了的部分,画出来才看得清可用空间有多少)
parts.push(
  `<text x="18" y="27" fill="${T.label}" font-size="15" font-family="${'sans-serif'}">9:41</text>`,
);
parts.push(
  `<text x="20" y="${SYSBAR + 38}" fill="${T.label}" font-size="22" font-weight="600" font-family="sans-serif">Blackbox · 实时</text>`,
);
parts.push(
  `<line x1="0" y1="${zoneY}" x2="${SCREEN_W}" y2="${zoneY}" stroke="rgba(255,255,255,0.13)" stroke-width="1"/>`,
);

tiles.forEach((tile, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const cx = 12 + col * cellW + (cellW - SIZE) / 2;
  const cy = zoneY + 10 + row * rowH + (rowH - SIZE - CAP_H) / 2;
  const inner = tileToSvg(tile.layout).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  parts.push(`<g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)})">${inner}</g>`);
  parts.push(
    `<text x="${(cx + SIZE / 2).toFixed(1)}" y="${(cy + SIZE + 16).toFixed(1)}" fill="${T.label2}" font-size="14" text-anchor="middle" font-family="sans-serif">${esc(tile.title)}</text>`,
  );
});

// SCALE=0.8 之类用于缩小出图。不用 viewBox 缩放 —— 部分渲染器(macOS Quick Look)
// 把 viewBox 当裁剪窗口而不是缩放,右边几列会被直接切掉。改成显式 transform。
const SCALE = Number(process.env.SCALE ?? 1);
const body = SCALE === 1 ? parts.join('') : `<g transform="scale(${SCALE})">${parts.join('')}</g>`;
console.log(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(SCREEN_W * SCALE)}" height="${Math.round(SCREEN_H * SCALE)}">${body}</svg>`,
);
