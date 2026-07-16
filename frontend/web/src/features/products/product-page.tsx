import { Heart, PackageCheck, ShoppingBag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, imageUrl } from "../../shared/api/api-client";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { Skeleton } from "../../shared/components/ui/skeleton";
import { cn } from "../../shared/lib/utils";
import type { ProductDetails } from "../../shared/types/product";
import { useCart } from "../cart/cart-context";
export function ProductPage() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["product", id],
    queryFn: () => apiGet<ProductDetails>(`/products/${id}`),
    enabled: Boolean(id),
  });
  const [selected, setSelected] = useState<number | null>(null);
  const cart = useCart();
  if (q.isLoading)
    return (
      <div className="mx-auto w-full max-w-[1500px] px-4 py-14 sm:px-6 lg:px-8">
        <Skeleton className="h-[600px]" />
      </div>
    );
  if (!q.data)
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-3xl font-black">Product not found</h1>
        <Button asChild className="mt-6">
          <Link to="/products">Back to shop</Link>
        </Button>
      </div>
    );
  const p = q.data;
  const price =
    p.prices.find((x) => x.salePrice)?.salePrice ??
    p.prices[0]?.regularPrice ??
    0;
  const stock = p.inventory?.availableQuantity ?? 0;
  const active =
    p.images.find((x) => x.id === selected) ??
    p.images.find((x) => x.isPrimary) ??
    p.images[0];
  const liked = cart.wishlist.includes(p.id);
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex gap-2 text-xs text-muted-foreground">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/products">Products</Link>
        <span>/</span>
        <span className="truncate text-foreground">{p.name}</span>
      </div>
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
            <img
              className="size-full object-contain"
              src={imageUrl(active?.url) || "/placeholder-product.svg"}
              alt={p.name}
            />
          </div>
          {p.images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-3">
              {p.images.map((x) => (
                <button
                  key={x.id}
                  onClick={() => setSelected(x.id)}
                  className={cn(
                    "aspect-square overflow-hidden rounded-md border-2 bg-muted",
                    active?.id === x.id
                      ? "border-primary"
                      : "border-transparent",
                  )}
                >
                  <img
                    className="size-full object-cover"
                    src={imageUrl(x.url) ?? ""}
                    alt=""
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="py-2">
          <div className="flex gap-2">
            <Badge>{p.categoryName}</Badge>
            {p.isFeatured && (
              <Badge className="bg-accent text-accent-foreground">
                Featured
              </Badge>
            )}
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
            {p.name}
          </h1>
          <p className="mt-5 leading-8 text-muted-foreground">
            {p.shortDescription ||
              "A carefully selected product with transparent pricing and live availability."}
          </p>
          <p className="mt-7 text-4xl font-black text-primary">
            ${price.toFixed(2)}
          </p>
          <div
            className={cn(
              "mt-5 flex gap-3 rounded-lg border p-4",
              stock > 0
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-destructive/30 bg-destructive/5 text-destructive",
            )}
          >
            <PackageCheck className="size-5" />
            <span>
              <b className="block text-sm">
                {stock > 0
                  ? "In stock and ready to order"
                  : "Currently unavailable"}
              </b>
              <small>
                {stock > 0 ? `${stock} available` : "Check back soon"}
              </small>
            </span>
          </div>
          <div className="mt-6 flex gap-3">
            <Button
              size="lg"
              className="flex-1"
              disabled={stock < 1}
              onClick={() =>
                cart.addItem({
                  id: p.id,
                  name: p.name,
                  image: active?.url,
                  price,
                  stock,
                })
              }
            >
              <ShoppingBag />
              Add to cart
            </Button>
            <Button
              size="lg"
              variant="outline"
              className={cn(liked && "border-brand-orange text-brand-orange")}
              onClick={() => cart.toggleWishlist(p.id)}
            >
              <Heart className={cn(liked && "fill-current")} />
            </Button>
          </div>
          <div className="mt-8 border-t pt-6">
            <h2 className="font-bold">Product information</h2>
            {p.description && (
              <p className="mt-3 leading-7 text-muted-foreground">
                {p.description}
              </p>
            )}
            <dl className="mt-5 divide-y rounded-lg border px-4">
              {[
                ["Category", p.categoryName],
                ["Brand", p.brandName],
                ["Unit", p.unitName],
                ["Barcode", p.barcode],
              ]
                .filter((x) => x[1])
                .map((x) => (
                  <div key={x[0]} className="flex justify-between py-3 text-sm">
                    <dt className="text-muted-foreground">{x[0]}</dt>
                    <dd className="font-semibold">{x[1]}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
