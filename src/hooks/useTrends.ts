import { MOCK } from '../data/mock';
import type { Trend } from '../data/mock';

export type TrendKey = 'ltft' | 'warmup' | 'idle' | 'cold';

export function useTrends(): Record<TrendKey, Trend> {
  return MOCK.trends;
}
