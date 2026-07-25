// useObdActivity — Live Activity 生命周期 hook
// 封装 start/update/end,跨 phase 变化保持 activity instance(ADR-0029)。
//
// 用法(LiveSessionProvider 内):
//   const activity = useObdActivity();
//   // streaming + 新数据:
//   activity.sync('streaming', { coolant, stft });
//   // 行程结束(非 grace):
//   activity.sync('idle', null);
//
// 策略:
//   - 首次 streaming → factory.start(props),instance ref 化
//   - 后续 streaming → instance.update(props)(节流,见 THROTTLE_MS)
//   - idle/error(且无 grace 行程)→ instance.end(.default),清 ref
//   - connecting/scanning → 不动(activity 不该因过渡态被 kill)
//
// Android:expo-widgets 在 Android no-op,本 hook 直接返回 noop,避免将来 Blackbox
// 跑 Android 时崩。

import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import obdActivityFactory, { type ActivityPhase, type ObdActivityProps } from './ObdLiveActivity';
import type { LiveActivity } from 'expo-widgets';

// update 节流:OBD 每秒多次 setValues(6 个 PID 顺序查),native update 太频繁会卡。
// 500ms 平衡响应性与性能——驾驶场景水温/STFT 变化慢,500ms 足够。
const THROTTLE_MS = 500;

const isIOS = Platform.OS === 'ios';

export interface ObdActivityController {
  /**
   * 同步 phase + 数据到 Live Activity。
   * - phase='streaming' + data → start(首次)或 update(后续)
   * - phase='idle'/'error' → end(若 instance 还在)
   * data 为 null 时只用于 end,不更新内容。
   */
  sync: (phase: ActivityPhase, data: { coolant: number | null; stft: number | null } | null) => void;
}

function noopController(): ObdActivityController {
  return { sync: () => {} };
}

export function useObdActivity(): ObdActivityController {
  // iOS-only:Android 直接 noop
  const instanceRef = useRef<LiveActivity<ObdActivityProps> | null>(null);
  const lastUpdateRef = useRef(0);
  const lastPropsRef = useRef<ObdActivityProps | null>(null);

  // 卸载时清理(保留 activity 不强 end —— iOS 会在 app 杀死后自行清理;
  // 这里只清 ref,避免内存泄漏。行程没结束的话 activity 会继续显示直到系统回收)
  useEffect(() => {
    return () => {
      instanceRef.current = null;
    };
  }, []);

  const sync = useCallback(
    (phase: ActivityPhase, data: { coolant: number | null; stft: number | null } | null) => {
      if (!isIOS) return;

      // 行程结束 → end
      if (phase !== 'streaming') {
        const inst = instanceRef.current;
        instanceRef.current = null;
        lastPropsRef.current = null;
        if (inst) {
          // dismissalPolicy 'default':系统按自己节奏移除(通常 ~4h 窗口内)
          void inst.end('default').catch((e) => console.log(`[activity] end failed: ${e}`));
        }
        return;
      }

      // streaming + 数据
      if (!data) return;
      const props: ObdActivityProps = {
        phase,
        coolant: data.coolant,
        stft: data.stft,
      };

      // 首次 → start
      if (!instanceRef.current) {
        try {
          // factory.start 同步返回 instance(非 Promise)
          instanceRef.current = obdActivityFactory.start(props);
          lastPropsRef.current = props;
          lastUpdateRef.current = Date.now();
        } catch (e) {
          // Apple 限制:start 必须在 app 前台。若 app 已后台会抛。
          // 不致命 —— 下次 sync 会重试。
          console.log(`[activity] start failed: ${e}`);
        }
        return;
      }

      // 后续 → update(带节流)
      const now = Date.now();
      if (now - lastUpdateRef.current < THROTTLE_MS) return;
      lastUpdateRef.current = now;
      lastPropsRef.current = props;
      void instanceRef.current.update(props).catch((e) =>
        console.log(`[activity] update failed: ${e}`),
      );
    },
    [],
  );

  if (!isIOS) return noopController();
  return { sync };
}
