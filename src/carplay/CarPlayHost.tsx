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
 * 格子图边长(pt)。真机上限是运行时的 CPGridTemplate.maximumGridButtonImageSize,
 * 库没把它暴露到 JS —— 上车打出实际值后再调这里。
 *
 * 176 是折中:比它大 iOS 会缩(不糊,只是浪费),比它小则字被放大变糊。
 * 若实测上限远小于 176,把这个数降到 120 —— tileGeom 的 tier 会自动降级成
 * 「只留数值 + 走势」,而不是硬塞四行读不清的小字。
 */
const TILE_PT = 176;

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
    const tiles: GridTile[] = titles.map((title, i) => ({ title, png: pngs[i] ?? null }));
    if (!mounted.current) mounted.current = mountDashboard(tiles);
    else updateDashboard(tiles);
  };

  return <TileRasterizer layouts={layouts} onPngs={onPngs} revision={rev} />;
}
