import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Group } from '../components/Group';
import { Row } from '../components/Row';
import { Badge } from '../components/Badge';
import { Icon } from '../components/Icon';
import { VERDICT } from '../styles/tokens';
import { useTheme } from '../context/Theme';
import { useTrips } from '../hooks/useTrips';
import { Text, View } from 'react-native';
import { useMemo } from 'react';

// History — 行程历史 list。对照 prototype/screensA.jsx HistoryScreen。
export function HistoryScreen() {
  const t = useTheme();
  const trips = useTrips();
  const navigation = useNavigation<any>();

  const groups = useMemo(() => {
    const out: { name: string; items: typeof trips }[] = [];
    for (const tr of trips) {
      let g = out.find((x) => x.name === tr.group);
      if (!g) {
        g = { name: tr.group, items: [] };
        out.push(g);
      }
      g.items.push(tr);
    }
    return out;
  }, [trips]);

  const iconBg = (v: string) => (v === 'watch' ? t.amber : (v === 'inspect' ? t.red : t.green));

  const below = (
    <Text style={{ color: t.label2, fontSize: 14, paddingHorizontal: 16, paddingBottom: 6 }}>
      每次断开连接后,自动记录并生成一份健康报告。
    </Text>
  );

  if (trips.length === 0) {
    return (
      <Screen title="行程历史" below={below}>
        <Card style={{ alignItems: 'center', paddingVertical: 36 }}>
          <Icon name="car" size={34} color={t.label3} />
          <Text style={{ color: t.label2, fontSize: 15, marginTop: 10 }}>还没有行程</Text>
          <Text style={{ color: t.label3, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 30 }}>
            连上车开一段,断开后会自动记录并生成报告。
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="行程历史" below={below}>
      {groups.map((g) => (
        <Group key={g.name} header={g.name}>
          {g.items.map((tr, i) => (
            <Row
              key={tr.id}
              icon="car"
              iconBg={iconBg(tr.verdict)}
              title={tr.title}
              sub={`${tr.time} · ${tr.dist} km · ${tr.dur} 分钟`}
              last={i === g.items.length - 1}
              onClick={() => navigation.navigate('TripDetail', { tripId: tr.id })}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Badge tone={tr.verdict}>{VERDICT[tr.verdict][0]}</Badge>
                  <Icon name="chevron" size={17} color={t.label3} />
                </View>
              }
            />
          ))}
        </Group>
      ))}
    </Screen>
  );
}
