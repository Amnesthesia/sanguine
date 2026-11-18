import type { ReactNode } from 'react';
import { BackButton } from './BackButton';
import { Screen } from './Screen';
import { GlassBar } from './GlassBar';

/** A pushed page with a fixed header: the Back chevron and the title on one row (the app uses no native navigation header). */
export function SubScreen({ title, testID, backTestID, bottomInset = 48, children }: { title: string; testID: string; backTestID?: string; bottomInset?: number; children: ReactNode }) {
  return <Screen testID={testID} bottomInset={bottomInset} noTopInset chrome={<GlassBar title={title} leading={<BackButton testID={backTestID} onGlass />} />}>
    {children}
  </Screen>;
}
