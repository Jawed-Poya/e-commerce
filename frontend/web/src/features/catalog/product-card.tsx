import { ArrowUpRight, Check, Heart, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { imageUrl } from "../../shared/api/api-client";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { cn } from "../../shared/lib/utils";
import type { Product } from "../../shared/types/product";
import { useCart } from "../cart/cart-context";

export function ProductCard({ product }: { product: Product }) {
  const cart = useCart();
  const liked = cart.wishlist.includes(product.id);
  const primary = imageUrl(product.primaryImageUrl) || "/placeholder-product.svg";
  const alternate = product.images.find(
    (image) => image.url !== product.primaryImageUrl,
  );

  const addToCart = () =>
    cart.addItem({
      id: product.id,
      name: product.name,
      image: product.primaryImageUrl,
      price: product.price ?? 0,
      stock: product.stock,
    });

  return (
    <article className="group relative grid h-full min-w-0 grid-rows-[auto_1fr] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_4px_24px_rgba(15,23,42,.04)] transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1.5 hover:border-primary/25 hover:shadow-[0_20px_50px_rgba(7,89,183,.13)]">
      <div className="relative aspect-[1/1.06] overflow-hidden bg-gradient-to-b from-muted/40 to-muted">
        <Link
          to={`/products/${product.id}`}
          className="absolute inset-0 z-10"
          aria-label={`View ${product.name}`}
        />
        <img
          className={cn(
            "size-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.06]",
            alternate && "group-hover:opacity-0",
          )}
          src={primary}
          alt={product.name}
        />
        {alternate && (
          <img
            className="absolute inset-0 size-full scale-[1.04] object-cover opacity-0 transition-all duration-700 ease-out group-hover:scale-100 group-hover:opacity-100"
            src={imageUrl(alternate.url) ?? primary}
            alt=""
          />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-t from-black/35 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-2">
          {product.isFeatured && (
            <Badge className="border border-white/20 bg-primary/95 text-primary-foreground shadow-sm backdrop-blur">
              Featured
            </Badge>
          )}
          {product.stock < 1 && (
            <Badge className="bg-foreground/85 text-background backdrop-blur">
              Sold out
            </Badge>
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => cart.toggleWishlist(product.id)}
          className={cn(
            "absolute right-3 top-3 z-30 size-9 rounded-full border-white/70 bg-background/90 shadow-md backdrop-blur transition-all hover:scale-110",
            liked &&
              "border-brand-orange bg-brand-orange text-white hover:bg-brand-orange/90 hover:text-white",
          )}
          aria-label={liked ? "Remove from wishlist" : "Save product"}
        >
          <Heart className={cn("size-4", liked && "fill-current")} />
        </Button>

        <Link
          to={`/products/${product.id}`}
          className="absolute bottom-3 left-3 right-3 z-30 flex translate-y-4 items-center justify-between rounded-xl bg-background/95 px-4 py-3 text-xs font-bold opacity-0 shadow-xl backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
        >
          View product details
          <ArrowUpRight className="size-4 text-primary" />
        </Link>
      </div>

      <div className="grid min-h-52 grid-rows-[auto_3rem_1fr_auto] p-4 sm:min-h-56 sm:p-5">
        <p className="mb-2 h-4 truncate text-[10px] font-bold uppercase tracking-[.16em] text-primary">
          {product.categoryName}
        </p>
        <Link
          className="line-clamp-2 h-12 text-[15px] font-bold leading-6 tracking-[-.01em] transition-colors hover:text-primary"
          to={`/products/${product.id}`}
        >
          {product.name}
        </Link>

        <div className="row-start-4 pt-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <p className="text-2xl font-black tracking-tight text-foreground">
              ${(product.price ?? 0).toFixed(2)}
            </p>
            <p
              className={cn(
                "flex shrink-0 items-center gap-1 text-[11px] font-semibold",
                product.stock > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive",
              )}
            >
              {product.stock > 0 && <Check className="size-3.5" />}
              {product.stock > 0 ? `${product.stock} in stock` : "Unavailable"}
            </p>
          </div>

          <Button
            className="w-full rounded-xl transition-transform active:scale-[.98]"
            disabled={product.stock < 1}
            onClick={addToCart}
          >
            <ShoppingBag />
            {product.stock > 0 ? "Add to cart" : "Out of stock"}
          </Button>
        </div>
      </div>
    </article>
  );
}
