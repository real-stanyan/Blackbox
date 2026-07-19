// 备份:原 V0 调试 UI(Connect/Poll/Stop/Analyze/Export + 控制台)。
// 保留给 BLE 开发期看日志用;主 App.tsx 已切换为 RootNavigator(sub-project A)。
// V0 → 消费者版方向见 Protocol gap issue。
import { useCallback, useRef, useState } from 'react';
import {
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { Device } from 'react-native-ble-plx';
import { BleTransport } from './src/ble/BleTransport';
import { ElmSession, Sample } from './src/obd/ElmSession';
import { PIDS } from './src/obd/pids';
import { extractFeatures } from './src/analysis/features';
import { analyzeTrip, TripReport } from './src/analysis/minimax';

type Phase = 'idle' | 'connecting' | 'ready' | 'polling' | 'error';
const KEY_STORAGE = 'minimax_api_key';
const SEVERITY_COLOR: Record<string, string> = { info: '#58a6ff', watch: '#d29922', inspect: '#f85149' };

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [live, setLive] = useState<Record<string, number>>({});
  const [sampleCount, setSampleCount] = useState(0);
  const [report, setReport] = useState<TripReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [keyModalVisible, setKeyModalVisible] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [scanVisible, setScanVisible] = useState(false);
  const [found, setFound] = useState<{ id: string; name: string; rssi: number }[]>([]);
  const devicesRef = useRef<Map<string, Device>>(new Map());
  const stopScanRef = useRef<(() => void) | null>(null);

  const transportRef = useRef<BleTransport | null>(null);
  const sessionRef = useRef<ElmSession | null>(null);
  const samplesRef = useRef<Sample[]>([]);
  const pollingRef = useRef(false);

  const log = useCallback((line: string) => {
    setLines((prev) => [...prev.slice(-200), line]);
  }, []);

  const requestAndroidPermissions = async () => {
    if (Platform.OS !== 'android') return;
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
  };

  const startScan = async () => {
    try {
      await requestAndroidPermissions();
      const transport = new BleTransport(log);
      transportRef.current = transport;
      devicesRef.current.clear();
      setFound([]);
      setScanVisible(true);
      stopScanRef.current = transport.startScan((device) => {
        devicesRef.current.set(device.id, device);
        setFound(
          [...devicesRef.current.values()]
            .map((d) => ({ id: d.id, name: d.name ?? d.localName ?? '(unnamed)', rssi: d.rssi ?? -100 }))
            .sort((a, b) => {
              const aHit = /OBD|CX|LINK|STN|VLINK/i.test(a.name) ? 1 : 0;
              const bHit = /OBD|CX|LINK|STN|VLINK/i.test(b.name) ? 1 : 0;
              return bHit - aHit || b.rssi - a.rssi;
            })
        );
      });
    } catch (e: any) {
      log(`!! ${e.message}`);
      setPhase('error');
    }
  };

  const connectTo = async (id: string) => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    setScanVisible(false);
    const device = devicesRef.current.get(id);
    const transport = transportRef.current;
    if (!device || !transport) return;
    setPhase('connecting');
    try {
      await transport.connect(device);
      const session = new ElmSession(transport, log);
      sessionRef.current = session;
      await session.init();
      log('== Ready. Start polling. ==');
      setPhase('ready');
    } catch (e: any) {
      log(`!! ${e.message}`);
      setPhase('error');
    }
  };

  const cancelScan = () => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    setScanVisible(false);
  };

  const poll = async () => {
    const session = sessionRef.current;
    if (!session) return;
    pollingRef.current = true;
    setPhase('polling');
    while (pollingRef.current) {
      for (const pid of PIDS) {
        if (!pollingRef.current) break;
        try {
          const sample = await session.queryPid(pid);
          if (sample) {
            samplesRef.current.push(sample);
            setLive((prev) => ({ ...prev, [pid.key]: sample.value }));
            setSampleCount(samplesRef.current.length);
          }
        } catch (e: any) {
          log(`!! poll ${pid.request}: ${e.message}`);
          pollingRef.current = false;
          setPhase('error');
          return;
        }
      }
    }
    setPhase('ready');
  };

  const stop = () => {
    pollingRef.current = false;
  };

  const analyze = async () => {
    const apiKey = await SecureStore.getItemAsync(KEY_STORAGE);
    if (!apiKey) {
      setKeyModalVisible(true);
      return;
    }
    setAnalyzing(true);
    setReport(null);
    try {
      const features = extractFeatures(samplesRef.current);
      log(`Analyzing: ${features.totalSamples} samples, ${features.durationMin} min, ${features.ruleAlerts.length} rule alerts...`);
      const r = await analyzeTrip(features, apiKey);
      setReport(r);
      log(`== Report: ${r.findings.length} findings (${r.rejectedCount} rejected by evidence check) ==`);
    } catch (e: any) {
      log(`!! analyze: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const saveKey = async () => {
    const trimmed = keyDraft.trim();
    if (trimmed) {
      await SecureStore.setItemAsync(KEY_STORAGE, trimmed);
      setKeyDraft('');
      setKeyModalVisible(false);
      log('API key saved.');
      analyze();
    }
  };

  const exportJson = async () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        adapter: sessionRef.current?.elmVersion ?? null,
        gatt: transportRef.current?.gattDump ?? null,
        pids: PIDS.map((p) => ({ request: p.request, key: p.key, name: p.name, unit: p.unit })),
        samples: samplesRef.current,
        features: samplesRef.current.length > 0 ? extractFeatures(samplesRef.current) : null,
        report,
      };
      const file = new File(Paths.cache, `obd-session-${Date.now()}.json`);
      file.create();
      file.write(JSON.stringify(payload, null, 2));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
    } catch (e: any) {
      log(`!! export: ${e.message}`);
    }
  };

  const disconnect = async () => {
    pollingRef.current = false;
    await transportRef.current?.disconnect();
    setPhase('idle');
    log('Disconnected.');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>OBD Health Logger</Text>
      <Text style={styles.phase}>state: {phase} · samples: {sampleCount}</Text>

      <View style={styles.liveRow}>
        {PIDS.map((p) => (
          <View key={p.key} style={styles.liveCell}>
            <Text style={styles.liveLabel}>{p.key}</Text>
            <Text style={styles.liveValue}>{live[p.key] !== undefined ? `${live[p.key]}` : '—'}</Text>
            <Text style={styles.liveUnit}>{p.unit}</Text>
          </View>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <Btn label="Connect" onPress={startScan} disabled={phase === 'connecting' || phase === 'polling'} />
        <Btn label="Poll" onPress={poll} disabled={phase !== 'ready'} />
        <Btn label="Stop" onPress={stop} disabled={phase !== 'polling'} />
        <Btn
          label={analyzing ? '...' : 'Analyze'}
          onPress={analyze}
          disabled={analyzing || sampleCount === 0 || phase === 'polling'}
        />
        <Btn label="Export" onPress={exportJson} disabled={sampleCount === 0 && !transportRef.current?.gattDump} />
      </View>

      <ScrollView style={styles.console} ref={(r) => { r?.scrollToEnd({ animated: false }); }}>
        {report && (
          <View style={styles.report}>
            <Text style={styles.reportTitle}>行程健康报告</Text>
            <Text style={styles.reportSummary}>{report.summary}</Text>
            {report.findings.map((f, i) => (
              <View key={i} style={styles.finding}>
                <Text style={[styles.findingHead, { color: SEVERITY_COLOR[f.severity] }]}>
                  [{f.severity} · {f.confidence}] {f.finding}
                </Text>
                {f.evidence.map((ev, j) => (
                  <Text key={j} style={styles.findingEvidence}>· {ev}</Text>
                ))}
                <Text style={styles.findingAction}>→ {f.suggested_action}</Text>
              </View>
            ))}
            {report.rejectedCount > 0 && (
              <Text style={styles.rejected}>{report.rejectedCount} 条发现未通过证据校验，已丢弃</Text>
            )}
            <Text style={styles.disclaimer}>仅供参考，检修请咨询技师。</Text>
          </View>
        )}
        {lines.map((l, i) => (
          <Text key={i} style={styles.consoleLine}>{l}</Text>
        ))}
      </ScrollView>

      <Modal visible={scanVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>选择设备</Text>
            <Text style={styles.modalHint}>
              没看到 OBDLink？先彻底关闭 BimmerLink（它占着连接时 dongle 不广播），拔插 dongle 再扫。
            </Text>
            <ScrollView style={styles.deviceList}>
              {found.length === 0 && <Text style={styles.modalHint}>扫描中…</Text>}
              {found.map((d) => (
                <Pressable key={d.id} onPress={() => connectTo(d.id)} style={styles.deviceRow}>
                  <Text style={styles.deviceName}>{d.name}</Text>
                  <Text style={styles.deviceMeta}>{d.rssi} dBm · {d.id.slice(0, 17)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.buttonRow}>
              <Btn label="Cancel" onPress={cancelScan} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={keyModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>MiniMax API Key</Text>
            <Text style={styles.modalHint}>Token Plan key（sk-cp-...），仅存本机 Keychain。</Text>
            <TextInput
              style={styles.modalInput}
              value={keyDraft}
              onChangeText={setKeyDraft}
              placeholder="sk-cp-..."
              placeholderTextColor="#484f58"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={styles.buttonRow}>
              <Btn label="Cancel" onPress={() => setKeyModalVisible(false)} />
              <Btn label="Save & Analyze" onPress={saveKey} disabled={keyDraft.trim().length === 0} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Btn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btn, disabled && styles.btnDisabled, pressed && styles.btnPressed]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingTop: 60, paddingHorizontal: 12 },
  title: { color: '#e6edf3', fontSize: 16, fontWeight: '700' },
  phase: { color: '#7d8590', fontSize: 12, marginTop: 2, marginBottom: 10 },
  liveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  liveCell: {
    backgroundColor: '#161b22',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  liveLabel: { color: '#7d8590', fontSize: 10 },
  liveValue: { color: '#58a6ff', fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  liveUnit: { color: '#7d8590', fontSize: 10 },
  buttonRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  btn: {
    backgroundColor: '#238636',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexGrow: 1,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#21262d' },
  btnPressed: { opacity: 0.7 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  console: { flex: 1, backgroundColor: '#010409', borderRadius: 8, padding: 8, marginBottom: 20 },
  consoleLine: { color: '#3fb950', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), fontSize: 11 },
  report: { backgroundColor: '#161b22', borderRadius: 8, padding: 10, marginBottom: 10 },
  reportTitle: { color: '#e6edf3', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  reportSummary: { color: '#e6edf3', fontSize: 13, marginBottom: 8 },
  finding: { marginBottom: 8 },
  findingHead: { fontSize: 13, fontWeight: '600' },
  findingEvidence: { color: '#7d8590', fontSize: 12, marginLeft: 8 },
  findingAction: { color: '#3fb950', fontSize: 12, marginLeft: 8 },
  rejected: { color: '#d29922', fontSize: 11, marginTop: 4 },
  disclaimer: { color: '#484f58', fontSize: 10, marginTop: 6 },
  modalBackdrop: { flex: 1, backgroundColor: '#000c', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#161b22', borderRadius: 12, padding: 16 },
  modalTitle: { color: '#e6edf3', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  modalHint: { color: '#7d8590', fontSize: 12, marginBottom: 10 },
  deviceList: { maxHeight: 320, marginBottom: 10 },
  deviceRow: {
    backgroundColor: '#0d1117',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 10,
    marginBottom: 6,
  },
  deviceName: { color: '#e6edf3', fontSize: 14, fontWeight: '600' },
  deviceMeta: { color: '#7d8590', fontSize: 11, marginTop: 2 },
  modalInput: {
    backgroundColor: '#0d1117',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#30363d',
    color: '#e6edf3',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 12,
  },
});
