import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Last value the OS reported, so a surface mounted after the first one paints in the right material at once
// instead of flashing the reduced fallback (the setting almost never changes).
let cached = false;

/** iOS Reduce Transparency, live. `enabled` is false off iOS (no call is made, result false). */
export function useReduceTransparency(enabled = true): boolean {
  const [on, setOn] = useState(cached);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const set = (v: boolean) => { cached = v; if (live) setOn(v); };
    void AccessibilityInfo.isReduceTransparencyEnabled().then(set).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', set);
    return () => { live = false; sub.remove(); };
  }, [enabled]);
  return enabled && on;
}
