import { Redirect } from 'expo-router';
import { useApp } from '@/state/app';

export default function Index() {
  const onboarded = useApp((s) => s.onboarded);
  return <Redirect href={onboarded ? '/today' : '/onboarding'} />;
}
