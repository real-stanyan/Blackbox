import { useMemo } from 'react';
import { LIVE_PID_META } from '../data/livePidMeta';
import type { LivePid } from '../data/types';
import { useLiveSession } from '../ble/LiveSession';

// 契约:返回类型 LivePid[] 不变(issue #9)。数值来自真 BLE,meta 只给 label/unit。
export function useLivePids(): LivePid[] {
  const { values } = useLiveSession();
  return useMemo(
    () =>
      LIVE_PID_META.map((m) => ({
        ...m,
        idle: values[m.key] ?? null,
        drive: values[m.key] ?? null,
        jitter: 0,
      })),
    [values],
  );
}
