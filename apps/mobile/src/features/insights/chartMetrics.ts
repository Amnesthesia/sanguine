// Sizes for the Insights charts. SVG text does not follow the system text size by itself, so the type size, the left margin
// (axis numbers), the top and bottom margins (unit label, date labels) and the chart height all grow with the font scale.
const BASE_FONT = 11;
const MAX_SCALE = 2; // the largest iOS / Android text setting that still leaves room for a chart on a phone

export interface ChartMetrics {
  fs: number; // SVG text size
  nudge: number; // baseline shift that centres an axis number on its grid line
  H: number;
  PAD: { l: number; r: number; t: number; b: number };
  maxXLabels: number;
}

export function chartMetrics(fontScale: number): ChartMetrics {
  const s = Math.min(Math.max(fontScale, 1), MAX_SCALE);
  const fs = BASE_FONT * s;
  return { fs, nudge: fs * 0.35, H: 200 + (s - 1) * 60, PAD: { l: 34 * s, r: 12, t: 15 + fs, b: 19 + fs }, maxXLabels: s > 1.3 ? 3 : 5 };
}
