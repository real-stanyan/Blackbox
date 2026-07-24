// LiveSession React state 的模块级镜像。CarPlay 的 JS 跑在 React 树外(headless
// registerAutoPlay),读不到 context — 这里是它唯一的数据入口。
export interface LiveData {
  streaming: boolean;
  /** UI key → 最新读数(rpm/speed/coolant/oil/stft/ltft) */
  values: Record<string, number>;
  /** 行程开始 epoch ms;无行程 null */
  startedAt: number | null;
  distanceKm: number;
}

let data: LiveData = { streaming: false, values: {}, startedAt: null, distanceKm: 0 };
const listeners = new Set<() => void>();

export function subscribeLiveData(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getLiveData = () => data;

export function publishLiveData(patch: Partial<LiveData>): void {
  data = {
    ...data,
    ...patch,
    values: patch.values ? { ...data.values, ...patch.values } : data.values,
  };
  listeners.forEach((fn) => fn());
}
