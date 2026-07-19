import { View, Text } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Ring } from '../components/Ring';
import { Badge } from '../components/Badge';
import { ToneIcon } from '../components/ToneIcon';
import { AskButton } from '../components/AskButton';
import { Icon } from '../components/Icon';
import { useTheme } from '../context/Theme';
import { useOutlook } from '../hooks/useOutlook';
import type { Finding } from '../data/mock';

// Health — 健康展望。对照 prototype/screensB.jsx HealthScreen。
export function HealthScreen() {
  const t = useTheme();
  const O = useOutlook();
  const scoreCol = O.score >= 80 ? t.green : (O.score >= 60 ? t.amber : t.red);

  const Section = ({ title, items }: { title: string; items: Finding[] }) => (
    <>
      <Text style={{ color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 }}>{title}</Text>
      {items.map((it, i) => (
        <Card key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <ToneIcon tone={it.tone} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.label, fontSize: 16, fontWeight: '600' }}>{it.title}</Text>
            <Text style={{ color: t.label2, fontSize: 14.5, lineHeight: 22, marginTop: 4 }}>{it.detail}</Text>
            {it.action ? (
              <View style={{ flexDirection: 'row', gap: 7, marginTop: 10, backgroundColor: t.fill, borderRadius: 10, padding: 9 }}>
                <Text style={{ color: t.orange, fontWeight: '700' }}>建议</Text>
                <Text style={{ color: t.label, fontSize: 14, lineHeight: 20 }}>{it.action}</Text>
              </View>
            ) : null}
          </View>
        </Card>
      ))}
    </>
  );

  return (
    <Screen title="健康展望" right={<AskButton />}>
      <Card style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
        <Ring value={O.score} color={scoreCol} size={104} stroke={10}>
          <Text style={{ color: t.label, fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'], lineHeight: 30 }}>{O.score}</Text>
          <Text style={{ color: t.label2, fontSize: 11, marginTop: 2 }}>健康分</Text>
        </Ring>
        <View style={{ flex: 1 }}>
          <Badge tone={O.verdictTone}>{O.verdictLabel}</Badge>
          <Text style={{ color: t.label, fontSize: 15.5, lineHeight: 23, marginTop: 8 }}>{O.headline}</Text>
        </View>
      </Card>
      <Section title="当前需要关注" items={O.current} />
      <Section title="未来可能出现的问题" items={O.future} />
      <Text style={{ color: t.label2, fontSize: 13, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 }}>目前一切正常</Text>
      <Card pad={0}>
        {O.normal.map((n, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 16, paddingVertical: 12,
              borderBottomWidth: i < O.normal.length - 1 ? 0.5 : 0,
              borderBottomColor: t.sep,
            }}
          >
            <Icon name="checkcircle" size={20} color={t.green} />
            <Text style={{ color: t.label, fontSize: 15 }}>{n}</Text>
          </View>
        ))}
      </Card>
      <Text style={{ color: t.label3, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 8, textAlign: 'center' }}>
        展望由 AI 依据长期趋势推测,仅供参考,不构成维修结论。
      </Text>
    </Screen>
  );
}
