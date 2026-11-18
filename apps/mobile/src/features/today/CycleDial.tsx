// Today's cycle dial (D-121, PLAN.md §9.5): arcs on a track over the expected cycle length, one tick per day, today as a knob.
// Solid = logged, soft = estimate, graded green = fertile window estimate, blue ring = ovulation estimate.
import { colors, over } from '@sanguine/ui-tokens';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/theme';
import { fertileAlpha } from '@/ui/fertileAlpha';
import { Text } from '@/ui/Text';
import { LARGE, useFontScale } from '@/ui/useFontScale';
import { arcPath } from './arc';
import type { DialArc, DialModel } from './dialModel';

const SIZE = 280;
const C = SIZE / 2;
const STROKE = 14;
const R = 120;
const CAP_DEG = (STROKE / 2 / R) * (180 / Math.PI); // round caps stick out by half the stroke, so arcs are inset to keep their nominal extent
const OVERLAP_DEG = 0.6; // butt-capped slices overlap a hair so no seam shows
const TICK_OUTER = 107;
const ESTIMATE_ALPHA = 0.3;
const RIM_R = R + STROKE / 2 - 0.75; // a thin solid edge on the outer rim of every estimate, so its extent does not rest on colour grading alone (>= 3:1 on the track, D-093)
const RIM = 1.5;
// The frames' dial track (Today-*.html). packages/ui-tokens is frozen for this work, so it is a local constant; move it to the tokens as `dialTrack` when they open.
export const TRACK = { light: '#ECE7E9', dark: '#2A2628' } as const;
// The knob's drop shadow is dark in both themes; textPrimary is near-white in dark and would make a halo. Same ink as the card shadows in tokens.elevation.
const SHADOW = colors.light.textPrimary;

export interface DialCentre { kicker: string; big: string; pill?: string; sub?: string }
const pt = (deg: number, r: number) => ({ x: C + r * Math.sin((deg * Math.PI) / 180), y: C - r * Math.cos((deg * Math.PI) / 180) });

/** Fertile days grouped into runs of consecutive days; a gap starts a new band. */
const fertileRuns = (arcs: DialArc[]): DialArc[][] =>
  arcs.filter((a) => a.kind === 'fertile').sort((a, b) => a.from - b.from).reduce<DialArc[][]>((runs, a) => {
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1]!.to === a.from - 1) run.push(a); else runs.push([a]);
    return runs;
  }, []);

