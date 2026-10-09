// Report for a doctor (P8-6, roadmap R2-1, D-084): an HTML page the phone prints to PDF and the user sends with the share sheet.
// Pure: the strings come from the copy files through `t`. Facts from the user's own logs, the fixed flag wording (§4.10), the intended
// purpose (§2.3) and the engine version; no condition is named, nothing is scored, and the ovulation column is opt-in and absent under 18.
import { addDays, type CycleRecord, type DailyLog, diffDays, type HealthFlag, type ISODate, type TemperatureReading } from '@sanguine/engine';
import { formatDayYear } from '@/ui/format';

export interface ReportOptions { cycles: number; symptoms: boolean; temperatures: boolean; flags: boolean; ovulation: boolean }
export const DEFAULT_REPORT: ReportOptions = { cycles: 6, symptoms: true, temperatures: true, flags: true, ovulation: false };
export interface ReportInput {
  cycles: CycleRecord[]; logs: DailyLog[]; temperatures: TemperatureReading[]; flags: HealthFlag[];
  today: ISODate; age: number | undefined; lifeStateKey: string | undefined;
  engine: { version: string; hash: string }; fertilityTools: boolean;
}
type T = (key: string, params?: Record<string, unknown>) => string;

const FLOW_ORDER = ['spotting', 'light', 'medium', 'heavy'] as const;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2; };

/** Bars of the cycle lengths, one per cycle, with the 21 and 35 day lines (FIGO 2018 typical range) as reference. */
function lengthChart(lengths: number[]): string {
  const w = 480; const h = 140; const max = Math.max(40, ...lengths) + 5; const bw = w / Math.max(lengths.length, 1);
  const y = (v: number) => h - (v / max) * h;
  const bars = lengths.map((l, i) => `<rect x="${i * bw + bw * 0.2}" y="${y(l)}" width="${bw * 0.6}" height="${h - y(l)}" fill="#BC4560"/><text x="${i * bw + bw / 2}" y="${y(l) - 4}" font-size="11" text-anchor="middle">${l}</text>`).join('');
  const line = (v: number) => `<line x1="0" x2="${w}" y1="${y(v)}" y2="${y(v)}" stroke="#888" stroke-dasharray="4 3"/><text x="${w - 2}" y="${y(v) - 3}" font-size="10" text-anchor="end" fill="#666">${v}</text>`;
  return `<svg width="${w}" height="${h + 4}" viewBox="0 0 ${w} ${h + 4}" xmlns="http://www.w3.org/2000/svg">${line(21)}${line(35)}${bars}</svg>`;
}

export function buildReport(i: ReportInput, o: ReportOptions, t: T): string {
  const closed = [...i.cycles].filter((c) => c.length !== undefined).sort((a, b) => (a.start < b.start ? -1 : 1)).slice(-o.cycles);
  const ovulation = o.ovulation && i.fertilityTools;
  const temps = o.temperatures && i.temperatures.length > 0;
  const inCycle = (c: CycleRecord, d: ISODate) => d >= c.start && diffDays(d, c.start) < (c.length as number);
  const rows = closed.map((c) => {
    const days = i.logs.filter((l) => inCycle(c, l.date));
    const heaviest = days.reduce<number>((m, l) => Math.max(m, l.flow && l.flow !== 'none' ? FLOW_ORDER.indexOf(l.flow) : -1), -1);
    const cells = [formatDayYear(c.start), String(c.length), c.bleedDays === undefined ? '' : String(c.bleedDays), heaviest < 0 ? '' : t(`log.flowLevels.${FLOW_ORDER[heaviest]}`)];
    if (temps) cells.push(String(i.temperatures.filter((r) => inCycle(c, r.date)).length));
    if (ovulation) cells.push(c.ovulation ? t('report.ovulationAround', { date: formatDayYear(c.ovulation.point), basis: t(`insights.ovulationBasis.${c.ovulation.basis}`) }) : '');
    cells.push(c.quality === 'valid' ? '' : t(`insights.quality.${c.quality}`));
    return `<tr>${cells.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`;
  });
  const head = [t('report.colStart'), t('report.colLength'), t('report.colBleed'), t('report.colHeaviest'), ...(temps ? [t('report.colTemps')] : []), ...(ovulation ? [t('report.colOvulation')] : []), t('report.colNote')];
  const lengths = closed.map((c) => c.length as number);
  const first = closed[0];
  const last = closed[closed.length - 1];

  const parts: string[] = [];
  parts.push(`<h1>${esc(t('report.title'))}</h1>`);
  parts.push(`<p>${esc(t('report.made', { date: formatDayYear(i.today), version: i.engine.version }))}</p>`);
  if (i.age !== undefined) parts.push(`<p>${esc(t('report.age', { age: i.age }))}</p>`);
  if (i.lifeStateKey) parts.push(`<p>${esc(t('report.lifeState', { state: t(i.lifeStateKey) }))}</p>`);
  if (!first || !last) parts.push(`<p>${esc(t('report.noCycles'))}</p>`);
  else {
    parts.push(`<h2>${esc(t('report.cyclesTitle'))}</h2>`);
    parts.push(`<p>${esc(t('report.covered', { n: closed.length, from: formatDayYear(first.start), to: formatDayYear(addDays(last.start, (last.length as number) - 1)) }))}<br/>${esc(t('report.lengths', { min: Math.min(...lengths), max: Math.max(...lengths), median: median(lengths) }))}</p>`);
    parts.push(lengthChart(lengths));
    parts.push(`<p class="small">${esc(t('report.chartNote'))}</p>`);
    parts.push(`<table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows.join('')}</table>`);
    if (o.symptoms) {
      const count = new Map<string, number>();
      for (const l of i.logs) if (closed.some((c) => inCycle(c, l.date))) for (const s of l.symptoms ?? []) count.set(s.code, (count.get(s.code) ?? 0) + 1);
      const top = [...count].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 12);
      parts.push(`<h2>${esc(t('report.symptomsTitle'))}</h2>`);
      parts.push(top.length ? `<table><tr><th>${esc(t('report.colSymptom'))}</th><th>${esc(t('report.colDays'))}</th></tr>${top.map(([code, n]) => `<tr><td>${esc(t(`symptom.${code}`, { defaultValue: code }))}</td><td>${n}</td></tr>`).join('')}</table>` : `<p>${esc(t('report.noSymptoms'))}</p>`);
    }
  }
  const shownFlags = o.flags ? i.flags.filter((f) => i.fertilityTools || f.code !== 'shortLuteal') : [];
  if (shownFlags.length) {
    parts.push(`<h2>${esc(t('report.flagsTitle'))}</h2>`);
    for (const f of shownFlags) parts.push(`<p><b>${esc(t(`flags.${f.code}.title`))}</b><br/>${esc(t(`flags.${f.code}.body`, f.params))}</p>`);
  }
  parts.push(`<hr/><p class="small">${esc(`${t('legal.intendedPurpose')} ${t('legal.notMedicalDevice')} ${t('legal.aboutDisclaimer')}`)}<br/>${esc(t('report.engine', { version: i.engine.version, hash: i.engine.hash }))}</p>`);
  const css = 'body{font-family:-apple-system,Roboto,sans-serif;color:#111;margin:32px;font-size:13px}h1{font-size:20px}h2{font-size:15px;margin-top:22px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}.small{color:#555;font-size:11px}';
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(t('report.title'))}</title><style>${css}</style></head><body>${parts.join('')}</body></html>`;
}
