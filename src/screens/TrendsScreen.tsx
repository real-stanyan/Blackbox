import { useState } from 'react';
import { Text } from 'react-native';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';
import { TrendCard } from './components/TrendCard';
import { useTheme } from '../context/Theme';
import { useTrends } from '../hooks/useTrends';
import { useTrips } from '../hooks/useTrips';

// Trends — 趋势。对照 prototype/screensB.jsx TrendsScreen。
export function TrendsScreen() {
  const t = useTheme();
  const [range, setRange] = useState(1);
  const trends = useTrends();
  const trips = useTrips();

  return (
    <Screen
      title="趋势"
      below={<Segmented options={['近 30 天', '近 3 个月', '近 1 年']} value={range} onChange={setRange} />}
    >
      <Text style={{ color: t.label2, fontSize: 14, paddingHorizontal: 16, paddingBottom: 10, lineHeight: 20 }}>
        把每一次行程累积起来,观察这台发动机随时间的变化。
      </Text>
      <TrendCard tr={trends.ltft} />
      <TrendCard tr={trends.warmup} />
      <TrendCard tr={trends.idle} />
      <TrendCard tr={trends.cold} />
      <Text style={{ color: t.label3, fontSize: 12.5, textAlign: 'center', paddingHorizontal: 40, paddingBottom: 8, lineHeight: 18 }}>
        共记录 {trips.length}+ 次行程。趋势基于历史行程的统计,个别行程的波动属于正常。
      </Text>
    </Screen>
  );
}
