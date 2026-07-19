import { Svg, Polygon, Polyline, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../context/Theme';

export interface LineChartProps {
  series: number[];
  months: string[];
  color: string;
  unit?: string;
  h?: number;
}

// 对照 prototype/kit.jsx LineChart。固定 viewBox 300×96,外层用 aspectRatio
// 自适应宽度(spec §6 LineChart 备注)。
export function LineChart({ series, months, color, h = 96 }: LineChartProps) {
  const t = useTheme();
  const w = 300, pad = 10;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (series.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad - 16);
  const pts = series.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `${pad},${h - 16} ${pts} ${w - pad},${h - 16}`;
  const gradId = `g${color.replace('#', '')}`;
  return (
    <Svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Polygon points={area} fill={`url(#${gradId})`} />
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      {series.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={y(v)} r={i === series.length - 1 ? 3.4 : 0} fill={color} />
      ))}
      {months.map((m, i) => (
        <SvgText key={i} x={x(i)} y={h - 3} fontSize={9} fill={t.label3} textAnchor="middle">
          {m}
        </SvgText>
      ))}
    </Svg>
  );
}
