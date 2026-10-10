/** Display opacity of the fertile band's fill for a fertile-window probability (U-10/U-19, D-076). The fill carries the gradation
 *  only; contrast comes from the solid edge drawn with it in PhaseRing and DayCellView (§8.9: 3:1, D-093). p(d) is untouched. */
export const fertileAlpha = (p: number): number => 0.2 + 0.8 * Math.min(1, Math.max(0, p));
