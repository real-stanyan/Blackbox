import { View, Text } from 'react-native';
import { useMemo } from 'react';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { LineChart } from '../../components/LineChart';
import { useTheme } from '../../context/Theme';
import type { Trend } from '../../data/mock';

export interface TrendCardProps {
  tr: Trend;
}

// Trends 的卡片。对照 prototype/screensB.jsx TrendCard。
export function TrendCard({ tr }: TrendCardProps) {
  const t = useTheme();
  const color = tr.tone === 'watch' ? t.amber : (tr.tone === 'inspect' ? t.red : t.green);
  const arrow = tr.dir === 'up' ? '↑' : (tr.dir === 'down' ? '↓' : '→');
  const s = useMemo(
    () => ({
      head: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'flex-start' as const,
        marginBottom: 4,
      },
      label: { color: t.label, fontSize: 16, fontWeight: '600' as const },
      valRow: {
        flexDirection: 'row' as const,
        alignItems: 'baseline' as const,
        gap: 5,
        marginTop: 4,
      },
      now: {
        color: t.label,
        fontSize: 26,
        fontWeight: '700' as const,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums' as const],
      },
      unit: { color: t.label2, fontSize: 13 },
      arrow: { color, fontSize: 15, fontWeight: '700' as const, marginLeft: 2 },
      chartWrap: { marginHorizontal: -4, marginTop: 8 },
      note: { color: t.label2, fontSize: 13.5, lineHeight: 20, marginTop: 6 },
    }),
    [t, color],
  );
  return (
    <Card>
      <View style={s.head}>
        <View>
          <Text style={s.label}>{tr.label}</Text>
          <View style={s.valRow}>
            <Text style={s.now}>{tr.now}</Text>
            <Text style={s.unit}>{tr.unit}</Text>
            <Text style={s.arrow}>{arrow}</Text>
          </View>
        </View>
        <Badge tone={tr.tone === 'watch' ? 'watch' : 'good'}>{tr.tone === 'watch' ? '需留意' : '正常'}</Badge>
      </View>
      <View style={s.chartWrap}>
        <LineChart series={tr.series} months={tr.months} color={color} unit={tr.unit} />
      </View>
      <Text style={s.note}>{tr.note}</Text>
    </Card>
  );
}
