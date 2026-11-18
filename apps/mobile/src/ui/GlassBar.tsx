import { useEffect, useState, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { create } from 'zustand';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { useReduceTransparency } from './useReduceTransparency';

type Materials = { glass: typeof import('expo-glass-effect'); blur: typeof import('expo-blur') };
// Loaded on first use (importing Screen only for GUTTER must not start the native modules), then kept for later surfaces.
let loaded: Materials | undefined;

/** Bottom edge (from the screen top) of the active screen's floating toolbar, so the toast sits just under it. 0: no toolbar. */
export const useChromeBottom = create<{ bottom: number }>(() => ({ bottom: 0 }));

/** Navigation material shared by floating chrome; content cards stay opaque. `flat`: a hairline shadow for a control inline in content. */
export function GlassSurface({ children, style, flat, ...props }: ViewProps & { flat?: boolean }) {
  const t = useTheme();
  const reduce = useReduceTransparency(t.isIOS);
  const [materials, setMaterials] = useState(loaded);
  useEffect(() => {
    if (!t.isIOS || reduce || materials) return;
    let mounted = true;
    void Promise.all([import('expo-glass-effect'), import('expo-blur')]).then(([glass, blur]) => { loaded = { glass, blur }; if (mounted) setMaterials(loaded); }).catch(() => {});
    return () => { mounted = false; };
  }, [t.isIOS, reduce, materials]);
  const shape = { borderRadius: t.radius.float };
  if (!t.isIOS) return <View {...props} style={[shape, { overflow: 'hidden', backgroundColor: t.cardBg, elevation: 2 }, style]}>{children}</View>;
  const dark = t.scheme === 'dark';
  const material = reduce || !materials
    ? <View style={{ backgroundColor: `${t.c.surface}F0` }}>{children}</View>
    : materials.glass.isLiquidGlassAvailable() && materials.glass.isGlassEffectAPIAvailable()
      ? <materials.glass.GlassView glassEffectStyle="regular" colorScheme={t.scheme}>{children}</materials.glass.GlassView>
      // System blur intensity is not a point radius; use the existing older-iOS material recipe.
      : <materials.blur.BlurView intensity={40} tint={dark ? 'dark' : 'light'}>{children}</materials.blur.BlurView>;
  // The shadow sits on an outer view and the clip on an inner one, so the clip cannot cut the shadow off.
  const shadow = flat ? '0 1px 2px rgba(31,26,28,0.06)' : '0 1px 2px rgba(31,26,28,0.06), 0 14px 36px rgba(31,26,28,0.16)';
  return <View {...props} style={[shape, { boxShadow: shadow }, style]}>
    <View style={[shape, { overflow: 'hidden', borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)' }]}>
      {material}
      {/* the top-edge highlight is drawn over the material (under it, the material would hide it); light only, it glares on black */}
      {dark ? null : <View testID="glass-highlight" pointerEvents="none" style={[shape, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)' }]} />}
    </View>
  </View>;
}

export function GlassBar({ title, leading, trailing }: { title?: string; leading?: ReactNode; trailing?: ReactNode }) {
  return <GlassSurface><View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, gap: 6, minHeight: 60 }}>
    <View style={{ minWidth: 44, flex: 1, alignItems: 'flex-start' }}>{leading}</View>
    {title ? <Text accessibilityRole="header" style={{ flex: 3, textAlign: 'center', fontSize: 17, lineHeight: 22, fontWeight: '600' }}>{title}</Text> : null}
    <View style={{ minWidth: 44, flex: 1, alignItems: 'flex-end' }}>{trailing}</View>
  </View></GlassSurface>;
}
