import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { BleTransport } from './BleTransport';
import { ElmSession } from '../obd/ElmSession';
import { PIDS } from '../obd/pids';

export type LivePhase = 'idle' | 'scanning' | 'connecting' | 'streaming' | 'error';

// OBD PID key(src/obd/pids.ts)→ UI tile key(MOCK.livePids)
const OBD_TO_UI: Record<string, string> = {
  rpm: 'rpm',
  speed: 'speed',
  coolant_temp: 'coolant',
  oil_temp: 'oil',
  stft_b1: 'stft',
  ltft_b1: 'ltft',
};

const ADAPTER_NAME = /OBD|CX|LINK|STN|VLINK/i;
const SCAN_TIMEOUT_MS = 30_000;
// 断连后重试间隔。上车后适配器上电有延迟、行程中偶发掉线 —— 只要用户没手动断开就一直重试。
const RECONNECT_DELAY_MS = 4_000;

interface LiveSessionValue {
  phase: LivePhase;
  /** UI key → 最新读数 */
  values: Record<string, number>;
  /** streaming 起算秒数 */
  elapsedSec: number;
  /** 车速梯形积分里程 */
  distanceKm: number;
  error: string | null;
  connect: () => void;
  disconnect: () => Promise<void>;
}

const Ctx = createContext<LiveSessionValue | null>(null);

export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhaseState] = useState<LivePhase>('idle');
  const [values, setValues] = useState<Record<string, number>>({});
  const [elapsedSec, setElapsedSec] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const phaseRef = useRef<LivePhase>('idle');
  const transportRef = useRef<BleTransport | null>(null);
  const pollingRef = useRef(false);
  const stopScanRef = useRef<(() => void) | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 用户是否想保持连接。true = 自动连接/断连自愈;手动 disconnect() 置 false 才停。
  // 默认 true → 挂载即自动连接(兑现 UI「上车后自动连接,无需操作」)。
  const wantConnRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // connect 是 useCallback,fail 里要调它但先于它定义 —— 用 ref 打破循环依赖。
  const connectRef = useRef<() => void>(() => {});

  const setPhase = useCallback((p: LivePhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const getTransport = () => {
    if (!transportRef.current) {
      transportRef.current = new BleTransport((line) => console.log(`[ble] ${line}`));
    }
    return transportRef.current;
  };

  const cleanupScan = () => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  };

  const stopStreaming = () => {
    pollingRef.current = false;
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  const clearReconnect = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const fail = useCallback(
    async (message: string) => {
      cleanupScan();
      stopStreaming();
      await transportRef.current?.disconnect().catch(() => {});
      setError(message);
      setPhase('error');
      // 用户仍想连着(没手动断)→ 隔一会儿自动重连,直到成功或用户 disconnect。
      if (wantConnRef.current) {
        clearReconnect();
        reconnectTimerRef.current = setTimeout(() => connectRef.current(), RECONNECT_DELAY_MS);
      }
    },
    [setPhase],
  );

  const disconnect = useCallback(async () => {
    wantConnRef.current = false; // 手动断开 = 用户不想连了,停掉自动重连
    clearReconnect();
    cleanupScan();
    stopStreaming();
    await transportRef.current?.disconnect().catch(() => {});
    setValues({});
    setElapsedSec(0);
    setDistanceKm(0);
    setError(null);
    setPhase('idle');
  }, [setPhase]);

  const startPolling = useCallback(
    (session: ElmSession) => {
      pollingRef.current = true;
      setValues({});
      setElapsedSec(0);
      setDistanceKm(0);
      const startedAt = Date.now();
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);

      void (async () => {
        // App.debug.tsx 同款轮询;queryPid 返回 null(车型不支持,如 oil_temp)
        // 不是错误 — 跳过继续。抛错(超时/断连)才终止会话。
        let lastSpeed: { t: number; v: number } | null = null;
        while (pollingRef.current) {
          for (const pid of PIDS) {
            if (!pollingRef.current) break;
            try {
              const sample = await session.queryPid(pid);
              if (!sample) continue;
              setValues((prev) => ({ ...prev, [OBD_TO_UI[sample.key] ?? sample.key]: sample.value }));
              if (sample.key === 'speed') {
                if (lastSpeed) {
                  const dtH = (sample.t - lastSpeed.t) / 3_600_000;
                  const avg = (lastSpeed.v + sample.value) / 2;
                  setDistanceKm((d) => d + avg * dtH);
                }
                lastSpeed = { t: sample.t, v: sample.value };
              }
            } catch (e: any) {
              if (pollingRef.current) await fail(`连接中断:${e.message}`);
              return;
            }
          }
        }
      })();
    },
    [fail],
  );

  const connect = useCallback(() => {
    wantConnRef.current = true; // 手动/自动触发都表明用户想连着
    clearReconnect();
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'error') return;
    setError(null);
    setPhase('scanning');
    void (async () => {
      try {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
        }
        const transport = getTransport();
        let picked = false;
        scanTimerRef.current = setTimeout(() => {
          if (!picked) {
            cleanupScan();
            void fail('未扫描到 OBD 适配器 — 确认已插好且未被其它 App 占用');
          }
        }, SCAN_TIMEOUT_MS);
        stopScanRef.current = transport.startScan((device: Device) => {
          const name = device.name ?? device.localName ?? '';
          if (picked || !ADAPTER_NAME.test(name)) return;
          picked = true;
          cleanupScan();
          void (async () => {
            // disconnect() 可能在扫描/连接中途把状态拉回 idle — 每个 await 后核对再推进
            if (phaseRef.current !== 'scanning') return;
            try {
              setPhase('connecting');
              await transport.connect(device);
              const session = new ElmSession(transport, (line) => console.log(`[obd] ${line}`));
              await session.init();
              // as LivePhase:TS 看不见 setPhase 对 ref 的 mutation,会把窄化保持在 'scanning'
              if ((phaseRef.current as LivePhase) !== 'connecting') {
                await transport.disconnect().catch(() => {});
                return;
              }
              setPhase('streaming');
              startPolling(session);
            } catch (e: any) {
              await fail(e.message);
            }
          })();
        });
      } catch (e: any) {
        await fail(e.message);
      }
    })();
  }, [fail, setPhase, startPolling]);

  // connect 重建时同步到 ref,供 fail 的重连回调使用
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // 挂载即自动连接一次(兑现「上车后自动连接」)。connect 内部会等蓝牙 PoweredOn。
  // 注:Settings「自动连接」开关目前是 mock(未接线/未持久化),默认恒为开 — 见 issue。
  const didAutoConnect = useRef(false);
  useEffect(() => {
    if (!didAutoConnect.current && wantConnRef.current) {
      didAutoConnect.current = true;
      connect();
    }
  }, [connect]);

  useEffect(
    () => () => {
      clearReconnect();
      cleanupScan();
      stopStreaming();
      transportRef.current?.disconnect().catch(() => {});
      transportRef.current?.destroy();
      transportRef.current = null; // destroyed BleManager 不可复用,重挂载时懒建新实例
    },
    [],
  );

  const value = useMemo(
    () => ({ phase, values, elapsedSec, distanceKm, error, connect, disconnect }),
    [phase, values, elapsedSec, distanceKm, error, connect, disconnect],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLiveSession(): LiveSessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLiveSession must be used within LiveSessionProvider');
  return v;
}
