import { View, Text } from 'react-native';
import { useMemo } from 'react';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { TripChart } from '../../components/TripChart';
import { ToneIcon } from '../../components/ToneIcon';
import { useTheme } from '../../context/Theme';
import { bandFor, isOutOfBand, CHANNEL_LABEL_ZH } from '../../analysis/bands';
import type { ChannelStats } from '../../analysis/features';
import type { Finding, SeriesPoint } from '../../data/types';

export interface ChannelChartCardProps {
  stat: ChannelStats;
  points: SeriesPoint[];
  /** 已按通道过滤好的 AI findings。 */
  findings: Finding[];
}

/**
 * 单通道曲线卡。正常/异常区间来自本地阈值表(bands.ts,与规则层同源);
 * AI 那层只负责「这条通道被 finding 点名了」——徽标 + 一行标题。
 */
export function ChannelChartCard({ stat, points, findings }: ChannelChartCardProps) {
  const t = useTheme();
  const band = bandFor(stat.key);
  const outCount = band ? points.filter((p) => isOutOfBand(p.v, band)).length : 0;

  const s = useMemo(
    () => ({
      head: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        gap: 8,
      },
      label: { color: t.label, fontSize: 16, fontWeight: '600' as const, flexShrink: 1 },
      statRow: { flexDirection: 'row' as const, marginTop: 6, gap: 16 },
      statCell: { flexShrink: 1 },
      statKey: { color: t.label3, fontSize: 11.5 },
      statVal: {
        color: t.label2,
        fontSize: 13.5,
        fontWeight: '600' as const,
        fontVariant: ['tabular-nums' as const],
      },
      chartWrap: { marginTop: 8, marginHorizontal: -2 },
      note: { color: t.label3, fontSize: 12, lineHeight: 17, marginTop: 2 },
      aiRow: {
        flexDirection: 'row' as const,
        gap: 8,
        alignItems: 'flex-start' as const,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 0.5,
        borderTopColor: t.sep,
      },
      aiText: { color: t.label2, fontSize: 13.5, lineHeight: 19, flex: 1 },
    }),
    [t],
  );

  const stats: [string, string][] = [
    ['最低', String(stat.min)],
    ['均值', String(stat.mean)],
    ['最高', String(stat.max)],
  ];

  return (
    <Card>
      <View style={s.head}>
        <Text style={s.label}>
          {CHANNEL_LABEL_ZH[stat.key] ?? stat.name} <Text style={s.statKey}>{stat.unit}</Text>
        </Text>
        {band ? (
          outCount > 0 ? (
            <Badge tone="inspect">{outCount} 点超出正常范围</Badge>
          ) : (
            <Badge tone="good">全程正常范围内</Badge>
          )
        ) : (
          <Text style={s.statKey}>无阈值参考</Text>
        )}
      </View>

      <View style={s.statRow}>
        {stats.map(([k, v]) => (
          <View key={k} style={s.statCell}>
            <Text style={s.statKey}>{k}</Text>
            <Text style={s.statVal}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={s.chartWrap}>
        <TripChart points={points} band={band} />
      </View>

      <Text style={s.note}>
        {band ? `绿色带 = ${band.note};红色区 = 异常` : '该通道无本地阈值,仅展示曲线'}
      </Text>

      {findings.map((f, i) => (
        <View key={i} style={s.aiRow}>
          <ToneIcon tone={f.tone} size={17} />
          <Text style={s.aiText}>{f.title}</Text>
        </View>
      ))}
    </Card>
  );
}
