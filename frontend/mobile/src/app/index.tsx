import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { getOnboardingComplete } from '@/lib/storage';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    void getOnboardingComplete()
      .catch(() => false)
      .then((complete) => {
        if (active) router.replace(complete ? '/shop' : '/welcome');
      });

    return () => { active = false; };
  }, [router]);

  return <AppLoadingScreen />;
}
