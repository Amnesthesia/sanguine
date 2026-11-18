import { describe, expect, it } from 'vitest';
import { dragHeight, FLICK_VELOCITY, nextDetent, REDUCED_MS, settle, shownAt, snapDetent } from './sheetSnap';

// a compact bar of 76 pt, a small sheet of 320 pt and a large one of 700 pt
const s = { closed: 76, small: 320, large: 700 };

describe('snapDetent: where a released drag settles', () => {
  it('a slow release settles on the nearest detent', () => {
    expect(snapDetent(90, 0, s)).toBe('closed');
    expect(snapDetent(190, 0, s)).toBe('closed'); // under halfway to small
    expect(snapDetent(210, 0, s)).toBe('small');
    expect(snapDetent(500, 100, s)).toBe('small');
    expect(snapDetent(520, -100, s)).toBe('large');
    expect(snapDetent(760, 0, s)).toBe('large'); // pulled past the top
    expect(snapDetent(40, 0, s)).toBe('closed'); // pushed under the bar
  });
  it('a flick goes to the next detent past the finger in its direction, wherever it let go', () => {
    const up = -(FLICK_VELOCITY + 1);
    const down = FLICK_VELOCITY + 1;
    expect(snapDetent(96, up, s)).toBe('small'); // a short flick up from the bar opens the sheet
    expect(snapDetent(320, up, s)).toBe('large');
    expect(snapDetent(330, up, s)).toBe('large');
    expect(snapDetent(720, up, s)).toBe('large'); // nothing above: stays at the top
    expect(snapDetent(680, down, s)).toBe('small');
    expect(snapDetent(300, down, s)).toBe('closed');
    expect(snapDetent(60, down, s)).toBe('closed');
    // under the flick speed the nearest detent wins, even moving
    expect(snapDetent(96, -(FLICK_VELOCITY - 1), s)).toBe('closed');
  });
});

describe('dragHeight: the sheet follows the finger', () => {
  it('one to one between the bar and the large detent, damped past either end', () => {
    expect(dragHeight(76, -100, s)).toBe(176); // finger up 100: sheet 100 taller
    expect(dragHeight(320, 50, s)).toBe(270);
    expect(dragHeight(700, -100, s)).toBe(720); // a fifth past the top
    expect(dragHeight(76, 50, s)).toBe(66); // a fifth under the bar
  });
});

describe('shownAt: which detent\'s content the sheet shows while it moves', () => {
  it('switches a quarter of the way to the next detent', () => {
    expect(shownAt(76, s)).toBe('closed');
    expect(shownAt(130, s)).toBe('closed');
    expect(shownAt(150, s)).toBe('small');
    expect(shownAt(400, s)).toBe('small');
    expect(shownAt(420, s)).toBe('large');
  });
});

describe('settle: a release always animates', () => {
  it('springs with the finger\'s velocity, or under Reduce Motion runs a short timing (never no animation)', () => {
    expect(settle(false, 900)).toEqual({ kind: 'spring', velocity: -900 });
    expect(settle(true, 900)).toEqual({ kind: 'timing', duration: REDUCED_MS });
    expect(REDUCED_MS).toBeGreaterThan(0);
    expect(REDUCED_MS).toBeLessThanOrEqual(200);
  });
});

describe('nextDetent: the buttons move one step', () => {
  it('up and down through bar, small and large, clamped at the ends', () => {
    expect(nextDetent('closed', 1)).toBe('small');
    expect(nextDetent('small', 1)).toBe('large');
    expect(nextDetent('large', 1)).toBe('large');
    expect(nextDetent('large', -1)).toBe('small');
    expect(nextDetent('small', -1)).toBe('closed');
    expect(nextDetent('closed', -1)).toBe('closed');
  });
});
