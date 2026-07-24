import { View, Text } from 'react-native';
import { useMemo } from 'react';
import { Card } from '../../components/Card';
import { useTheme } from '../../context/Theme';
import { useLiveScore } from '../../hooks/useLiveScore';

// 5 分钟滚动 AI 评分卡。没有结果时整卡不渲染(首次结果要等行程 5 分钟)。
export function LiveScoreCard() {
  const t = useTheme();
  const score = useLiveScore();
  const color =
    score == null ? t.label3 : score.score >= 80 ? t.green : score.score >= 60 ? t.orange : t.red;
  const s = useMemo(
    () => ({
      row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16 },
      score: {
        color,
        fontSize: 44,
        fontWeight: '700' as const,
        letterSpacing: -1,
        fontVariant: ['tabular-nums' as const],
        minWidth: 64,
        textAlign: 'center' as const,
      },
      right: { flex: 1, minWidth: 0 },
      label: { color: t.label2, fontSize: 13, marginBottom: 3 },
      problem: { color: t.label, fontSize: 15, lineHeight: 20 },
      time: { color: t.label3, fontSize: 11, marginTop: 4 },
    }),
    [t, color],
  );
  if (!score) return null;
  const mins = Math.max(0, Math.round((Date.now() - score.at) / 60000));
  return (
    <Card>
      <View style={s.row}>
        <Text style={s.score}>{score.score}</Text>
        <View style={s.right}>
          <Text style={s.label}>实时评分{score.stale ? ' · 已过期' : ''}</Text>
          <Text style={s.problem}>{score.problem}</Text>
          <Text style={s.time}>{mins === 0 ? '刚刚更新' : `${mins} 分钟前更新`}</Text>
        </View>
      </View>
    </Card>
  );
}
