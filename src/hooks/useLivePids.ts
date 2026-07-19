import { useMemo } from 'react';
import { MOCK } from '../data/mock';
import type { LivePid } from '../data/mock';
import { useLiveSession } from '../ble/LiveSession';

// 契约:返回类型 LivePid[] 不变(issue #9)。底层从 mock 数值换成真 BLE 读数;
// MOCK.livePids 只再提供展示元数据(key/label/unit/note)。
export function useLivePids(): LivePid[] {
  const { values } = useLiveSession();
  return useMemo(
    () =>
      MOCK.livePids.map((m) => ({
        ...m,
        idle: values[m.key] ?? null,
        drive: values[m.key] ?? null,
        jitter: 0,
      })),
    [values],
  );
}
