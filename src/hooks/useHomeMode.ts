// A 阶段:dev override。Settings 底部 __DEV__ toggle 切 idle/driving。
// B 阶段接入真 BLE 后,这里换成「BLE 连接状态」的 derived 值。
import { useState, useCallback } from 'react';

export type HomeMode = 'idle' | 'driving';

export function useHomeMode() {
  // A 阶段默认 driving(展示有数据的样子)
  const [mode, setMode] = useState<HomeMode>('driving');
  const toggle = useCallback(() => {
    setMode((m) => (m === 'driving' ? 'idle' : 'driving'));
  }, []);
  return { mode, setMode, toggle };
}
