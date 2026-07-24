// CarPlay 4 行内容(iOS InformationTemplate 上限 4 行,无图)。纯函数于 store 之上,
// 不 import 任何原生模块 — type-only import 编译期擦除。
import type { InformationItems } from '@iternio/react-native-auto-play';
import { getLiveData } from '../data/liveDataStore';
import { getLiveScore } from '../data/liveScoreStore';

const fmt = (v: number | undefined, unit: string) =>
  v == null ? '—' : `${Math.round(v * 10) / 10} ${unit}`;

export function buildCarPlayItems(): InformationItems {
  const live = getLiveData();
  const score = getLiveScore();
  if (!live.streaming) {
    return [
      {
        type: 'text',
        title: { text: 'Not connected' },
        detailedText: { text: 'Start driving to begin a trip' },
      },
    ];
  }
  const durMin = live.startedAt ? Math.floor((Date.now() - live.startedAt) / 60000) : 0;
  return [
    score
      ? {
          type: 'text',
          title: { text: `Score: ${score.score}${score.stale ? ' (stale)' : ''}` },
          detailedText: { text: score.problem },
        }
      : {
          type: 'text',
          title: { text: 'Score: —' },
          detailedText: { text: 'First analysis after 5 minutes' },
        },
    { type: 'text', title: { text: 'Coolant' }, detailedText: { text: fmt(live.values.coolant, '°C') } },
    { type: 'text', title: { text: 'Fuel trim (LTFT)' }, detailedText: { text: fmt(live.values.ltft, '%') } },
    { type: 'text', title: { text: 'Trip' }, detailedText: { text: `${durMin} min · ${fmt(live.distanceKm, 'km')}` } },
  ];
}
