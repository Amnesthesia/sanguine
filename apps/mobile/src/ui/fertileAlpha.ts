/** Display opacity for a fertile-window probability. A floor keeps the low end visible against the background (U-10/U-19, D-076) while the gradation still reads; the engine's p(d) is untouched. */
export const fertileAlpha = (p: number): number => 0.2 + 0.8 * Math.min(1, Math.max(0, p));
