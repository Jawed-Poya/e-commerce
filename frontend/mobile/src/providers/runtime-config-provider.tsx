import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import {
  getRuntimeConfig,
  initializeRuntimeConfig,
  resetRuntimeConfig,
  saveManualRuntimeConfig,
  type RuntimeConfig,
} from '@/lib/runtime-config';
import { clearServerScopedStorage } from '@/lib/storage';

type RuntimeConfigContextValue = RuntimeConfig & {
  ready: boolean;
  revision: number;
  useServer: (apiUrl: string) => Promise<void>;
  useManagedServer: () => Promise<void>;
};

const RuntimeConfigContext = createContext<RuntimeConfigContextValue | null>(null);

export function RuntimeConfigProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(getRuntimeConfig());
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void initializeRuntimeConfig().then((next) => {
      if (active) setConfig(next);
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);

  const activate = useCallback(async (next: RuntimeConfig) => {
    const endpointChanged = next.apiUrl !== config.apiUrl;
    if (endpointChanged) {
      await clearServerScopedStorage();
      queryClient.clear();
    }
    setConfig(next);
    setRevision((value) => value + 1);
  }, [config.apiUrl, queryClient]);

  const useServer = useCallback(async (apiUrl: string) => {
    await activate(await saveManualRuntimeConfig(apiUrl));
  }, [activate]);

  const useManagedServer = useCallback(async () => {
    await activate(await resetRuntimeConfig());
  }, [activate]);

  const value = useMemo<RuntimeConfigContextValue>(() => ({
    ...config,
    ready,
    revision,
    useServer,
    useManagedServer,
  }), [config, ready, revision, useManagedServer, useServer]);

  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>;
}

export function useRuntimeConfig() {
  const context = useContext(RuntimeConfigContext);
  if (!context) throw new Error('useRuntimeConfig must be used inside RuntimeConfigProvider.');
  return context;
}
