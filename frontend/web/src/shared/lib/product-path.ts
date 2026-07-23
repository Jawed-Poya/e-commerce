export function productPath(product: { id: number; slug?: string | null }) {
  const identifier = product.slug?.trim() || String(product.id);
  return `/products/${encodeURIComponent(identifier)}`;
}
