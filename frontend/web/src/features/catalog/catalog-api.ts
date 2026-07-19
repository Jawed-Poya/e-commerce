import { apiGet } from "../../shared/api/api-client";
import type { Lookups, PagedProducts } from "../../shared/types/product";

export type CatalogParams = Record<
  string,
  string | number | boolean | (string | number)[] | undefined
>;
export const getProducts = (params: CatalogParams) =>
  apiGet<PagedProducts>("/products", params);
export const getLookups = () => apiGet<Lookups>("/products/lookups");
