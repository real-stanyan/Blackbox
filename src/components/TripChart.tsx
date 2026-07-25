import { Svg, Rect, Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../context/Theme';
import { FONT } from '../styles/tokens';
import type { SeriesPoint } from '../data/types';
import type { ChannelBand } from '../analysis/bands';
import { buildTripChartLayout } from './tripChartGeom';

export interface TripChartProps {
  /** 单通道降采样曲线(t = 距行程开始 ms)。 */
  points: SeriesPoint[];
  /** 正常区间;不传 = 该通道无可辩护阈值,只画曲线。 */
  band?: ChannelBand;
  h?: number;
}

/**
 * 单通道时间序列图。正常区间画淡绿带 + 虚线阈值,越界区间画淡红底且线段转红。
 * 固定 viewBox 320×h,外层给 width="100%" 自适应(同 LineChart 的做法)。
 * 坐标全部来自 tripChartGeom(纯函数,可离线验收),这里只负责上色。
 */
export function TripChart({ points, band, h = 118 }: TripChartProps) {
  const t = useTheme();
  const L = buildTripChartLayout(points, band, { h });
  if (!L) return null;

  const labelX = L.plot.x + L.plot.width + 5;

  return (
    <Svg viewBox={`0 0 ${L.w} ${L.h}`} width="100%" height={L.h}>
      {L.normalRect ? <Rect {...L.normalRect} fill={t.green} opacity={0.08} /> : null}
      {L.aboveRect ? <Rect {...L.aboveRect} fill={t.red} opacity={0.1} /> : null}
      {L.belowRect ? <Rect {...L.belowRect} fill={t.red} opacity={0.1} /> : null}

      {L.edges.map((e) => (
        <Line
          key={`edge${e.v}`}
          x1={L.plot.x}
          y1={e.y}
          x2={L.plot.x + L.plot.width}
          y2={e.y}
          stroke={t.red}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.55}
        />
      ))}
      {L.edges.map((e) => (
        <SvgText
          key={`lab${e.v}`}
          x={labelX}
          y={e.y + 3.5}
          fontSize={9.5}
          fontFamily={FONT}
          fill={t.label3}
        >
          {L.edges.length > 1 && e.v > 0 ? `+${e.v}` : String(e.v)}
        </SvgText>
      ))}

      <Polyline
        points={L.linePoints}
        fill="none"
        stroke={t.blue}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {L.outRuns.map((run, i) =>
        run.points ? (
          <Polyline
            key={`run${i}`}
            points={run.points}
            fill="none"
            stroke={t.red}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <Circle key={`run${i}`} cx={run.dot!.cx} cy={run.dot!.cy} r={2.4} fill={t.red} />
        ),
      )}

      <Circle cx={L.lastDot.cx} cy={L.lastDot.cy} r={3.2} fill={t.blue} />

      <SvgText x={L.plot.x} y={L.h - 3} fontSize={9.5} fontFamily={FONT} fill={t.label3}>
        0
      </SvgText>
      <SvgText
        x={L.plot.x + L.plot.width}
        y={L.h - 3}
        fontSize={9.5}
        fontFamily={FONT}
        fill={t.label3}
        textAnchor="end"
      >
        {L.durMin} 分钟
      </SvgText>
    </Svg>
  );
}
