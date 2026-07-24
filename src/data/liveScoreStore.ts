// 5 分钟滚动评分状态:latest 供 Home 卡/CarPlay,timeline 行程结束附进 TripRecord。
// 模式同 outlookStore(module-level state + listeners Set)。
import { ScorePoint } from './types';

export interface LiveScoreState {
  score: number;
  problem: string;
  /** epoch ms of last successful analysis */
  at: number;
  /** true = 上次刷新失败,显示的是旧结果 */
  stale: boolean;
}

let latest: LiveScoreState | null = null;
let timeline: ScorePoint[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function subscribeLiveScore(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getLiveScore = () => latest;

/** 新行程开始:清空上一程状态。 */
export function startScoreTrip(): void {
  latest = null;
  timeline = [];
  notify();
}

export function recordScore(point: ScorePoint): void {
  latest = { score: point.score, problem: point.problem, at: Date.now(), stale: false };
  timeline = [...timeline, point];
  notify();
}

export function markScoreStale(): void {
  if (latest && !latest.stale) {
    latest = { ...latest, stale: true };
    notify();
  }
}

/** 行程终结:取走时间线并清空(短行程丢弃时调用方直接扔掉返回值)。 */
export function takeScoreTimeline(): ScorePoint[] {
  const tl = timeline;
  latest = null;
  timeline = [];
  notify();
  return tl;
}
