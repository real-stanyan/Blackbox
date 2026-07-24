import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';
import { Screen } from '../components/Screen';
import { Group } from '../components/Group';
import { Row } from '../components/Row';
import { Toggle } from '../components/Toggle';
import { useTheme } from '../context/Theme';
import { useVehicle } from '../hooks/useVehicle';
import { useLiveSession } from '../ble/LiveSession';
import {
  getApiKey, getSettings, setApiKey, setSetting, setVehicle, subscribeSettings,
} from '../data/settingsStore';
import { getIndex, subscribeTrips } from '../data/tripStore';

// Settings — 设置。对照 prototype/screensB.jsx SettingsScreen。
export function SettingsScreen() {
  const t = useTheme();
  const D = useVehicle();
  const s = useSyncExternalStore(subscribeSettings, getSettings);
  const { phase } = useLiveSession();
  const index = useSyncExternalStore(subscribeTrips, getIndex);
  const [hasKey, setHasKey] = useState(false);
  useEffect(() => {
    void getApiKey().then((k) => setHasKey(!!k));
  }, []);

  const totalKm = index.reduce((a, e) => a + e.distanceKm, 0);

  // iOS-only 文本编辑(Alert.prompt)。个人工具主力 iPhone;Android 先提示。
  const promptEdit = (title: string, current: string, onDone: (v: string) => void) => {
    if (Platform.OS !== 'ios') {
      Alert.alert('暂不支持', '车辆信息编辑目前仅支持 iOS。');
      return;
    }
    Alert.prompt(title, undefined, (v) => v != null && onDone(v.trim()), 'plain-text', current);
  };

  return (
    <Screen title="设置">
      <Group header="设备">
        <Row
          icon="bluetooth" iconBg={t.blue} title={D.adapter} sub="蓝牙 OBD 适配器"
          value={phase === 'streaming' ? '已连接' : '未连接'}
          valueColor={phase === 'streaming' ? t.green : t.label3} accessory={null}
        />
        <Row icon="car" iconBg={t.orange} title="自动连接" sub="开关接线见 issue #16,当前恒开" value="开" accessory={null} last />
      </Group>
      <Group header="通知与提示音" footer="连接与断开时推送通知,无需一直查看 App。App 在前台时不推送。">
        <Row icon="sound" iconBg={t.orange} title="连接提示音" right={<Toggle on={s.chime} onChange={(v) => void setSetting('chime', v)} />} />
        <Row icon="bell" iconBg={t.green} title="连接成功推送" right={<Toggle on={s.notifyConn} onChange={(v) => void setSetting('notifyConn', v)} />} />
        <Row icon="bell" iconBg={t.amber} title="连接中断推送" right={<Toggle on={s.notifyDis} onChange={(v) => void setSetting('notifyDis', v)} />} />
        <Row icon="bell" iconBg={t.blue} title="行程报告就绪推送" right={<Toggle on={s.notifyReport} onChange={(v) => void setSetting('notifyReport', v)} />} last />
      </Group>
      <Group header="车辆" footer="总里程 = 里程基线 + App 记录的行程里程。">
        <Row title="车名" value={D.name} accessory="chevron" onClick={() => promptEdit('车名', D.name, (v) => void setVehicle({ name: v }))} />
        <Row title="型号" value={D.model} accessory="chevron" onClick={() => promptEdit('型号', D.model, (v) => void setVehicle({ model: v }))} />
        <Row title="发动机" value={D.engine} accessory="chevron" onClick={() => promptEdit('发动机', D.engine, (v) => void setVehicle({ engine: v }))} />
        <Row title="车牌" value={D.plate} accessory="chevron" onClick={() => promptEdit('车牌', D.plate, (v) => void setVehicle({ plate: v }))} />
        <Row
          title="总里程"
          value={`${Math.round(D.odo + totalKm).toLocaleString()} km`}
          accessory="chevron"
          onClick={() => promptEdit('里程基线 (km)', String(D.odo), (v) => {
            const n = Number(v);
            if (Number.isFinite(n) && n >= 0) void setVehicle({ odo: n });
          })}
          last
        />
      </Group>
      <Group header="AI 分析" footer="Key 仅存本机 SecureStore,不上传。">
        <Row
          title="MiniMax API Key"
          value={hasKey ? '已设置 ••••' : '未设置'}
          accessory="chevron"
          onClick={() =>
            promptEdit('MiniMax API Key(留空清除)', '', (v) => {
              void setApiKey(v).then(() => setHasKey(!!v));
            })
          }
          last
        />
      </Group>
      <Group footer="OBD 健康记录 · 个人工具,数据仅存本机。">
        <Row title="版本" value="1.0.0 (V1)" accessory={null} last />
      </Group>
    </Screen>
  );
}
