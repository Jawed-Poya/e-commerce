import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { getOnboardingComplete } from '@/lib/storage';

const minimumLoadingTime = 900;

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();

    void getOnboardingComplete()
      .catch(() => false)
      .then(async (complete) => {
        const remaining = Math.max(0, minimumLoadingTime - (Date.now() - startedAt));
        if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));
        if (active) router.replace(complete ? '/shop' : '/welcome');
      });

    return () => { active = false; };
  }, [router]);

  return <AppLoadingScreen />;
}
