// CarPlay 仪表盘的驱动器 —— 挂在 app 树里(需要 LiveSession context),
// 定时把实时读数变成 8 张 PNG 推给 CPGridTemplate。
//
// 为什么必须挂在 app 树里:光栅化走 react-native-svg 的 toDataURL,读的是原生视图
// 位图,得有真实挂载的视图(见 TileSvgView 的注释)。
//
// ⚠️ 整个文件未经真机验证(AGENTS.md Hard rule)—— 没有车机、entitlement 也还没进
// provisioning profile。类型检查过不代表能跑。
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveSession } from '../ble/LiveSession';
import { buildDashboard, emptyStore, pushSamples, type TripSummary } from './dashboardModel';
import { mountDashboard, onCarConnection, unmountDashboard, updateDashboard, type GridTile } from './gridBridge';
import { TileRasterizer } from './TileSvgView';
import type { TileLayout } from './tileGeom';

/**
 * 格子图边长(pt)。上限是运行时的 CPGridTemplate.maximumGridButtonImageSize,
 * Apple 未公开该值,库也没暴露到 JS。
 *
 * 2026-07-27 CarPlay Simulator(720×480)实测:原来设 176 时格子被系统压到目测
 * 60-70pt,字小到读不出。**渲染尺寸必须贴近系统上限,而不是往大了画等它缩** ——
 * 缩放会等比例砍掉字号,而 tier 是按设计尺寸判的,结果就是「按大格子排版、按小
 * 格子显示」,两头不讨好。
 *
 * 现在设 72:落在观察到的上限附近,tier 判定为 1(只有大数值 + 满格走势,不画
 * 阈值行和峰值行 —— 那两行在这个尺寸下本来就读不到)。配合 gridBridge 里按 PNG
 * 真实像素宽反算的 scale,原生看到的就是 72pt,不再二次缩放。
 *
 * 若以后拿到确切上限:比 72 大就往上调(tier 会自动升级、信息更多),小就往下调。
 */
const TILE_PT = 72;

/**
 * 刷新间隔。不用 1 Hz:每次要重画 + 光栅化 8 张 PNG 再过一次 IPC,
 * 而 Driving Task 的界面本来就是「扫一眼」用的,2 秒足够。
 * 真机实测掉帧就往上调。
 */
const REFRESH_MS = 2_000;

export function CarPlayHost() {
  const { phase, values, elapsedSec, distanceKm } = useLiveSession();
  const store = useRef(emptyStore());
  const [layouts, setLayouts] = useState<TileLayout[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const revision = useRef(0);
  const [rev, setRev] = useState(0);
  const connected = useRef(false);
  const mounted = useRef(false);

  // 车机连接状态
  useEffect(() => {
    const off = onCarConnection(
      () => {
        connected.current = true;
      },
      () => {
        connected.current = false;
        mounted.current = false;
        unmountDashboard();
      },
    );
    return off;
  }, []);

  // 冷启动:与 tripMetrics 同口径 —— 首个水温读数 < 60 °C
  const coldRef = useRef<boolean | null>(null);
  if (coldRef.current === null && values.coolant !== undefined) {
    coldRef.current = values.coolant < 60;
  }

  const trip: TripSummary = useMemo(
    () => ({
      elapsedSec,
      distanceKm,
      cold: coldRef.current ?? false,
      samples: Object.keys(store.current.series).reduce(
        (n, k) => n + (store.current.series[k]?.length ?? 0),
        0,
      ),
      // 实时阶段不出结论 —— 结论是行程结束后 runAnalysis 的事,这里给中性 info,
      // 免得车机上显示一个没有分析支撑的「良好」。
      verdict: 'info',
    }),
    [elapsedSec, distanceKm],
  );

  // 定时重建 layouts。只在 streaming 且车机已连时跑 —— 没连车白烧 CPU。
  useEffect(() => {
    if (phase !== 'streaming') return;
    const tick = () => {
      if (!connected.current) return;
      pushSamples(store.current, values, Date.now());
      const tiles = buildDashboard({ values, store: store.current, trip, size: TILE_PT });
      setLayouts(tiles.map((t) => t.layout));
      setTitles(tiles.map((t) => t.title));
      revision.current += 1;
      setRev(revision.current);
    };
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => clearInterval(id);
    // values 每秒变,但重画由 interval 控频,不进依赖 —— 否则每个新读数都触发一次重画
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, trip]);

  const onPngs = (pngs: (string | null)[]) => {
    const tiles: GridTile[] = titles.map((title, i) => ({
      title,
      png: pngs[i] ?? null,
      sizePt: TILE_PT,
    }));
    if (!mounted.current) mounted.current = mountDashboard(tiles);
    else updateDashboard(tiles);
  };

  return <TileRasterizer layouts={layouts} onPngs={onPngs} revision={rev} />;
}
