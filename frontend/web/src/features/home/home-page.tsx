import {
  ArrowRight,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "../../assets/storefront-hero.png";
import { imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { Skeleton } from "../../shared/components/ui/skeleton";
import { ProductCard } from "../catalog/product-card";
import { useLookups, useProducts } from "../catalog/use-catalog";
export function HomePage() {
  const products = useProducts({
    page: 1,
    pageSize: 8,
    isActive: true,
    sortBy: "createdAt",
    sortDescending: true,
  });
  const lookups = useLookups();
  const items = products.data?.items ?? [];
  const saleItems = items.filter(
    (item) => item.oldPrice && item.price && item.oldPrice > item.price,
  );
  const deal = items.find((x) => x.price && x.stock > 0) ?? items[0];
  return (
    <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <section className="py-6">
        <div className="relative min-h-[530px] overflow-hidden rounded-lg border bg-secondary">
          <img
            className="absolute inset-0 size-full object-cover object-center"
            src={heroImage}
            alt="EasyCart product collection"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent dark:from-[#071526] dark:via-[#071526]/90" />
          <div className="relative flex min-h-[560px] max-w-2xl flex-col justify-center px-7 py-14 sm:px-12 lg:px-16">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-primary">
              <PackageCheck className="size-4" />
              New collection
            </p>
            <h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-[-.05em] sm:text-6xl">
              Experience a <span className="text-primary">better way</span> to{" "}
              <span className="text-brand-orange">shop.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">
              Discover real products from your local catalog, check live
              availability and shop with confidence.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/products">
                  Shop now
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#products">View products</a>
              </Button>
            </div>
            <div className="mt-12 grid max-w-lg grid-cols-3 gap-3">
              {[
                [Truck, "Fast delivery"],
                [RotateCcw, "Easy returns"],
                [ShieldCheck, "Secure shopping"],
              ].map(([I, t]) => {
                const C = I as typeof Truck;
                return (
                  <div
                    key={String(t)}
                    className="flex items-center gap-2 text-xs font-semibold"
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-background shadow-sm">
                      <C className="size-4 text-primary" />
                    </span>
                    {String(t)}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="absolute right-7 top-7 hidden items-center gap-2 rounded-xl border bg-background/90 p-3 shadow-lg backdrop-blur sm:flex">
            <Star className="size-5 fill-brand-orange text-brand-orange" />
            <span>
              <b className="block text-sm">Trusted catalog</b>
              <small className="text-muted-foreground">Live product data</small>
            </span>
          </div>
        </div>
      </section>
      {saleItems.length > 0 && (
        <section className="py-12">
          <Heading
            eyebrow="Limited offers"
            title="Flash deals"
            to="/products"
          />
          <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
            {saleItems.slice(0, 5).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
      <section id="categories" className="py-14">
        <Heading
          eyebrow="Browse categories"
          title="Shop by categories"
          to="/products"
        />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {lookups.isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))
            : lookups.data?.categories.slice(0, 6).map((x) => (
                <Link
                  key={x.id}
                  to={`/products?categoryId=${x.id}`}
                  className="group overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/50"
                >
                  <div className="aspect-[1.05/1] overflow-hidden border-b bg-muted">
                    {x.imageUrl ? (
                      <img
                        src={imageUrl(x.imageUrl) ?? ""}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="grid size-full place-items-center text-muted-foreground">
                        <ShoppingBag className="size-10" />
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-bold">{x.name}</h3>
                    <span className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      {x.productCount}{" "}
                      {x.productCount === 1 ? "product" : "products"}
                      <ArrowRight className="size-4 text-foreground" />
                    </span>
                  </div>
                </Link>
              ))}
        </div>
      </section>
      <section
        id="deals"
        className="grid gap-5 py-6 lg:grid-cols-[1.35fr_.65fr]"
      >
        {" "}
        <div className="relative min-h-80 overflow-hidden rounded-lg bg-primary p-8 text-primary-foreground sm:p-10">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-300">
            Featured from the catalog
          </p>
          <h2 className="mt-5 max-w-md text-3xl font-black sm:text-4xl">
            Don't miss products selected for you.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-primary-foreground/75">
            Real product information, gallery images, pricing and
            availability—all in one place.
          </p>
          <Button asChild variant="orange" className="mt-7">
            <Link to={deal ? `/products/${deal.id}` : "/products"}>
              View product
              <ArrowRight />
            </Link>
          </Button>
          {deal && (
            <img
              className="absolute bottom-0 right-0 hidden h-[90%] w-[45%] object-contain sm:block"
              src={imageUrl(deal.primaryImageUrl) || "/placeholder-product.svg"}
              alt={deal.name}
            />
          )}
        </div>
        <div className="grid gap-5">
          <Promo
            color="bg-orange-100 dark:bg-orange-950/40"
            label="New arrivals"
            title="Fresh products added regularly"
          />
          <Promo
            color="bg-blue-100 dark:bg-blue-950/40"
            label="Free delivery"
            title="On qualifying orders over $75"
          />
        </div>
      </section>
      <section id="products" className="py-16">
        <Heading
          eyebrow="Featured products"
          title="Just for you"
          to="/products"
        />
        {products.isError ? (
          <div className="rounded-2xl border border-dashed p-14 text-center text-muted-foreground">
            The product catalog is temporarily unavailable.
          </div>
        ) : (
          <div className="grid auto-rows-fr items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
            {products.isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-[420px]" />
                ))
              : items.map((x) => <ProductCard key={x.id} product={x} />)}
          </div>
        )}
      </section>
    </div>
  );
}
function Heading({
  eyebrow,
  title,
  to,
}: {
  eyebrow: string;
  title: string;
  to: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">{title}</h2>
      </div>
      <Button asChild variant="outline">
        <Link to={to}>
          View all
          <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
function Promo({
  color,
  label,
  title,
}: {
  color: string;
  label: string;
  title: string;
}) {
  return (
    <Link
      to="/products"
      className={`${color} group flex min-h-36 flex-col justify-center rounded-2xl border p-6`}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
        {label}
      </p>
      <h3 className="mt-2 max-w-xs text-xl font-black">{title}</h3>
      <ArrowRight className="mt-4 size-4 transition group-hover:translate-x-1" />
    </Link>
  );
}
