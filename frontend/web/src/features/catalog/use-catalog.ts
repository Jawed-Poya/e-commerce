import { useQuery } from "@tanstack/react-query";
import { getLookups, getProducts, type CatalogParams } from "./catalog-api";

export const useProducts = (params: CatalogParams) =>
  useQuery({
    queryKey: ["products", params],
    queryFn: () => getProducts(params),
  });
export const useLookups = () =>
  useQuery({
    queryKey: ["product-lookups"],
    queryFn: getLookups,
    staleTime: 300_000,
  });
