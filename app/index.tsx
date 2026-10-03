import { Redirect } from 'expo-router';
import { useAuth } from '@src/auth/store';
import { useMyHouseholds } from '@src/household/queries';
import { useActiveHousehold } from '@src/household/active';
import { Screen, Spinner } from '@src/ui/kit';
import { isConfigured } from '@src/env';
import { L } from '@src/i18n/lv';

/** Entry gate: wait for auth + households, then route to onboarding or the tabs. */
export default function Index() {
  const ready = useAuth((s) => s.ready);
  const hydrated = useActiveHousehold((s) => s.hydrated);
  const { data: households, isLoading } = useMyHouseholds();

  if (!isConfigured) return <Redirect href="/home" />; // placeholder config: let the app render
  if (!ready || !hydrated || isLoading) {
    return (
      <Screen>
        <Spinner label={L.common.loading} />
      </Screen>
    );
  }
  if (!households || households.length === 0) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
