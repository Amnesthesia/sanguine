// The adapters, in detection order (D-159). Our own format first, then the apps; the first whose `detect` is not 'no' reads the file.
import { clue } from './clue';
import { drip } from './drip';
import { naturalCycles } from './naturalCycles';
import { sanguineAdapter } from './sanguine';
import type { FormatAdapter } from './types';

export const ADAPTERS: FormatAdapter[] = [sanguineAdapter, clue, naturalCycles, drip];
export type { Decoded, FormatAdapter, PickedFile } from './types';
