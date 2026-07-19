import { View, Text, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { ToneIcon } from '../components/ToneIcon';
import { Group } from '../components/Group';
import { Row } from '../components/Row';
import { useTheme } from '../context/Theme';
import { useTrips } from '../hooks/useTrips';

// TripDetail — 单次 AI 报告。对照 prototype/screensA.jsx TripDetail。
// navigation.goBack() 回 History;tripId 从 route.params 拿。
export function TripDetailScreen() {
  const t = useTheme();
  const trips = useTrips();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const tripId: string = route.params?.tripId;
  const tr = trips.find((x) => x.id === tripId) ?? trips[0];

  const stats: [string, string][] = [
    ['时长', `${tr.dur} 分钟`],
    ['里程', `${tr.dist} km`],
    ['最高水温', `${tr.maxCoolant} °C`],
    ['平均转速', `${tr.avgRpm} rpm`],
    ['冷启动', tr.cold ? '是' : '否'],
    ['采样点', tr.samples.toLocaleString()],
  ];

  const s = {
    belowSub: { color: t.label2, fontSize: 14, paddingHorizontal: 16, paddingBottom: 4 },
    heroRow: { flexDirection: 'row' as const, gap: 14, alignItems: 'flex-start' as const },
    heroTitle: { color: t.label, fontSize: 20, fontWeight: '700' as const },
    heroSummary: { color: t.label2, fontSize: 15, lineHeight: 22, marginTop: 6 },
    sectionLabel: { color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
    cell: {
      width: '50%' as unknown as number,
      paddingHorizontal: 16, paddingVertical: 13,
    },
    cellLabel: { color: t.label2, fontSize: 13 },
    cellValue: {
      color: t.label, fontSize: 20, fontWeight: '600' as const,
      fontVariant: ['tabular-nums' as const], marginTop: 3,
    },
    findingRow: { flexDirection: 'row' as const, gap: 12, alignItems: 'flex-start' as const },
    findingTitle: { color: t.label, fontSize: 16, fontWeight: '600' as const },
    findingDetail: { color: t.label2, fontSize: 14.5, lineHeight: 22, marginTop: 4 },
    actionBox: {
      flexDirection: 'row' as const, gap: 7, marginTop: 10,
      backgroundColor: t.fill, borderRadius: 10, padding: 9,
    },
    actionLabel: { color: t.orange, fontWeight: '700' as const },
    actionText: { color: t.label, fontSize: 14, lineHeight: 20 },
    disclaimer: { color: t.label3, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 8, textAlign: 'center' as const },
  };

  return (
    <Screen
      title="行程报告"
      backLabel="行程历史"
      onBack={() => navigation.goBack()}
      below={<Text style={s.belowSub}>{tr.group} {tr.time} · {tr.route}</Text>}
    >
      <Card style={s.heroRow}>
        <ToneIcon tone={tr.verdict} size={30} />
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>
            {tr.verdict === 'good' ? '本次行程发动机状态良好' : '整体良好,有 1 项需要留意'}
          </Text>
          <Text style={s.heroSummary}>{tr.summary}</Text>
        </View>
      </Card>

      <Text style={s.sectionLabel}>本次行程概要</Text>
      <Card pad={0}>
        <View style={s.grid}>
          {stats.map(([k, v], i) => (
            <View
              key={k}
              style={[
                s.cell,
                i < 4 ? { borderBottomWidth: 0.5, borderBottomColor: t.sep } : null,
                i % 2 === 0 ? { borderRightWidth: 0.5, borderRightColor: t.sep } : null,
              ]}
            >
              <Text style={s.cellLabel}>{k}</Text>
              <Text style={s.cellValue}>{v}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Text style={s.sectionLabel}>AI 分析</Text>
      {tr.findings.map((f, i) => (
        <Card key={i} style={s.findingRow}>
          <ToneIcon tone={f.tone} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={s.findingTitle}>{f.title}</Text>
            <Text style={s.findingDetail}>{f.detail}</Text>
            {f.action ? (
              <View style={s.actionBox}>
                <Text style={s.actionLabel}>建议</Text>
                <Text style={s.actionText}>{f.action}</Text>
              </View>
            ) : null}
          </View>
        </Card>
      ))}

      <Group style={{ marginTop: 8 }}>
        <Row icon="share" iconBg={t.blue} title="分享报告" accessory={null} onClick={() => {}} />
        <Row
          icon="route"
          iconBg={t.label2}
          title="导出行程数据 (JSON)"
          accessory={null}
          last
          onClick={() => Alert.alert('sub-project C', '导出功能将在持久化层接入后实现')}
        />
      </Group>
      <Text style={s.disclaimer}>
        报告由 AI 依据本次行程数据生成,仅供参考。发动机检修请咨询专业技师。
      </Text>
    </Screen>
  );
}
