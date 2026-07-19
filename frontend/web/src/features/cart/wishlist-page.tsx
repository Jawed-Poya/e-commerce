import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Heart, LoaderCircle, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../shared/components/ui/button";
import { ProductCard } from "../catalog/product-card";
import { getProducts } from "../catalog/catalog-api";
import { useCart } from "./cart-context";
import { useI18n } from "../../i18n/i18n-provider";

export function WishlistPage() {
  const cart = useCart();
  const { t } = useI18n();
  const productIds = cart.wishlist;

  const products = useQuery({
    queryKey: ["wishlist-products", productIds],
    queryFn: () =>
      getProducts({
        ids: productIds,
        page: 1,
        pageSize: Math.min(Math.max(productIds.length, 1), 100),
        isActive: true,
      }),
    enabled: productIds.length > 0,
  });

  if (productIds.length === 0) {
    return (
      <main className="relative grid min-h-[70vh] place-items-center overflow-hidden px-4 py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-xl text-center">
          <span className="mx-auto grid size-20 place-items-center rounded-[28px] border bg-background text-primary shadow-xl shadow-primary/10 sm:size-24">
            <Heart className="size-8 sm:size-10" />
          </span>
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {t("wishlist.savedProducts")}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
            {t("wishlist.emptyTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
            {t("wishlist.emptyDescription")}
          </p>
          <Button
            asChild
            size="lg"
            className="mt-7 h-12 rounded-xl px-7 font-bold"
          >
            <Link to="/products">
              {t("wishlist.explore")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {t("wishlist.savedForLater")}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
            {t("common.wishlist")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {productIds.length} {t("common.products")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl text-muted-foreground hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
          onClick={cart.clearWishlist}
        >
          <Trash2 className="size-4" />
          {t("common.clearAll")}
        </Button>
      </div>

      {products.isLoading && (
        <div className="grid min-h-64 place-items-center text-muted-foreground">
          <div className="text-center">
            <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-3 text-sm">{t("wishlist.loading")}</p>
          </div>
        </div>
      )}
      {products.isError && (
        <div className="mt-8 rounded-2xl border border-destructive/25 bg-destructive/5 p-6 text-sm text-destructive">
          {t("wishlist.loadError")}
        </div>
      )}
      {products.data && (
        <div className="mt-8 grid auto-rows-fr gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
          {products.data.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}
