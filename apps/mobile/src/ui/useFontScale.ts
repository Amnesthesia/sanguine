import { useWindowDimensions } from 'react-native';

/** Current system text scale (updates when the user changes it). Layouts switch to stacked forms above LARGE. */
export const LARGE = 1.3;
export function useFontScale(): number {
  return useWindowDimensions().fontScale;
}
