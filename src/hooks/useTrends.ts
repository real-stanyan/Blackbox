import { useEffect, useState, useSyncExternalStore } from 'react';
import { getIndex, getTrip, subscribeTrips } from '../data/tripStore';
import { buildTrends, TrendKey } from '../data/trends';
import type { Trend, TripRecord } from '../data/types';

export type { TrendKey };

export function useTrends(): Record<TrendKey, Trend> {
  const index = useSyncExternalStore(subscribeTrips, getIndex);
  const [trends, setTrends] = useState(() => buildTrends([]));
  useEffect(() => {
    let alive = true;
    void (async () => {
      const recs = await Promise.all(index.map((e) => getTrip(e.id)));
      if (alive) setTrends(buildTrends(recs.filter((r): r is TripRecord => r !== null)));
    })();
    return () => {
      alive = false;
    };
  }, [index]);
  return trends;
}
