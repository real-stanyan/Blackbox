import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { BleTransport } from './BleTransport';
import { ElmSession, Sample } from '../obd/ElmSession';
import { PIDS } from '../obd/pids';
import { extractFeatures } from '../analysis/features';
import { buildSeries } from '../analysis/series';
import { computeMetrics } from '../analysis/tripMetrics';
import { verdictFromTrip } from '../analysis/verdict';
import { saveTrip } from '../data/tripStore';
import { TripRecord } from '../data/types';
import { notifyConnected, notifyDisconnected } from '../notifications/notify';
import { runAnalysis } from '../analysis/runAnalysis';
import { setVehicle } from '../data/settingsStore';
import { useObdActivity } from '../widgets/useObdActivity';

export type LivePhase = 'idle' | 'scanning' | 'connecting' | 'streaming' | 'error';

// OBD PID key(src/obd/pids.ts)→ UI tile key(livePidMeta.ts)
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
// 断开后的行程宽限:期间重连成功 = 同一行程继续;超时 = 行程结束落盘(spec §1/§2)。
const GRACE_MS = 20_000;
const MIN_TRIP_MS = 60_000;
const MIN_TRIP_SAMPLES = 20;

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

  // iOS Live Activity(灵动岛 + 锁屏 widget)— 推水温/STFT 实时数据,ADR-0029
  const activity = useObdActivity();

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
  // 进行中的行程。跨 BLE 重连存活 — 只有宽限超时或手动断开才终结。
  const tripRef = useRef<{ startedAt: number; samples: Sample[]; distanceKm: number } | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const clearGrace = () => {
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  };

  // 行程终结:合格 → 提特征落盘 + 触发分析;太短 → 丢弃。通知合并在这里发。
  const finalizeTrip = useCallback((notify: boolean) => {
    clearGrace();
    const trip = tripRef.current;
    tripRef.current = null;
    setValues({});
    setElapsedSec(0);
    setDistanceKm(0);
    // 关 Live Activity —— 行程结束(无论合格与否),用户已下车。
    // 注意:fail() 进 grace 期间不调 finalizeTrip,activity 跨重连保持。
    activity.sync('idle', null);
    if (!trip) return;
    const endedAt = Date.now();
    const durMs = endedAt - trip.startedAt;
    if (durMs < MIN_TRIP_MS || trip.samples.length < MIN_TRIP_SAMPLES) {
      console.log(`[trip] 丢弃过短行程 ${Math.round(durMs / 1000)}s / ${trip.samples.length} samples`);
      if (notify) void notifyDisconnected(null);
      return;
    }
    const features = extractFeatures(trip.samples);
    const record: TripRecord = {
      id: String(trip.startedAt),
      startedAt: trip.startedAt,
      endedAt,
      durationMin: Math.round((durMs / 60000) * 10) / 10,
      distanceKm: Math.round(trip.distanceKm * 100) / 100,
      samples: trip.samples.length,
      metrics: computeMetrics(trip.samples),
      features,
      series: buildSeries(trip.samples),
      report: null,
      verdict: verdictFromTrip(features, null),
    };
    void saveTrip(record)
      .then(() => {
        if (notify) void notifyDisconnected({ durMin: record.durationMin, distKm: record.distanceKm });
        void runAnalysis(record);
      })
      .catch((e) => {
        console.log(`[trip] 落盘失败: ${e}`);
        if (notify) void notifyDisconnected(null);
      });
  }, [activity.sync]);

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
      // 行程还在:给 20s 宽限,重连成功继续同一行程;超时才终结+通知
      if (tripRef.current && !graceTimerRef.current) {
        graceTimerRef.current = setTimeout(() => {
          graceTimerRef.current = null;
          finalizeTrip(true);
        }, GRACE_MS);
      }
      if (wantConnRef.current) {
        clearReconnect();
        reconnectTimerRef.current = setTimeout(() => connectRef.current(), RECONNECT_DELAY_MS);
      }
    },
    [setPhase, finalizeTrip],
  );

  const disconnect = useCallback(async () => {
    wantConnRef.current = false; // 手动断开 = 用户不想连了,停掉自动重连
    clearReconnect();
    cleanupScan();
    stopStreaming();
    await transportRef.current?.disconnect().catch(() => {});
    finalizeTrip(false);
    setError(null);
    setPhase('idle');
  }, [setPhase, finalizeTrip]);

  const startPolling = useCallback(
    (session: ElmSession, deviceName: string) => {
      pollingRef.current = true;
      clearGrace(); // 宽限内重连成功 → 同一行程继续
      const isNewTrip = !tripRef.current;
      if (isNewTrip) {
        tripRef.current = { startedAt: Date.now(), samples: [], distanceKm: 0 };
        setValues({});
        setDistanceKm(0);
        void notifyConnected(deviceName);
        void setVehicle({ adapter: deviceName });
      }
      const trip = tripRef.current!;
      setElapsedSec(Math.floor((Date.now() - trip.startedAt) / 1000));
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - trip.startedAt) / 1000));
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
              // Sample.t 是 ElmSession 起算 — 重连会归零。行程内统一改用行程起算。
              const tripSample: Sample = { ...sample, t: Date.now() - trip.startedAt };
              trip.samples.push(tripSample);
              const uiKey = OBD_TO_UI[sample.key] ?? sample.key;
              setValues((prev) => {
                const next = { ...prev, [uiKey]: sample.value };
                // 推 Live Activity:只关心 coolant/stft。在 setValues callback 内
                // 同步取最新值(避免 useEffect 监听 values 多一跳 + 浅比较漏更新)。
                activity.sync('streaming', {
                  coolant: next.coolant ?? null,
                  stft: next.stft ?? null,
                });
                return next;
              });
              if (sample.key === 'speed') {
                if (lastSpeed) {
                  const dtH = (tripSample.t - lastSpeed.t) / 3_600_000;
                  const avg = (lastSpeed.v + sample.value) / 2;
                  trip.distanceKm += avg * dtH;
                  setDistanceKm(trip.distanceKm);
                }
                lastSpeed = { t: tripSample.t, v: sample.value };
              }
            } catch (e: any) {
              if (pollingRef.current) await fail(`连接中断:${e.message}`);
              return;
            }
          }
        }
      })();
    },
    [fail, activity.sync],
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
              startPolling(session, name || 'OBD 适配器');
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
      clearGrace(); // app 卸载即进程终结,行程内存数据无处落 — 不强行 finalize
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
