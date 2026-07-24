// 本地通知(ADR-0028):触发源是本机 BLE 状态机,不需要远程 push。
// Expo v57 docs: scheduleNotificationAsync + trigger:null = 立即投递。
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { getSettings } from '../data/settingsStore';

let permitted = false;

export async function initNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // 前台我们本来就不推;此 handler 只兜底
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('ble', {
        name: '连接与行程',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    permitted = status === 'granted';
  } catch (e) {
    console.log(`[notify] init 失败: ${e}`);
  }
}

async function push(title: string, body: string, sound: boolean): Promise<void> {
  // 前台不推:UI 本身就显示状态(spec §1)
  if (!permitted || AppState.currentState === 'active') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound },
      trigger: null,
    });
  } catch (e) {
    console.log(`[notify] 推送失败: ${e}`);
  }
}

export async function notifyConnected(adapterName: string): Promise<void> {
  if (!getSettings().notifyConn) return;
  await push('已连接', `${adapterName} · 行程记录中`, getSettings().chime);
}

export async function notifyDisconnected(saved: { durMin: number; distKm: number } | null): Promise<void> {
  if (!getSettings().notifyDis) return;
  const body = saved
    ? `行程已保存 · ${Math.round(saved.durMin)} 分钟 / ${saved.distKm.toFixed(1)} km`
    : '连接已断开';
  await push('已断开', body, getSettings().chime);
}

export async function notifyReportReady(tripTitle: string): Promise<void> {
  if (!getSettings().notifyReport) return;
  await push('行程报告已生成', tripTitle, false);
}
