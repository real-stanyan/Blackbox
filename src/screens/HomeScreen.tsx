import { View, Text, Pressable } from 'react-native';
import { useMemo } from 'react';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { AskButton } from '../components/AskButton';
import { StatTile } from './components/StatTile';
import { useTheme } from '../context/Theme';
import { useLivePids } from '../hooks/useLivePids';
import { useVehicle } from '../hooks/useVehicle';
import { useHomeMode } from '../hooks/useHomeMode';
import { useLiveSession } from '../ble/LiveSession';

// Home — 实时。对照 prototype/screensA.jsx HomeScreen。
// B 阶段起数据来自真 BLE(LiveSession),不再有 mock jitter 模拟。
export function HomeScreen() {
  const t = useTheme();
  const pids = useLivePids();
  const vehicle = useVehicle();
  const { mode } = useHomeMode();
  const { phase, elapsedSec, distanceKm, error, connect } = useLiveSession();
  const driving = mode === 'driving';

  const mmss = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`;
  const connLabel =
    phase === 'scanning' ? '扫描中…' : phase === 'connecting' ? '连接中…' : phase === 'error' ? '连接失败 · 点按重试' : '手动连接';
  const connBusy = phase === 'scanning' || phase === 'connecting';

  const s = useMemo(
    () => ({
      heroRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, padding: 18 },
      heroIconWrap: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: driving ? `${t.green}22` : t.fill,
        alignItems: 'center' as const, justifyContent: 'center' as const,
      },
      heroTitle: { color: t.label, fontSize: 19, fontWeight: '600' as const },
      heroSub: { color: t.label2, fontSize: 14, marginTop: 2 },
      heroFooterRow: { flexDirection: 'row' as const, borderTopWidth: 0.5, borderTopColor: t.sep },
      heroCell: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
      heroCellRight: { borderLeftWidth: 0.5, borderLeftColor: t.sep },
      heroCellLabel: { color: t.label2, fontSize: 12 },
      heroCellValue: {
        color: t.label, fontSize: 22, fontWeight: '600' as const,
        fontVariant: ['tabular-nums' as const], marginTop: 2,
      },
      manualConnWrap: { paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: 0.5, borderTopColor: t.sep },
      manualConnText: { color: t.orange, fontSize: 16, fontWeight: '500' as const, textAlign: 'center' as const },
      sectionLabel: { color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
      tilesWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
      idleHint: { color: t.label3, fontSize: 13, textAlign: 'center' as const, paddingHorizontal: 40, paddingTop: 10, lineHeight: 18 },
      errorHint: { color: t.red, fontSize: 13, textAlign: 'center' as const, paddingHorizontal: 40, paddingTop: 10, lineHeight: 18 },
    }),
    [t, driving],
  );

  return (
    <Screen title="实时" right={<AskButton />}>
      {/* Connection hero */}
      <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <View style={s.heroRow}>
          <View style={s.heroIconWrap}>
            {driving ? (
              <Icon name="checkcircle" size={34} color={t.green} />
            ) : (
              <Icon name="bluetooth" size={26} color={t.label2} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.heroTitle}>{driving ? '已连接' : '等待连接'}</Text>
            <Text style={s.heroSub}>
              {driving
                ? `${vehicle.adapter} · ${vehicle.name} ${vehicle.model.split(' · ')[1]}`
                : '上车后自动连接,无需操作'}
            </Text>
          </View>
        </View>
        {driving ? (
          <View style={s.heroFooterRow}>
            <View style={s.heroCell}>
              <Text style={s.heroCellLabel}>本次行程</Text>
              <Text style={s.heroCellValue}>{mmss}</Text>
            </View>
            <View style={[s.heroCell, s.heroCellRight]}>
              <Text style={s.heroCellLabel}>里程</Text>
              <Text style={s.heroCellValue}>{distanceKm.toFixed(1)} km</Text>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={connect}
            disabled={connBusy}
            style={({ pressed }) => [s.manualConnWrap, (pressed || connBusy) && { opacity: 0.6 }]}
          >
            <Text style={s.manualConnText}>{connLabel}</Text>
          </Pressable>
        )}
      </Card>

      <Text style={s.sectionLabel}>{driving ? '实时数据 · 持续更新' : '连接后显示实时数据'}</Text>
      <View style={s.tilesWrap}>
        {pids.map((p) => {
          const has = driving && p.drive != null;
          const isInt = p.key === 'rpm' || p.key === 'speed';
          const v: string | number = has ? (isInt ? Math.round(p.drive!) : p.drive!) : '—';
          const ltftHigh = has && p.key === 'ltft' && Math.abs(p.drive!) >= 5;
          const col = p.key === 'coolant' ? t.blue : ltftHigh ? t.amber : t.label;
          const note = p.key === 'oil' && !has ? p.note : ltftHigh ? '略偏高' : undefined;
          return (
            <StatTile
              key={p.key}
              label={p.label}
              value={v}
              unit={p.unit}
              note={note}
              color={col}
            />
          );
        })}
      </View>
      {phase === 'error' && error ? <Text style={s.errorHint}>{error}</Text> : null}
      {!driving && phase !== 'error' ? (
        <Text style={s.idleHint}>
          连接成功与断开时都会推送通知并响铃,你无需一直盯着这个页面。
        </Text>
      ) : null}
    </Screen>
  );
}
