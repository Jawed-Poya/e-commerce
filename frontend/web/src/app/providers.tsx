import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { CartProvider } from '../features/cart/cart-context'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } } })
export function AppProviders({ children }: PropsWithChildren) { return <QueryClientProvider client={queryClient}><CartProvider>{children}</CartProvider></QueryClientProvider> }
