import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { create } from 'zustand';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { useReduceTransparency } from './useReduceTransparency';

type Materials = { glass: typeof import('expo-glass-effect'); blur: typeof import('expo-blur') };
// Loaded on first use (importing Screen only for GUTTER must not start the native modules), then kept for later surfaces.
let loaded: Materials | undefined;
let loading: Promise<Materials | undefined> | undefined;
// One shared load for every surface. A failure leaves the opaque surface in place (it is readable) and is reported once, in development;
// `typeof` because __DEV__ is not defined under vitest.
const loadMaterials = () => loading ??= Promise.all([import('expo-glass-effect'), import('expo-blur')]).then(
  ([glass, blur]) => (loaded = { glass, blur }),
  (error: unknown) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('GlassSurface: the glass material failed to load; drawing the opaque surface instead.', error);
    return undefined;
  },
);

/** Bottom edge (from the screen top) of the active screen's floating toolbar, so the toast sits just under it. 0: no toolbar. */
export const useChromeBottom = create<{ bottom: number }>(() => ({ bottom: 0 }));

/** The 1 pt rim drawn round every glass surface. */
export const glassRim = (dark: boolean) => (dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)');
/** Opacity of the tint `legible` lays over the material (D-130): at least 0.9, so text beneath cannot be read through it (0.72 still showed the month list ghosting through the day bar on the simulator). */
export const LEGIBLE_ALPHA = 0.94;
const LEGIBLE_HEX = Math.round(LEGIBLE_ALPHA * 255).toString(16).toUpperCase().padStart(2, '0');

/** Navigation material shared by floating chrome; content cards stay opaque. `flat`: a hairline shadow for a control inline in content.
 *  `legible`: for a surface that holds text over scrolling content. iOS 26 `regular` glass is a clear lens, so a tint of the surface colour
 *  is laid between the material and the content (D-130); expo-glass-effect's `tintColor` is a colour tint with no documented opacity floor. */
export function GlassSurface({ children, style, flat, legible, ...props }: ViewProps & { flat?: boolean; legible?: boolean }) {
  const t = useTheme();
  const reduce = useReduceTransparency(t.isIOS);
  const [materials, setMaterials] = useState(loaded);
  useEffect(() => {
    if (!t.isIOS || reduce || materials) return;
    let mounted = true;
    void loadMaterials().then((m) => { if (mounted && m) setMaterials(m); });
    return () => { mounted = false; };
  }, [t.isIOS, reduce, materials]);
  const shape = { borderRadius: StyleSheet.flatten(style)?.borderRadius ?? t.radius.float };
  if (!t.isIOS) return <View {...props} style={[shape, { overflow: 'hidden', backgroundColor: t.cardBg, elevation: 2 }, style]}>{children}</View>;
  const dark = t.scheme === 'dark';
  // first child, so the content (the later siblings) is drawn over it; the opaque fallback below needs none
  const tint = legible ? <View testID="glass-legible-tint" pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `${t.c.surface}${LEGIBLE_HEX}` }} /> : null;
  const material = reduce || !materials
    ? <View style={{ backgroundColor: `${t.c.surface}F0` }}>{children}</View>
    : materials.glass.isLiquidGlassAvailable() && materials.glass.isGlassEffectAPIAvailable()
      ? <materials.glass.GlassView glassEffectStyle="regular" colorScheme={t.scheme}>{tint}{children}</materials.glass.GlassView>
      // System blur intensity is not a point radius; use the existing older-iOS material recipe.
      : <materials.blur.BlurView intensity={40} tint={dark ? 'dark' : 'light'}>{tint}{children}</materials.blur.BlurView>;
  // The shadow sits on an outer view and the clip on an inner one, so the clip cannot cut the shadow off.
  const shadow = flat ? '0 1px 2px rgba(31,26,28,0.06)' : '0 1px 2px rgba(31,26,28,0.06), 0 14px 36px rgba(31,26,28,0.16)';
  return <View {...props} style={[shape, { boxShadow: shadow }, style]}>
    <View style={[shape, { overflow: 'hidden', borderWidth: 1, borderColor: glassRim(dark) }]}>
      {material}
      {/* the top-edge highlight is drawn over the material (under it, the material would hide it); light only, it glares on black */}
      {dark ? null : <View testID="glass-highlight" pointerEvents="none" style={[shape, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)' }]} />}
    </View>
  </View>;
}

/** The toolbar: Back / title / trailing on the first row. `below`: a second row in the same glass (a segmented control under the title). */
export function GlassBar({ title, leading, trailing, below }: { title?: string; leading?: ReactNode; trailing?: ReactNode; below?: ReactNode }) {
  // The side slots take their content (44 pt at least) and the title takes the rest, on one line that shrinks before it wraps.
  // ponytail: a trailing action wider than the leading Back moves the title off centre by half the difference.
  return <GlassSurface legible><View style={{ padding: 8, gap: 6 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
      <View style={{ minWidth: 44, flexShrink: 0, alignItems: 'flex-start' }}>{leading}</View>
      {title ? <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flex: 1, textAlign: 'center', fontSize: 17, lineHeight: 22, fontWeight: '600' }}>{title}</Text> : <View style={{ flex: 1 }} />}
      <View style={{ minWidth: 44, flexShrink: 0, alignItems: 'flex-end' }}>{trailing}</View>
    </View>
    {below ? <View testID="glass-bar-below">{below}</View> : null}
  </View></GlassSurface>;
}
