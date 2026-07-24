import { useSyncExternalStore } from 'react';
import { getLiveScore, subscribeLiveScore } from '../data/liveScoreStore';

export function useLiveScore() {
  return useSyncExternalStore(subscribeLiveScore, getLiveScore);
}
