import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { commerceApi } from '@/lib/commerce-api';
import { getStoredJson, setStoredJson, storageKeys } from '@/lib/storage';
import type { CompanyProfile } from '@/types/domain';

type CompanyContextValue = {
  company: CompanyProfile | null;
  currency: string;
  loading: boolean;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: PropsWithChildren) {
  const [cachedCompany, setCachedCompany] = useState<CompanyProfile | null>(null);
  const query = useQuery({
    queryKey: ['company', 'public-profile'],
    queryFn: commerceApi.company,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    void getStoredJson<CompanyProfile>(storageKeys.companyCache).then((value) => {
      if (value) setCachedCompany(value);
    });
  }, []);

  useEffect(() => {
    if (!query.data) return;
    setCachedCompany(query.data);
    void setStoredJson(storageKeys.companyCache, query.data);
  }, [query.data]);

  const resolvedCompany = query.data ?? cachedCompany;

  const value = useMemo<CompanyContextValue>(() => ({
    company: resolvedCompany,
    currency: resolvedCompany?.settings.mainCurrencyCode ?? 'AFN',
    loading: query.isLoading && !resolvedCompany,
  }), [query.isLoading, resolvedCompany]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used inside CompanyProvider.');
  return context;
}
