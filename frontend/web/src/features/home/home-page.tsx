import {
    ArrowRight,
    BadgePercent,
    PackageCheck,
    RotateCcw,
    ShieldCheck,
    ShoppingBag,
    Sparkles,
    Star,
    Truck,
} from "lucide-react";
import { Link } from "react-router-dom";

import heroImage from "../../assets/storefront-hero.png";
import { imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { Skeleton } from "../../shared/components/ui/skeleton";
import { buildCategoryTree } from "../catalog/category-tree";
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

    const categoryTree = buildCategoryTree(lookups.data?.categories ?? []);

    return (
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
            {/* Hero */}
            <section className="pb-5 pt-4 sm:py-7">
                <div className="relative min-h-[520px] overflow-hidden rounded-[26px] border border-border/70 bg-muted shadow-[0_24px_70px_-42px_rgba(15,23,42,0.4)] sm:min-h-[580px] sm:rounded-[30px] dark:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.75)]">
                    <img
                        src={heroImage}
                        alt="EasyCart product collection"
                        className="absolute inset-0 size-full object-cover object-[68%_center] transition-transform duration-[1400ms] hover:scale-[1.015] sm:object-[65%_center]"
                    />

                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/15 dark:from-[#06101f] dark:via-[#06101f]/95 dark:to-[#06101f]/20" />

                    <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent sm:from-black/10" />

                    <div className="relative flex min-h-[520px] max-w-3xl flex-col justify-center px-5 py-12 sm:min-h-[580px] sm:px-10 sm:py-16 lg:px-16">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-background/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary shadow-sm backdrop-blur-md sm:text-xs">
                            <PackageCheck className="size-3.5 sm:size-4" />
                            New collection available
                        </div>

                        <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.04] tracking-[-0.05em] text-foreground sm:mt-6 sm:text-5xl lg:text-7xl">
                            Everything you need,
                            <span className="block text-primary">
                                all in one place.
                            </span>
                        </h1>

                        <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:mt-6 sm:text-base sm:leading-8">
                            Discover real products from your local catalog,
                            compare prices, check live availability, and shop
                            with confidence.
                        </p>

                        <div className="mt-7 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:gap-3">
                            <Button
                                asChild
                                size="lg"
                                className="h-12 rounded-xl px-7 font-bold shadow-lg shadow-primary/20"
                            >
                                <Link to="/products">
                                    Shop now
                                    <ArrowRight className="size-4" />
                                </Link>
                            </Button>

                            <Button
                                asChild
                                size="lg"
                                variant="outline"
                                className="h-12 rounded-xl border-border/80 bg-background/75 px-7 font-bold shadow-sm backdrop-blur"
                            >
                                <a href="#products">Explore products</a>
                            </Button>
                        </div>

                        <div className="mt-8 grid max-w-2xl grid-cols-3 gap-2 sm:mt-10 sm:gap-3">
                            {[
                                {
                                    icon: Truck,
                                    title: "Fast delivery",
                                    description: "Safe and reliable",
                                },
                                {
                                    icon: RotateCcw,
                                    title: "Easy returns",
                                    description: "Simple policy",
                                },
                                {
                                    icon: ShieldCheck,
                                    title: "Secure shopping",
                                    description: "Protected checkout",
                                },
                            ].map(({ icon: Icon, title, description }) => (
                                <div
                                    key={title}
                                    className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border/70 bg-background/75 p-2.5 text-center shadow-sm backdrop-blur-md sm:flex-row sm:p-3 sm:text-left"
                                >
                                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-10">
                                        <Icon className="size-4 sm:size-5" />
                                    </span>

                                    <span className="min-w-0">
                                        <span className="block truncate text-[10px] font-bold sm:text-sm">
                                            {title}
                                        </span>

                                        <span className="hidden truncate text-xs text-muted-foreground sm:block">
                                            {description}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="absolute right-5 top-5 hidden items-center gap-3 rounded-2xl border border-border/70 bg-background/85 p-3.5 shadow-xl backdrop-blur-xl sm:flex lg:right-8 lg:top-8">
                        <span className="grid size-11 place-items-center rounded-xl bg-orange-500/10">
                            <Star className="size-5 fill-orange-500 text-orange-500" />
                        </span>

                        <span>
                            <span className="block text-sm font-bold">
                                Trusted catalog
                            </span>
                            <span className="block text-xs text-muted-foreground">
                                Updated product information
                            </span>
                        </span>
                    </div>

                    <div className="absolute bottom-7 right-7 hidden rounded-2xl border border-border/70 bg-background/85 px-5 py-4 shadow-xl backdrop-blur-xl lg:block">
                        <div className="flex items-center gap-3">
                            <span className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <ShoppingBag className="size-5" />
                            </span>

                            <div>
                                <p className="text-sm font-black">
                                    Live availability
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Shop products currently in stock
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Flash deals */}
            {saleItems.length > 0 && (
                <section className="py-10 sm:py-16">
                    <Heading
                        icon={<BadgePercent className="size-4" />}
                        eyebrow="Limited-time offers"
                        title="Flash deals"
                        description="Popular products available at reduced prices."
                        to="/products"
                    />

                    <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
                        {saleItems.slice(0, 5).map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </section>
            )}

            {/* Categories */}
            <section id="categories" className="py-10 sm:py-16">
                <Heading
                    icon={<ShoppingBag className="size-4" />}
                    eyebrow="Browse our collection"
                    title="Shop by category"
                    description="Find what you need faster by exploring our main categories."
                    to="/products"
                />

                <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:auto-rows-[220px] md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4 lg:auto-rows-[240px]">
                    {lookups.isLoading
                        ? Array.from({ length: 5 }).map((_, index) => (
                              <Skeleton
                                  key={index}
                                  className="h-[210px] w-[82vw] max-w-[320px] shrink-0 snap-start rounded-[22px] md:h-auto md:w-auto md:max-w-none md:rounded-[24px]"
                              />
                          ))
                        : categoryTree.slice(0, 5).map((category, index) => (
                              <Link
                                  key={category.id}
                                  to={`/products?categoryId=${category.id}`}
                                  className={`group relative h-[210px] w-[82vw] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-border/70 bg-muted shadow-sm transition-all duration-300 active:scale-[0.99] md:h-auto md:w-auto md:max-w-none md:rounded-[24px] md:hover:-translate-y-1 md:hover:shadow-xl ${
                                      index === 0
                                          ? "md:col-span-2 lg:row-span-2"
                                          : index === 1
                                            ? "lg:col-span-2"
                                            : ""
                                  }`}
                              >
                                  {category.imageUrl ? (
                                      <img
                                          src={
                                              imageUrl(category.imageUrl) ?? ""
                                          }
                                          alt={category.name}
                                          className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                                      />
                                  ) : (
                                      <span className="grid size-full place-items-center bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                                          <ShoppingBag className="size-12" />
                                      </span>
                                  )}

                                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-6">
                                      <div className="min-w-0 text-white">
                                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65 sm:text-xs">
                                              Explore category
                                          </p>

                                          <h3
                                              className={`mt-1 font-black ${
                                                  index === 0
                                                      ? "text-xl sm:text-3xl"
                                                      : "text-lg sm:text-xl"
                                              }`}
                                          >
                                              {category.name}
                                          </h3>

                                          <p className="mt-1 truncate text-xs text-white/75 sm:text-sm">
                                              {category.children.length > 0
                                                  ? category.children
                                                        .slice(0, 3)
                                                        .map(
                                                            (child) =>
                                                                child.name,
                                                        )
                                                        .join(" · ")
                                                  : `${category.productCount} ${
                                                        category.productCount ===
                                                        1
                                                            ? "product"
                                                            : "products"
                                                    }`}
                                          </p>
                                      </div>

                                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-slate-950 shadow-lg transition-all duration-300 group-hover:translate-x-1 group-hover:bg-primary group-hover:text-white sm:size-10">
                                          <ArrowRight className="size-4" />
                                      </span>
                                  </div>
                              </Link>
                          ))}
                </div>
            </section>

            {/* Featured promotion */}
            <section
                id="deals"
                className="grid gap-4 py-7 sm:gap-5 sm:py-8 lg:grid-cols-[1.45fr_.55fr]"
            >
                <div className="relative min-h-[420px] overflow-hidden rounded-[26px] bg-gradient-to-br from-primary via-primary to-blue-700 p-6 text-primary-foreground shadow-xl shadow-primary/10 sm:min-h-[390px] sm:rounded-[28px] sm:p-10 lg:p-12">
                    <div className="absolute -left-16 -top-16 size-48 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute -bottom-20 right-0 size-72 rounded-full bg-blue-300/15 blur-3xl" />

                    <div className="relative z-10 max-w-lg">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-orange-200 backdrop-blur sm:text-[10px]">
                            <Sparkles className="size-3.5" />
                            Featured from the catalog
                        </div>

                        <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.04em] sm:mt-6 sm:text-4xl lg:text-5xl">
                            Products selected especially for you.
                        </h2>

                        <p className="mt-4 max-w-md text-sm leading-7 text-primary-foreground/75 sm:mt-5 sm:text-base">
                            View product images, current prices, stock
                            information, and all important details in one place.
                        </p>

                        <Button
                            asChild
                            variant="orange"
                            size="lg"
                            className="mt-7 h-12 rounded-xl px-6 font-bold shadow-lg sm:mt-8"
                        >
                            <Link
                                to={deal ? `/products/${deal.id}` : "/products"}
                            >
                                View product
                                <ArrowRight className="size-4" />
                            </Link>
                        </Button>
                    </div>

                    {deal && (
                        <div className="absolute bottom-0 right-0 h-[44%] w-[52%] sm:flex sm:h-full sm:w-[46%] sm:items-end sm:justify-center">
                            <div className="absolute bottom-3 right-3 size-[75%] rounded-full bg-white/10 blur-2xl sm:bottom-7 sm:right-7" />

                            <img
                                src={
                                    imageUrl(deal.primaryImageUrl) ||
                                    "/placeholder-product.svg"
                                }
                                alt={deal.name}
                                className="relative z-10 max-h-full w-full object-contain object-bottom drop-shadow-[0_25px_25px_rgba(0,0,0,0.24)] sm:max-h-[88%]"
                            />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-1">
                    <Promo
                        color="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/20"
                        icon={<Sparkles className="size-5" />}
                        label="New arrivals"
                        title="Fresh products added regularly"
                        description="Explore the latest products recently added to the catalog."
                    />

                    <Promo
                        color="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/20"
                        icon={<Truck className="size-5" />}
                        label="Free delivery"
                        title="On qualifying orders over $75"
                        description="Enjoy convenient delivery on eligible purchases."
                    />
                </div>
            </section>

            {/* Products */}
            <section id="products" className="py-12 sm:py-20">
                <Heading
                    icon={<Star className="size-4" />}
                    eyebrow="Featured products"
                    title="Just for you"
                    description="Discover products selected from the latest additions to our catalog."
                    to="/products"
                />

                {products.isError ? (
                    <div className="rounded-[26px] border border-dashed bg-muted/20 px-6 py-14 text-center sm:rounded-[28px] sm:py-16">
                        <span className="mx-auto grid size-14 place-items-center rounded-2xl border bg-background text-muted-foreground shadow-sm">
                            <ShoppingBag className="size-6" />
                        </span>

                        <h3 className="mt-5 text-lg font-bold">
                            Products are currently unavailable
                        </h3>

                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                            The product catalog is temporarily unavailable.
                            Please try again later.
                        </p>
                    </div>
                ) : (
                    <div className="grid auto-rows-fr items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
                        {products.isLoading
                            ? Array.from({ length: 8 }).map((_, index) => (
                                  <Skeleton
                                      key={index}
                                      className="h-[165px] rounded-2xl sm:h-[420px]"
                                  />
                              ))
                            : items.map((product) => (
                                  <ProductCard
                                      key={product.id}
                                      product={product}
                                  />
                              ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function Heading({
    icon,
    eyebrow,
    title,
    description,
    to,
}: {
    icon: React.ReactNode;
    eyebrow: string;
    title: string;
    description: string;
    to: string;
}) {
    return (
        <div className="mb-6 flex items-end justify-between gap-4 sm:mb-10 sm:gap-5">
            <div className="min-w-0">
                <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-primary sm:text-xs sm:tracking-[0.2em]">
                    {icon}
                    {eyebrow}
                </p>

                <h2 className="mt-1.5 text-2xl font-black tracking-[-0.035em] sm:mt-2 sm:text-3xl lg:text-4xl">
                    {title}
                </h2>

                <p className="mt-2 hidden max-w-xl text-sm leading-6 text-muted-foreground sm:block">
                    {description}
                </p>
            </div>

            <Button
                asChild
                variant="outline"
                size="sm"
                className="shrink-0 rounded-xl font-semibold sm:h-10 sm:px-4"
            >
                <Link to={to}>
                    <span className="hidden sm:inline">View all</span>
                    <ArrowRight className="size-4" />
                </Link>
            </Button>
        </div>
    );
}

function Promo({
    color,
    icon,
    label,
    title,
    description,
}: {
    color: string;
    icon: React.ReactNode;
    label: string;
    title: string;
    description: string;
}) {
    return (
        <Link
            to="/products"
            className={`${color} group relative flex min-h-[175px] flex-col justify-center overflow-hidden rounded-[22px] border border-border/70 p-4 transition-all duration-300 active:scale-[0.99] sm:min-h-[185px] sm:rounded-[24px] sm:p-6 sm:hover:-translate-y-1 sm:hover:shadow-xl`}
        >
            <div className="absolute -right-8 -top-8 size-28 rounded-full bg-white/40 blur-2xl dark:bg-white/5" />

            <span className="grid size-10 place-items-center rounded-xl border bg-background/70 text-primary shadow-sm backdrop-blur sm:size-11">
                {icon}
            </span>

            <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.16em] text-primary sm:mt-5 sm:text-[10px] sm:tracking-[0.18em]">
                {label}
            </p>

            <h3 className="mt-2 text-base font-black leading-tight sm:max-w-xs sm:text-xl">
                {title}
            </h3>

            <p className="mt-2 hidden max-w-sm text-xs leading-5 text-muted-foreground sm:block">
                {description}
            </p>

            <ArrowRight className="mt-3 size-4 transition-transform duration-300 group-hover:translate-x-1 sm:mt-4" />
        </Link>
    );
}
