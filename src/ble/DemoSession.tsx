// DemoSession — LiveSession 的 mock 替身(EXPO_PUBLIC_DEMO_MODE=1 时启用)
//
// 目的:电脑前(Mac + iPhone,不要车 + 适配器)验证 Live Activity 渲染 + 主屏 UI。
// 不走 BLE,用 setInterval 喂模拟数据。消费者(HomeScreen / useObdActivity / 领航屏)
// 通过 useLiveSession() 拿到的 context 与真实模式完全同形 —— 一行不改。
//
// 关键:values 的 key 用 UI key(coolant/stft/rpm/speed/oil/ltft),与 LiveSession 的
// OBD_TO_UI 映射后一致。phase 挂载即 'streaming',跳过 BLE 扫描/连接。
//
// 数据模拟策略(不是纯随机,要覆盖典型驾驶场景):
//   水温:25→90°C 暖机曲线(3 min 时间常数),验证 widget 随时间变化
//   STFT:sin + 噪声,基线 ±4,偶发冲到 ±12 触发琥珀 / ±15 触发红
//   转速:怠速 700 + 周期性加速
//   车速:走走停停(负值截断到 0)

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { LivePhase, LiveSessionValue } from './LiveSession';

// 复用 LiveSession 的 context —— 保证 useLiveSession() 在两种模式下都能找到 Provider。
// 两个 Provider(LiveSessionProvider / DemoSessionProvider)往同一个 Ctx 挂值。
// Ctx 从 LiveSession.tsx export(那边是 source of truth)。
import { Ctx as LiveSessionCtx } from './LiveSession';

// Demo 模式挂载即 streaming,跳过 BLE 扫描/连接/初始化
const TICK_MS = 1000;

// 模拟数据生成 —— 基于 sin 波 + 噪声,覆盖典型驾驶场景
function generateSample(t: number): Record<string, number> {
  // 水温:25→90°C 暖机曲线,3 min 时间常数
  const coolant = 25 + (90 - 25) * (1 - Math.exp(-t / 180));

  // STFT:基线 sin 摆动 ±4,加 ±3 噪声。偶发(每 ~20s 一次)冲到 ±12 触发琥珀
  const stftBase = Math.sin(t / 3) * 4 + (Math.random() - 0.5) * 6;
  const stftSpike = Math.sin(t / 20) > 0.95 ? Math.sin(t / 2) * 12 : 0;
  const stft = Math.max(-20, Math.min(20, stftBase + stftSpike));

  // 转速:怠速 700 + 周期性加速(0-2500)
  const rpm = Math.round(700 + Math.abs(Math.sin(t / 8)) * 2500 + (Math.random() - 0.5) * 200);

  // 车速:走走停停,负值截断
  const speedRaw = Math.sin(t / 10) * 40 + (Math.random() - 0.5) * 10;
  const speed = Math.max(0, Math.round(speedRaw));

  // 长期燃油修正:缓慢漂移 ±3
  const ltft = Math.sin(t / 60) * 3 + (Math.random() - 0.5) * 0.5;

  // 机油温度:跟水温但更高更稳(85-105)
  const oil = Math.min(110, coolant + 10 + Math.sin(t / 30) * 3);

  return { rpm, speed, coolant, oil, stft, ltft };
}

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<LivePhase>('streaming');
  const [values, setValues] = useState<Record<string, number>>({});
  const [elapsedSec, setElapsedSec] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [error] = useState<string | null>(null);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpeedRef = useRef<{ t: number; v: number } | null>(null);

  const stopTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const startTick = () => {
    stopTick();
    const startTs = Date.now();
    setValues({});
    setElapsedSec(0);
    setDistanceKm(0);
    lastSpeedRef.current = null;
    tickRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTs) / 1000);
      setElapsedSec(elapsed);
      const next = generateSample(elapsed);
      setValues(next);
      // 里程积分:按车速 km/h,1s 间隔 → /3600
      if (lastSpeedRef.current) {
        const dt = elapsed - lastSpeedRef.current.t;
        const avg = (lastSpeedRef.current.v + next.speed) / 2;
        setDistanceKm((prev) => prev + (avg * dt) / 3600);
      }
      lastSpeedRef.current = { t: elapsed, v: next.speed };
    }, TICK_MS);
  };

  // 挂载即开始(模拟「上车后自动连接」)
  useEffect(() => {
    startTick();
    return () => stopTick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = () => {
    setPhase('streaming');
    startTick();
  };

  const disconnect = async () => {
    stopTick();
    setPhase('idle');
    setValues({});
    setElapsedSec(0);
    setDistanceKm(0);
  };

  const value = useMemo<LiveSessionValue>(
    () => ({ phase, values, elapsedSec, distanceKm, error, connect, disconnect }),
    [phase, values, elapsedSec, distanceKm, error, connect, disconnect],
  );

  return <LiveSessionCtx.Provider value={value}>{children}</LiveSessionCtx.Provider>;
}
