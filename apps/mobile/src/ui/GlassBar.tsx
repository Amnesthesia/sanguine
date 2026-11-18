import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

/** Navigation material shared by floating chrome; content cards stay opaque. */
export function GlassSurface({ children, style, ...props }: ViewProps) {
  const t = useTheme();
  const [reduce, setReduce] = useState(true);
  const [materials, setMaterials] = useState<{ glass: typeof import('expo-glass-effect'); blur: typeof import('expo-blur') }>();
  useEffect(() => {
    if (!t.isIOS || reduce) return;
    let mounted = true;
    void Promise.all([import('expo-glass-effect'), import('expo-blur')]).then(([glass, blur]) => { if (mounted) setMaterials({ glass, blur }); }).catch(() => {});
    return () => { mounted = false; };
  }, [t.isIOS, reduce]);
  useEffect(() => {
    if (!t.isIOS) return;
    let mounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((value) => { if (mounted) setReduce(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => { mounted = false; sub.remove(); };
  }, [t.isIOS]);
  const shape = { borderRadius: t.radius.float, overflow: 'hidden' as const };
  if (!t.isIOS) return <View {...props} style={[shape, { backgroundColor: t.cardBg, elevation: 2 }, style]}>{children}</View>;
  const rim = { borderWidth: 1, borderColor: t.scheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)' };
  const material = reduce || !materials
    ? <View style={{ backgroundColor: `${t.c.surface}F0` }}>{children}</View>
    : materials.glass.isLiquidGlassAvailable() && materials.glass.isGlassEffectAPIAvailable()
      ? <materials.glass.GlassView glassEffectStyle="regular" colorScheme={t.scheme}>{children}</materials.glass.GlassView>
      // System blur intensity is not a point radius; use the existing older-iOS material recipe.
      : <materials.blur.BlurView intensity={40} tint={t.scheme === 'dark' ? 'dark' : 'light'}>{children}</materials.blur.BlurView>;
  return <View {...props} style={[shape, rim, { boxShadow: '0 1px 2px rgba(31,26,28,0.06), 0 14px 36px rgba(31,26,28,0.16), inset 0 1px 0 rgba(255,255,255,0.95)' }, style]}>{material}</View>;
}

export function GlassBar({ title, leading, trailing }: { title?: string; leading?: ReactNode; trailing?: ReactNode }) {
  return <GlassSurface><View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, gap: 6, minHeight: 60 }}>
    <View style={{ minWidth: 44, flex: 1, alignItems: 'flex-start' }}>{leading}</View>
    {title ? <Text accessibilityRole="header" style={{ flex: 3, textAlign: 'center', fontSize: 17, lineHeight: 22, fontWeight: '600' }}>{title}</Text> : null}
    <View style={{ minWidth: 44, flex: 1, alignItems: 'flex-end' }}>{trailing}</View>
  </View></GlassSurface>;
}
