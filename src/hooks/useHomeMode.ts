import { useLiveSession } from '../ble/LiveSession';

export type HomeMode = 'idle' | 'driving';

// B 阶段:BLE 连接状态的派生值(streaming = driving)。A 阶段 dev toggle 已删。
export function useHomeMode(): { mode: HomeMode } {
  const { phase } = useLiveSession();
  return { mode: phase === 'streaming' ? 'driving' : 'idle' };
}
