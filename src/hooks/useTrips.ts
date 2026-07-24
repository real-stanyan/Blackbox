import { useEffect, useState, useSyncExternalStore } from 'react';
import { getIndex, getTrip, subscribeTrips } from '../data/tripStore';
import { tripToDisplay } from '../data/display';
import type { Trip, TripRecord } from '../data/types';

// 契约:返回 Trip[](时间倒序),字段对齐原展示型。底层数据来自 tripStore。
export function useTrips(): Trip[] {
  const index = useSyncExternalStore(subscribeTrips, getIndex);
  const [trips, setTrips] = useState<Trip[]>([]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const recs = await Promise.all(index.map((e) => getTrip(e.id)));
      if (alive) setTrips(recs.filter((r): r is TripRecord => r !== null).map((r) => tripToDisplay(r)));
    })();
    return () => {
      alive = false;
    };
  }, [index]);
  return trips;
}

export function useTripRecord(id: string): TripRecord | null {
  const index = useSyncExternalStore(subscribeTrips, getIndex);
  const [rec, setRec] = useState<TripRecord | null>(null);
  useEffect(() => {
    let alive = true;
    void getTrip(id).then((r) => alive && setRec(r));
    return () => {
      alive = false;
    };
  }, [id, index]);
  return rec;
}
