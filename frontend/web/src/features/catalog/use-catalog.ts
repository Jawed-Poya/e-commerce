import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getLookups, getProducts, type CatalogParams } from "./catalog-api";

export const useProducts = (params: CatalogParams) =>
  useQuery({
    queryKey: ["products", params],
    queryFn: () => getProducts(params),
    // Keep the previous page visible while filters/page navigation fetch the next
    // result. This removes the full catalog flash on higher-latency Linux hosting.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

export const useInfiniteProducts = (params: CatalogParams) =>
  useInfiniteQuery({
    queryKey: ["products", "infinite", params],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getProducts({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
  });

export const useLookups = () =>
  useQuery({
    queryKey: ["product-lookups"],
    queryFn: getLookups,
    staleTime: 300_000,
  });