export function CycleDial({ model, centre }: { model: DialModel; centre: DialCentre }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const stacked = useFontScale() > LARGE; // at large text the words leave the dial and stack beneath it
  const { days, arcs } = model;
  const deg = (boundary: number) => (boundary / days) * 360;
  const track = TRACK[t.scheme];
  const roundedArc = (a: DialArc, r = R) => {
    const from = deg(a.from - 1) + CAP_DEG, to = deg(a.to) - CAP_DEG;
    return to > from ? arcPath(C, C, r, from, to) : arcPath(C, C, r, (from + to) / 2 - 0.3, (from + to) / 2 + 0.3);
  };
  const logged = arcs.filter((a) => a.kind === 'period');
  const estimates = arcs.filter((a) => a.kind === 'periodEstimate');
  const runs = fertileRuns(arcs);
  const sliceColour = (a: DialArc) => over(t.c.fertile, fertileAlpha(a.p ?? 0), track);
  const todayDeg = model.todayDay ? deg(model.todayDay - 0.5) : undefined;
  const ovDeg = model.ovulationDay ? deg(model.ovulationDay - 0.5) : undefined;

  // a one-day range is spoken as "on day 13", never "days 13 to 13"; each separate fertile run gets its own sentence
  const span = (key: string, from: number, to: number) => (from === to ? tr(`${key}One`, { day: from }) : tr(key, { from, to }));
  const nextArc = estimates.reduce<DialArc | undefined>((m, a) => (!m || a.from > m.from ? a : m), undefined);
  const label = days === 0
    // the empty dial's big value is a dash placeholder, which a screen reader would speak as "dash"
    ? [centre.kicker, /\d/.test(centre.big) ? centre.big : '', centre.pill, centre.sub].filter(Boolean).join('. ')
    : [
      model.todayDay ? tr('today.dial.day', { day: model.todayDay }) : '',
      ...logged.map((a) => span('today.dial.periodLogged', a.from, a.to)),
      ...estimates.filter((a) => a !== nextArc).map((a) => span('today.dial.periodEnding', a.from, a.to)),
      ...runs.map((r) => tr('today.dial.fertile', { from: r[0]!.from, to: r[r.length - 1]!.to })), // never one day: dialModel draws two or more
      model.ovulationDay ? tr('today.dial.ovulation', { day: model.ovulationDay }) : '',
      nextArc ? span('today.dial.next', nextArc.from, nextArc.to) : '',
      centre.pill ? `${centre.pill}.` : '',
      centre.sub ? `${centre.sub}.` : '',
    ].filter(Boolean).join(' ');

  const legend = [
    logged.length ? { key: 'period', swatch: { backgroundColor: t.c.period } } : null,
    estimates.length ? { key: 'estimate', swatch: { backgroundColor: over(t.c.period, ESTIMATE_ALPHA, t.c.bg) } } : null,
    runs.length ? { key: 'fertile', swatch: { backgroundColor: over(t.c.fertile, 0.6, t.c.bg) } } : null,
    model.ovulationDay ? { key: 'ovulation', swatch: { borderWidth: 2, borderColor: t.c.ovulation } } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  const kicker = <Text variant="caption" color="textOnGlass" style={{ fontWeight: '600', letterSpacing: 0.8 }}>{centre.kicker}</Text>;
  const bigNumber = <Text tabular maxFontSizeMultiplier={1} style={{ fontSize: 64, lineHeight: 66, fontWeight: '700', letterSpacing: -1.5 }}>{centre.big}</Text>;
  const pillAndSub = (
    <>
      {centre.pill ? <View style={{ marginTop: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: t.c.accentSoft }}><Text variant="bodySmall" style={{ color: t.c.onAccentSoft, fontWeight: '600', fontSize: 13, lineHeight: 17 }}>{centre.pill}</Text></View> : null}
      {centre.sub ? <Text variant="caption" color="textOnGlass" style={{ marginTop: 6, maxWidth: 176, textAlign: 'center' }}>{centre.sub}</Text> : null}
    </>
  );

  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <View testID="cycle-dial" accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: SIZE, height: SIZE, alignSelf: 'center', flexShrink: 0 }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: SIZE, height: SIZE }}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute' }}>
            <Defs>
              <RadialGradient id="dialCentre" cx="0.5" cy="0.4" r="0.65">
                <Stop offset="0" stopColor={t.c.surface} />
                <Stop offset="0.52" stopColor={t.c.surface} />
                <Stop offset="1" stopColor={t.c.accentSoft} stopOpacity={t.scheme === 'dark' ? 0.7 : 0.55} />
              </RadialGradient>
            </Defs>
            <Circle cx={C} cy={C} r={90} fill="url(#dialCentre)" />
            <Circle cx={C} cy={C} r={R} stroke={track} strokeWidth={STROKE} fill="none" />
            {days > 0 ? Array.from({ length: days }, (_, d) => {
              const major = d % 7 === 0;
              const a = pt(deg(d), TICK_OUTER), b = pt(deg(d), TICK_OUTER - (major ? 6 : 3));
              // biome-ignore lint/suspicious/noArrayIndexKey: a tick's day number is its identity
              return <Line key={d} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={t.c.textOnGlass} strokeOpacity={major ? 0.55 : 0.25} strokeWidth={major ? 1.6 : 1.2} strokeLinecap="round" />;
            }) : null}
            {runs.map((run) => {
              const first = run[0]!, last = run[run.length - 1]!;
              const start = deg(first.from - 1) + CAP_DEG, end = deg(last.to) - CAP_DEG;
              const s = pt(start, R), e = pt(end, R);
              return (
                <G key={`fertile-${first.from}`}>
                  {run.map((a, i) => {
                    const from = i === 0 ? start : deg(a.from - 1) - OVERLAP_DEG, to = i === run.length - 1 ? end : deg(a.to);
                    return <Path key={a.from} d={arcPath(C, C, R, from, to)} stroke={sliceColour(a)} strokeWidth={STROKE} fill="none" />;
                  })}
                  <Path d={arcPath(C, C, RIM_R, start, end)} stroke={t.c.fertile} strokeWidth={RIM} fill="none" />
                  <Circle cx={s.x} cy={s.y} r={STROKE / 2} fill={sliceColour(first)} />
                  <Circle cx={e.x} cy={e.y} r={STROKE / 2} fill={sliceColour(last)} />
                </G>
              );
            })}
            {estimates.map((a) => (
              <G key={`e${a.from}`}>
                <Path d={roundedArc(a)} stroke={t.c.period} strokeOpacity={ESTIMATE_ALPHA} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
                <Path d={roundedArc(a, RIM_R)} stroke={t.c.period} strokeWidth={RIM} strokeDasharray="3 3" fill="none" />
              </G>
            ))}
            {logged.map((a) => <Path key={`p${a.from}`} d={roundedArc(a)} stroke={t.c.period} strokeWidth={STROKE} strokeLinecap="round" fill="none" />)}
            {ovDeg !== undefined ? (() => {
              const o = pt(ovDeg, R);
              return (<>
                <Circle cx={o.x} cy={o.y} r={12} fill={t.c.ovulation} fillOpacity={0.2} />
                <Circle cx={o.x} cy={o.y} r={7} fill={t.c.surface} stroke={t.c.ovulation} strokeWidth={2.2} />
              </>);
            })() : null}
            {todayDeg !== undefined ? (() => {
              const k = pt(todayDeg, R);
              return (<>
                {/* soft shadow from stacked translucent discs; an SVG filter is not reliable across Expo Go versions */}
                <Circle cx={k.x} cy={k.y + 2.5} r={17} fill={SHADOW} fillOpacity={0.06} />
                <Circle cx={k.x} cy={k.y + 2} r={15.5} fill={SHADOW} fillOpacity={0.1} />
                <Circle cx={k.x} cy={k.y} r={14.5} fill={t.c.surface} />
                <Circle cx={k.x} cy={k.y} r={10.5} fill="none" stroke={t.c.accent} strokeWidth={3} />
              </>);
            })() : null}
          </Svg>
          <View pointerEvents="none" style={{ position: 'absolute', left: 50, top: 50, width: 180, height: 180, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {stacked ? bigNumber : (<>{kicker}{bigNumber}{pillAndSub}</>)}
          </View>
        </View>
      </View>
      {stacked ? <View style={{ alignItems: 'center', gap: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{kicker}{pillAndSub}</View> : null}
      {legend.length ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 14, rowGap: 6 }}>
          {legend.map((l) => (
            <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[{ width: 10, height: 10, borderRadius: 5 }, l.swatch]} />
              <Text variant="caption" color="textOnGlass">{tr(`today.dial.legend.${l.key}`)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
