// The six rotating taglines (copy `app.taglines`, PLAN.md §9.9, D-049): one per launch, chosen from the launch count so
// the same line is never shown twice in a row. Teen mode (13–17) shows the lock-up with no tagline.
export function taglineFor(launchCount: number, lines: readonly string[], teen: boolean): string | undefined {
  if (teen || lines.length === 0) return undefined;
  const n = Number.isFinite(launchCount) ? Math.max(0, Math.trunc(launchCount)) : 0;
  return lines[n % lines.length];
}
