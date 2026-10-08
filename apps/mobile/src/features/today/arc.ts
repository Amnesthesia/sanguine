/** SVG arc path on a circle, angles in degrees clockwise from 12 o'clock. A full turn is drawn as two halves. */
export function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const span = Math.max(0, Math.min(360, toDeg - fromDeg));
  if (span === 0) return '';
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
  };
  if (span >= 359.99) return `M ${pt(fromDeg)} A ${r} ${r} 0 1 1 ${pt(fromDeg + 180)} A ${r} ${r} 0 1 1 ${pt(fromDeg)}`;
  return `M ${pt(fromDeg)} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${pt(fromDeg + span)}`;
}
