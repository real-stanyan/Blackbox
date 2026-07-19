import { MOCK } from '../data/mock';
import type { LivePid } from '../data/mock';

export function useLivePids(): LivePid[] {
  return MOCK.livePids;
}
