import { diffDays, type ISODate } from '@sanguine/engine';
import { formatDay } from '@/ui/format';
// Small SVG charts for Insights. No chart library: the shapes are simple and the colours are theme tokens.
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme';
import { type LengthSeries, lengthAxisLabels } from './insightsModel';

const H = 180;
const PAD = { l: 34, r: 12, t: 12, b: 28 };

export function LengthChart({ series }: { series: LengthSeries }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const w = Math.min(width, 560) - 32 - 32; // screen gutters + card padding
  const [lo, hi] = [20, 50];
  const x = (i: number) => PAD.l + (series.points.length <= 1 ? (w - PAD.l - PAD.r) / 2 : (i / (series.points.length - 1)) * (w - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const pts = series.points.map((p, i) => `${x(i)},${y(p.length)}`).join(' ');
  const labels = lengthAxisLabels(series.points.map((p) => p.start));
  return (
    <View testID="chart-length" accessible accessibilityRole="image" accessibilityLabel={`Cycle length chart: ${series.points.map((p) => p.length).join(', ')} days`}>
      <Svg width={w} height={H}>
        {series.band ? <Rect x={PAD.l} y={y(series.band.hi)} width={w - PAD.l - PAD.r} height={Math.max(2, y(series.band.lo) - y(series.band.hi))} fill={t.c.periodPredicted} opacity={0.45} /> : null}
        {[20, 30, 40, 50].map((v) => (
          <G key={v}>
            <Line x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} stroke={t.c.border} strokeWidth={1} />
            <SvgText x={PAD.l - 6} y={y(v) + 4} fontSize={11} fill={t.c.textSecondary} textAnchor="end">{v}</SvgText>
          </G>
        ))}
        <Polyline points={pts} fill="none" stroke={t.c.period} strokeWidth={2} />
        {series.points.map((p, i) => <Circle key={p.start} cx={x(i)} cy={y(p.length)} r={4} fill={t.c.period} />)}
        {series.points.map((p, i) => (i % Math.ceil(series.points.length / 5) === 0 ? <SvgText key={`l${p.start}`} x={x(i)} y={H - 8} fontSize={11} fill={t.c.textSecondary} textAnchor={i === 0 && series.points.length > 1 ? 'start' : i === series.points.length - 1 && series.points.length > 1 ? 'end' : 'middle'}>{labels[i]}</SvgText> : null))}
      </Svg>
    </View>
  );
}

export function TempChart({ points, coverline, unitLabel }: { points: Array<{ day: number; value: number }>; coverline: number | undefined; unitLabel: string }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const w = Math.min(width, 560) - 32 - 32;
  const vals = points.map((p) => p.value).concat(coverline === undefined ? [] : [coverline]);
  const lo = Math.floor(Math.min(...vals) * 10) / 10 - 0.1;
  const hi = Math.ceil(Math.max(...vals) * 10) / 10 + 0.1;
  const maxDay = Math.max(14, ...points.map((p) => p.day));
  const x = (d: number) => PAD.l + ((d - 1) / (maxDay - 1)) * (w - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  return (
    <View testID="chart-temp" accessible accessibilityRole="image" accessibilityLabel={`Temperature chart, ${points.length} readings${coverline === undefined ? '' : `, coverline ${coverline.toFixed(2)} ${unitLabel}`}`}>
      <Svg width={w} height={H}>
        {coverline !== undefined ? <Line x1={PAD.l} x2={w - PAD.r} y1={y(coverline)} y2={y(coverline)} stroke={t.c.ovulation} strokeWidth={1.5} strokeDasharray="5 4" /> : null}
        <Polyline points={points.map((p) => `${x(p.day)},${y(p.value)}`).join(' ')} fill="none" stroke={t.c.accent} strokeWidth={2} />
        {points.map((p) => <Circle key={p.day} cx={x(p.day)} cy={y(p.value)} r={3.5} fill={t.c.accent} />)}
        <SvgText x={PAD.l} y={H - 8} fontSize={11} fill={t.c.textSecondary}>1</SvgText>
        <SvgText x={w - PAD.r} y={H - 8} fontSize={11} fill={t.c.textSecondary} textAnchor="end">{maxDay}</SvgText>
        <SvgText x={PAD.l - 6} y={PAD.t + 10} fontSize={11} fill={t.c.textSecondary} textAnchor="end">{hi.toFixed(1)}</SvgText>
        <SvgText x={PAD.l - 6} y={H - PAD.b} fontSize={11} fill={t.c.textSecondary} textAnchor="end">{lo.toFixed(1)}</SvgText>
      </Svg>
    </View>
  );
}

export function EnergyChart({ points, starts, from, to, label }: { points: Array<{ day: ISODate; level: number }>; starts: ISODate[]; from: ISODate; to: ISODate; label: string }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const w = Math.min(width, 560) - 32 - 32;
  const span = Math.max(1, diffDays(to, from));
  const x = (d: ISODate) => PAD.l + (diffDays(d, from) / span) * (w - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - 1) / 4) * (H - PAD.t - PAD.b);
  // ponytail: one polyline joins across unlogged days; split it into runs if gaps read as data
  return (
    <View testID="chart-energy" accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={w} height={H}>
        {[1, 3, 5].map((v) => (
          <G key={v}>
            <Line x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} stroke={t.c.border} strokeWidth={1} />
            <SvgText x={PAD.l - 6} y={y(v) + 4} fontSize={11} fill={t.c.textSecondary} textAnchor="end">{v}</SvgText>
          </G>
        ))}
        {starts.map((s) => <Line key={s} x1={x(s)} x2={x(s)} y1={PAD.t} y2={H - PAD.b} stroke={t.c.period} strokeWidth={1} strokeDasharray="3 3" />)}
        <Polyline points={points.map((p) => `${x(p.day)},${y(p.level)}`).join(' ')} fill="none" stroke={t.c.accent} strokeWidth={2} />
        {points.map((p) => <Circle key={p.day} cx={x(p.day)} cy={y(p.level)} r={3} fill={t.c.accent} />)}
        <SvgText x={PAD.l} y={H - 8} fontSize={11} fill={t.c.textSecondary}>{formatDay(from)}</SvgText>
        <SvgText x={w - PAD.r} y={H - 8} fontSize={11} fill={t.c.textSecondary} textAnchor="end">{formatDay(to)}</SvgText>
      </Svg>
    </View>
  );
}
