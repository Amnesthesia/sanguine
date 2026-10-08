// UUIDv7: 48-bit millisecond timestamp + random bits, so ids sort by creation time (PLAN.md §5.2).
export function uuidv7(nowMs: number, random: Uint8Array): string {
  if (random.length < 10) throw new RangeError('uuidv7 needs 10 random bytes');
  const b = new Uint8Array(16);
  let t = Math.floor(nowMs);
  for (let i = 5; i >= 0; i--) { b[i] = t % 256; t = Math.floor(t / 256); }
  for (let i = 0; i < 10; i++) b[6 + i] = random[i] as number;
  b[6] = ((b[6] as number) & 0x0f) | 0x70;
  b[8] = ((b[8] as number) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export interface Clock { nowMs(): number; iso(): string; tz(): string; randomBytes(n: number): Uint8Array }
