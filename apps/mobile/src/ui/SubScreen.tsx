import type { ReactNode, Ref } from 'react';
import type { ScrollView } from 'react-native';
import { BackButton } from './BackButton';
import { Screen } from './Screen';
import { GlassBar } from './GlassBar';

/** A pushed page with a fixed header: the Back chevron and the title on one row, plus an optional second row (`below`, e.g. a Segmented) in the same glass (the app uses no native navigation header). `floating`: the page's one primary action, pinned at the bottom (see Screen). */
export function SubScreen({ title, testID, backTestID, bottomInset = 48, below, floating, scrollRef, children }: { title: string; testID: string; backTestID?: string; bottomInset?: number; below?: ReactNode; floating?: ReactNode; scrollRef?: Ref<ScrollView>; children: ReactNode }) {
  return <Screen testID={testID} bottomInset={bottomInset} noTopInset floating={floating} scrollRef={scrollRef} chrome={<GlassBar title={title} leading={<BackButton testID={backTestID} onGlass />} below={below} />}>
    {children}
  </Screen>;
}
