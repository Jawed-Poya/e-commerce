import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
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
import { Link, useLocation } from "react-router-dom";

import fallbackHeroImage from "../../assets/storefront-hero.png";
import { useI18n } from "../../i18n/i18n-provider";
import { imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { Skeleton } from "../../shared/components/ui/skeleton";
import { buildCategoryTree } from "../catalog/category-tree";
import { ProductCard } from "../catalog/product-card";
import { useLookups, useProducts } from "../catalog/use-catalog";
import {
    getStorefrontContent,
    localizedHero,
} from "../storefront-content/storefront-content-api";

export function HomePage() {
    const location = useLocation();
    const { language, t } = useI18n();

    useEffect(() => {
        if (!location.hash) return;
        const frame = window.requestAnimationFrame(() => {
            document.getElementById(location.hash.slice(1))?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [location.hash]);

    const products = useProducts({
        page: 1,
        pageSize: 8,
        isActive: true,
        sortBy: "createdAt",
        sortDescending: true,
    });
    const lookups = useLookups();
    const content = useQuery({
        queryKey: ["storefront-content"],
        queryFn: getStorefrontContent,
        staleTime: 5 * 60_000,
    });

    const items = products.data?.items ?? [];
    const saleItems = items.filter(
        (item) => item.oldPrice && item.price && item.oldPrice > item.price,
    );
    const deal = items.find((item) => item.price && item.stock > 0) ?? items[0];
    const categoryTree = buildCategoryTree(lookups.data?.categories ?? []);
    const hero = content.data ? localizedHero(content.data, language) : null;
    const heroSource =
        imageUrl(content.data?.heroImageUrl) ?? fallbackHeroImage;

    return (
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
            <section className="pb-5 pt-4 sm:py-7">
                <div className="relative min-h-[520px] overflow-hidden rounded-[26px] border border-border/70 bg-muted shadow-[0_24px_70px_-42px_rgba(15,23,42,0.4)] sm:min-h-[580px] sm:rounded-[30px]">
                    <img
                        src={heroSource}
                        alt={hero?.title ?? "EasyCart"}
                        className="absolute inset-0 size-full object-cover object-[68%_center] transition-transform duration-[1400ms] hover:scale-[1.015] rtl:object-[32%_center]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/15 dark:from-[#06101f] dark:via-[#06101f]/95 dark:to-[#06101f]/20 rtl:bg-gradient-to-l" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/35 via-transparent to-transparent" />

                    <div className="relative flex min-h-[520px] max-w-3xl flex-col justify-center px-5 py-12 sm:min-h-[580px] sm:px-10 sm:py-16 lg:px-16">
                        {content.isLoading ? (
                            <HeroSkeleton />
                        ) : (
                            <>
                                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-background/75 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary shadow-sm backdrop-blur-md sm:text-xs">
                                    <PackageCheck className="size-3.5 sm:size-4" />
                                    {hero?.eyebrow}
                                </div>
                                <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.05] tracking-[-0.045em] sm:mt-6 sm:text-5xl lg:text-7xl">
                                    {hero?.title}
                                </h1>
                                <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:mt-6 sm:text-base sm:leading-8">
                                    {hero?.description}
                                </p>
                                <div className="mt-7 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:gap-3">
                                    <Button
                                        asChild
                                        size="lg"
                                        className="h-12 rounded-xl px-7 font-bold shadow-lg shadow-primary/20"
                                    >
                                        <Link to={content.data?.primaryButtonUrl ?? "/products"}>
                                            {hero?.primaryButtonText}
                                            <ArrowRight className="size-4 rtl:rotate-180" />
                                        </Link>
                                    </Button>
                                    <Button
                                        asChild
                                        size="lg"
                                        variant="outline"
                                        className="h-12 rounded-xl border-border/80 bg-background/75 px-7 font-bold shadow-sm backdrop-blur"
                                    >
                                        <Link to={content.data?.secondaryButtonUrl ?? "/products?featured=true"}>
                                            {hero?.secondaryButtonText}
                                        </Link>
                                    </Button>
                                </div>
                            </>
                        )}

                        <div className="mt-8 grid max-w-2xl grid-cols-3 gap-2 sm:mt-10 sm:gap-3">
                            {[
                                [Truck, t("home.fastDelivery"), t("home.safeReliable")],
                                [RotateCcw, t("home.easyReturns"), t("home.simplePolicy")],
                                [ShieldCheck, t("home.secureShopping"), t("home.protectedCheckout")],
                            ].map(([Icon, title, description]) => {
                                const FeatureIcon = Icon as typeof Truck;
                                return (
                                    <div
                                        key={String(title)}
                                        className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border/70 bg-background/75 p-2.5 text-center shadow-sm backdrop-blur-md sm:flex-row sm:p-3 sm:text-start"
                                    >
                                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-10">
                                            <FeatureIcon className="size-4 sm:size-5" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-[10px] font-bold sm:text-sm">
                                                {String(title)}
                                            </span>
                                            <span className="hidden truncate text-xs text-muted-foreground sm:block">
                                                {String(description)}
                                            </span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="absolute end-5 top-5 hidden items-center gap-3 rounded-2xl border border-border/70 bg-background/85 p-3.5 shadow-xl backdrop-blur-xl sm:flex lg:end-8 lg:top-8">
                        <span className="grid size-11 place-items-center rounded-xl bg-orange-500/10">
                            <Star className="size-5 fill-orange-500 text-orange-500" />
                        </span>
                        <span>
                            <span className="block text-sm font-bold">{t("home.trustedCatalog")}</span>
                            <span className="block text-xs text-muted-foreground">{t("home.updatedInfo")}</span>
                        </span>
                    </div>
                </div>
            </section>

            {saleItems.length > 0 && (
                <section className="py-10 sm:py-16">
                    <Heading
                        icon={<BadgePercent className="size-4" />}
                        eyebrow={t("home.limitedOffers")}
                        title={t("home.flashDeals")}
                        description={t("home.flashDealsDescription")}
                        to="/products"
                    />
                    <ProductGrid products={saleItems.slice(0, 5)} />
                </section>
            )}

            <section id="categories" className="py-10 sm:py-16">
                <Heading
                    icon={<ShoppingBag className="size-4" />}
                    eyebrow={t("home.browseCollection")}
                    title={t("home.shopByCategory")}
                    description={t("home.categoryDescription")}
                    to="/products"
                />
                <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:auto-rows-[220px] md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-4 lg:auto-rows-[240px]">
                    {lookups.isLoading
                        ? Array.from({ length: 5 }).map((_, index) => (
                              <Skeleton key={index} className="h-[210px] w-[82vw] max-w-[320px] shrink-0 rounded-[22px] md:h-auto md:w-auto md:max-w-none" />
                          ))
                        : categoryTree.slice(0, 5).map((category, index) => (
                              <Link
                                  key={category.id}
                                  to={`/products?categoryId=${category.id}`}
                                  className={`group relative h-[210px] w-[82vw] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-[22px] border bg-muted shadow-sm transition duration-300 md:h-auto md:w-auto md:max-w-none md:hover:-translate-y-1 md:hover:shadow-xl ${index === 0 ? "md:col-span-2 lg:row-span-2" : index === 1 ? "lg:col-span-2" : ""}`}
                              >
                                  {category.imageUrl ? (
                                      <img src={imageUrl(category.imageUrl) ?? ""} alt={category.name} className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                  ) : (
                                      <span className="grid size-full place-items-center bg-gradient-to-br from-primary/10 to-primary/5 text-primary"><ShoppingBag className="size-12" /></span>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white sm:p-6">
                                      <div className="min-w-0">
                                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">{t("home.exploreCategory")}</p>
                                          <h3 className={`mt-1 font-black ${index === 0 ? "text-xl sm:text-3xl" : "text-lg sm:text-xl"}`}>{category.name}</h3>
                                          <p className="mt-1 truncate text-xs text-white/75">{category.productCount} {t("common.products")}</p>
                                      </div>
                                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-slate-950 shadow-lg transition group-hover:bg-primary group-hover:text-white"><ArrowRight className="size-4 rtl:rotate-180" /></span>
                                  </div>
                              </Link>
                          ))}
                </div>
            </section>

            <section id="deals" className="grid gap-4 py-7 sm:gap-5 sm:py-8 lg:grid-cols-[1.45fr_.55fr]">
                <div className="relative min-h-[420px] overflow-hidden rounded-[26px] bg-gradient-to-br from-primary via-primary to-blue-700 p-6 text-primary-foreground shadow-xl sm:min-h-[390px] sm:p-10 lg:p-12">
                    <div className="relative z-10 max-w-lg">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-200">
                            <Sparkles className="size-3.5" /> {t("home.featuredCatalog")}
                        </div>
                        <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl lg:text-5xl">{t("home.selectedForYou")}</h2>
                        <p className="mt-4 max-w-md text-sm leading-7 text-primary-foreground/75 sm:text-base">{t("home.selectedDescription")}</p>
                        <Button asChild variant="orange" size="lg" className="mt-7 h-12 rounded-xl px-6 font-bold shadow-lg">
                            <Link to={deal ? `/products/${deal.id}` : "/products"}>{t("home.viewProduct")}<ArrowRight className="size-4 rtl:rotate-180" /></Link>
                        </Button>
                    </div>
                    {deal && (
                        <div className="absolute bottom-0 end-0 h-[44%] w-[52%] sm:flex sm:h-full sm:w-[46%] sm:items-end sm:justify-center">
                            <img src={imageUrl(deal.primaryImageUrl) || "/placeholder-product.svg"} alt={deal.name} className="relative z-10 max-h-full w-full object-contain object-bottom drop-shadow-[0_25px_25px_rgba(0,0,0,0.24)] sm:max-h-[88%]" />
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-1">
                    <Promo icon={<Sparkles className="size-5" />} label={t("home.newArrivals")} title={t("home.freshProducts")} description={t("home.freshDescription")} className="from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/20" />
                    <Promo icon={<Truck className="size-5" />} label={t("home.freeDelivery")} title={t("home.qualifyingOrders")} description={t("home.deliveryDescription")} className="from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/20" />
                </div>
            </section>

            <section id="products" className="py-12 sm:py-20">
                <Heading icon={<Star className="size-4" />} eyebrow={t("home.featuredProducts")} title={t("home.justForYou")} description={t("home.justForYouDescription")} to="/products" />
                {products.isError ? (
                    <div className="rounded-[26px] border border-dashed bg-muted/20 px-6 py-14 text-center">
                        <ShoppingBag className="mx-auto size-7 text-muted-foreground" />
                        <h3 className="mt-5 text-lg font-bold">{t("home.productsUnavailable")}</h3>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("home.productsUnavailableDescription")}</p>
                    </div>
                ) : products.isLoading ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
                        {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-[165px] rounded-2xl sm:h-[420px]" />)}
                    </div>
                ) : (
                    <ProductGrid products={items} />
                )}
            </section>
        </div>
    );
}

function HeroSkeleton() {
    return <div className="space-y-5"><Skeleton className="h-8 w-52 rounded-full" /><Skeleton className="h-36 max-w-2xl rounded-2xl" /><Skeleton className="h-20 max-w-xl rounded-xl" /><Skeleton className="h-12 w-72 rounded-xl" /></div>;
}

function ProductGrid({ products }: { products: Parameters<typeof ProductCard>[0]["product"][] }) {
    return <div className="grid auto-rows-fr items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}

function Heading({ icon, eyebrow, title, description, to }: { icon: React.ReactNode; eyebrow: string; title: string; description: string; to: string }) {
    const { t } = useI18n();
    return (
        <div className="mb-6 flex items-end justify-between gap-4 sm:mb-10">
            <div className="min-w-0">
                <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-primary sm:text-xs">{icon}{eyebrow}</p>
                <h2 className="mt-1.5 text-2xl font-black tracking-[-0.035em] sm:text-3xl lg:text-4xl">{title}</h2>
                <p className="mt-2 hidden max-w-xl text-sm leading-6 text-muted-foreground sm:block">{description}</p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0 rounded-xl font-semibold"><Link to={to}><span className="hidden sm:inline">{t("common.viewAll")}</span><ArrowRight className="size-4 rtl:rotate-180" /></Link></Button>
        </div>
    );
}

function Promo({ icon, label, title, description, className }: { icon: React.ReactNode; label: string; title: string; description: string; className: string }) {
    return (
        <Link to="/products" className={`group relative flex min-h-[175px] flex-col justify-center overflow-hidden rounded-[22px] border bg-gradient-to-br p-4 transition hover:-translate-y-1 hover:shadow-xl sm:min-h-[185px] sm:p-6 ${className}`}>
            <span className="grid size-10 place-items-center rounded-xl border bg-background/70 text-primary shadow-sm">{icon}</span>
            <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.16em] text-primary">{label}</p>
            <h3 className="mt-2 text-base font-black leading-tight sm:text-xl">{title}</h3>
            <p className="mt-2 hidden text-xs leading-5 text-muted-foreground sm:block">{description}</p>
            <ArrowRight className="mt-3 size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
        </Link>
    );
}
