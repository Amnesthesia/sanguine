// Decides when a change of AppState must re-check the lock. iOS reports a return from the background as
// background -> inactive -> active, so "was the app in the background since the last active?" is remembered, not the previous state.
export type AppStateName = 'active' | 'inactive' | 'background' | 'unknown' | 'extension';

export function createTracker(): (next: AppStateName) => 'evaluate' | 'cover' | 'none' {
  let sawBackground = false;
  return (next) => {
    if (next === 'background') { sawBackground = true; return 'cover'; }
    if (next === 'active') {
      const re = sawBackground;
      sawBackground = false;
      return re ? 'evaluate' : 'none';
    }
    return 'cover'; // inactive (Face ID sheet, app switcher, control centre): hide content, do not prompt
  };
}
