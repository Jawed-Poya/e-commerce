import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    BadgePercent,
    ChevronRight,
    Clock3,
    Headphones,
    HeartPulse,
    MapPin,
    PackageCheck,
    RotateCcw,
    ShieldCheck,
    ShoppingBag,
    Sparkles,
    Star,
    Truck,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import fallbackHeroImage from "../../assets/storefront-hero.png";
import { useI18n } from "../../i18n/i18n-provider";
import { imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { Skeleton } from "../../shared/components/ui/skeleton";
import { formatMoney } from "../../shared/lib/money";
import { productPath } from "../../shared/lib/product-path";
import { cn } from "../../shared/lib/utils";
import type { Product } from "../../shared/types/product";
import { buildCategoryTree, type CategoryNode } from "../catalog/category-tree";
import { ProductCard } from "../catalog/product-card";
import { useLookups, useProducts } from "../catalog/use-catalog";
import { useCompany } from "../company/company-context";
import {
    getStorefrontContent,
    localizedHero,
} from "../storefront-content/storefront-content-api";

interface HeroSlide {
    id: string;
    eyebrow: string;
    title: string;
    description: string;
    primaryText: string;
    primaryUrl: string;
    secondaryText: string;
    secondaryUrl: string;
    image: string;
    product?: Product;
}

const categoryTints = [
    "from-cyan-50 to-sky-100/70 dark:from-cyan-950/45 dark:to-sky-950/20",
    "from-emerald-50 to-teal-100/70 dark:from-emerald-950/45 dark:to-teal-950/20",
    "from-violet-50 to-fuchsia-100/60 dark:from-violet-950/45 dark:to-fuchsia-950/20",
    "from-amber-50 to-orange-100/70 dark:from-amber-950/40 dark:to-orange-950/20",
    "from-rose-50 to-pink-100/65 dark:from-rose-950/40 dark:to-pink-950/20",
    "from-indigo-50 to-blue-100/70 dark:from-indigo-950/45 dark:to-blue-950/20",
] as const;

const serviceItems = [
    { icon: ShieldCheck, title: "home.secureShopping", description: "home.protectedCheckout" },
    { icon: Truck, title: "home.fastDelivery", description: "home.deliveryTracking" },
    { icon: RotateCcw, title: "home.easyReturns", description: "home.simplePolicy" },
    { icon: BadgeCheck, title: "home.trustedCatalog", description: "home.updatedInfo" },
] as const;

export function HomePage() {
    const location = useLocation();
    const { company } = useCompany();
    const { language, t } = useI18n();
    const [slideIndex, setSlideIndex] = useState(0);
    const [paused, setPaused] = useState(false);

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
        pageSize: 30,
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

    const items = useMemo(() => products.data?.items ?? [], [products.data?.items]);
    const categories = buildCategoryTree(lookups.data?.categories ?? []).slice(0, 8);
    const featured = items.filter((item) => item.isFeatured);
    const featuredProducts = (featured.length >= 5 ? featured : items).slice(0, 10);
    const newestProducts = items.slice(0, 5);
    const discountedProducts = items.filter(
        (item) => item.price != null && item.oldPrice != null && item.oldPrice > item.price,
    );
    const spotlightProduct = discountedProducts[0] ?? featuredProducts[0] ?? items[0];
    const compactProducts = (featuredProducts.length ? featuredProducts : items).slice(0, 2);
    const hero = content.data ? localizedHero(content.data, language) : null;

    const slides = useMemo<HeroSlide[]>(() => {
        const result: HeroSlide[] = [
            {
                id: "storefront",
                eyebrow: hero?.eyebrow ?? t("home.safeReliable"),
                title: hero?.title ?? t("home.heroFallbackTitle"),
                description: hero?.description ?? t("home.heroFallbackDescription"),
                primaryText: hero?.primaryButtonText ?? t("common.shopNow"),
                primaryUrl: content.data?.primaryButtonUrl ?? "/products",
                secondaryText: hero?.secondaryButtonText ?? t("nav.categories"),
                secondaryUrl: content.data?.secondaryButtonUrl?.startsWith("/#")
                    ? "/#categories"
                    : content.data?.secondaryButtonUrl ?? "/#categories",
                image: imageUrl(content.data?.heroImageUrl) ?? fallbackHeroImage,
            },
        ];

        featured
            .filter((product) => product.primaryImageUrl)
            .slice(0, 3)
            .forEach((product) => {
                result.push({
                    id: `product-${product.id}`,
                    eyebrow: t("home.featuredCatalog"),
                    title: product.name,
                    description: product.shortDescription ?? t("home.selectedDescription"),
                    primaryText: t("home.viewProduct"),
                    primaryUrl: productPath(product),
                    secondaryText: t("common.viewAll"),
                    secondaryUrl: "/products?featured=true",
                    image: imageUrl(product.primaryImageUrl) ?? fallbackHeroImage,
                    product,
                });
            });

        return result;
    }, [content.data, featured, hero, t]);

    useEffect(() => {
        if (paused || slides.length < 2) return;
        const timer = window.setInterval(
            () => setSlideIndex((current) => (current + 1) % slides.length),
            6200,
        );
        return () => window.clearInterval(timer);
    }, [paused, slides.length]);

    useEffect(() => {
        setSlideIndex((current) => Math.min(current, Math.max(0, slides.length - 1)));
    }, [slides.length]);

    const activeSlide = slides[slideIndex] ?? slides[0];
    const moveSlide = (direction: number) =>
        setSlideIndex((current) => (current + direction + slides.length) % slides.length);

    return (
        <div className="mx-auto w-full max-w-[1480px] px-3 pb-12 sm:px-5 lg:px-7">
            <section className="pt-4 sm:pt-6">
                <div className="rounded-[32px] border border-slate-200/90 bg-[#f7faf9] p-3 shadow-[0_28px_90px_-58px_rgba(15,23,42,.55)] dark:border-white/10 dark:bg-slate-950/70 sm:p-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <article
                            className="relative min-h-[430px] overflow-hidden rounded-[26px] border border-white/80 bg-gradient-to-br from-white via-[#f5fbf9] to-[#eaf5f1] dark:border-white/10 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/30"
                            onMouseEnter={() => setPaused(true)}
                            onMouseLeave={() => setPaused(false)}
                        >
                            <div className="absolute -end-24 -top-24 size-[430px] rounded-full bg-primary/12 blur-3xl" />
                            <div className="absolute -bottom-28 start-1/4 size-80 rounded-full bg-cyan-400/10 blur-3xl" />

                            {content.isLoading ? (
                                <HeroSkeleton />
                            ) : (
                                <div key={activeSlide.id} className="hero-copy-enter relative grid min-h-[430px] items-center gap-5 px-6 py-10 sm:px-9 lg:grid-cols-[minmax(0,.9fr)_minmax(330px,1.1fr)] lg:px-12">
                                    <div className="relative z-10 max-w-xl">
                                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/75 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.15em] text-primary shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[.05]">
                                            <HeartPulse className="size-3.5" />
                                            {activeSlide.eyebrow}
                                        </div>
                                        <h1 className="mt-5 text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl lg:text-[58px]">
                                            {activeSlide.title}
                                        </h1>
                                        <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
                                            {activeSlide.description}
                                        </p>

                                        {activeSlide.product?.price != null ? (
                                            <div className="mt-5 flex items-end gap-2">
                                                <span className="text-3xl font-black tracking-[-.05em] text-primary">
                                                    {formatMoney(activeSlide.product.price)}
                                                </span>
                                                {activeSlide.product.unitName ? (
                                                    <span className="pb-1 text-xs font-bold text-muted-foreground">/ {activeSlide.product.unitName}</span>
                                                ) : null}
                                            </div>
                                        ) : null}

                                        <div className="mt-7 flex flex-wrap gap-2.5">
                                            <Button asChild size="lg" className="h-11 rounded-xl px-6 font-black shadow-lg shadow-primary/15">
                                                <Link viewTransition to={activeSlide.primaryUrl}>
                                                    {activeSlide.primaryText}
                                                    <ArrowRight className="size-4 rtl:rotate-180" />
                                                </Link>
                                            </Button>
                                            <Button asChild size="lg" variant="outline" className="h-11 rounded-xl border-slate-300/80 bg-white/70 px-5 font-black backdrop-blur dark:border-white/12 dark:bg-white/[.04]">
                                                <Link viewTransition to={activeSlide.secondaryUrl}>{activeSlide.secondaryText}</Link>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="relative flex min-h-[280px] items-center justify-center lg:min-h-[390px]">
                                        <div className="absolute inset-[12%] rounded-full bg-white/85 shadow-[0_32px_90px_-44px_rgba(15,23,42,.55)] ring-1 ring-white dark:bg-white/[.035] dark:ring-white/10" />
                                        <div className="absolute start-[10%] top-[18%] size-3 rounded-full bg-primary shadow-[0_0_0_8px_rgba(16,185,129,.08)]" />
                                        <div className="absolute end-[8%] top-[28%] size-2 rounded-full bg-cyan-500 shadow-[0_0_0_7px_rgba(6,182,212,.08)]" />
                                        <img
                                            src={activeSlide.image}
                                            alt={activeSlide.title}
                                            className="hero-media-enter relative z-10 h-[270px] w-full object-contain p-5 drop-shadow-[0_32px_28px_rgba(15,23,42,.22)] sm:h-[330px] lg:h-[390px]"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="absolute bottom-4 start-5 z-20 flex items-center gap-2">
                                <button type="button" onClick={() => moveSlide(-1)} aria-label={t("home.previousSlide")} className="grid size-9 place-items-center rounded-full border border-white/70 bg-white/80 text-foreground shadow-sm backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-slate-950/75">
                                    <ArrowLeft className="size-4 rtl:rotate-180" />
                                </button>
                                <div className="flex items-center gap-1.5 rounded-full border border-white/70 bg-white/75 px-2.5 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/75">
                                    {slides.map((slide, index) => (
                                        <button
                                            key={slide.id}
                                            type="button"
                                            aria-label={t("home.goToSlide", { number: index + 1 })}
                                            onClick={() => setSlideIndex(index)}
                                            className={cn("h-1.5 rounded-full transition-all", index === slideIndex ? "w-7 bg-primary" : "w-1.5 bg-slate-300 dark:bg-white/25")}
                                        />
                                    ))}
                                </div>
                                <button type="button" onClick={() => moveSlide(1)} aria-label={t("home.nextSlide")} className="grid size-9 place-items-center rounded-full border border-white/70 bg-white/80 text-foreground shadow-sm backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-slate-950/75">
                                    <ArrowRight className="size-4 rtl:rotate-180" />
                                </button>
                            </div>
                        </article>

                        <aside className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                            <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[.14em] text-primary">{t("home.shopByCategory")}</p>
                                        <h2 className="mt-1 text-lg font-black tracking-[-.03em]">{t("home.browseCollection")}</h2>
                                    </div>
                                    <Link viewTransition to="/#categories" className="grid size-9 place-items-center rounded-full border border-border/80 text-primary transition hover:bg-primary/5 dark:border-white/10">
                                        <ChevronRight className="size-4 rtl:rotate-180" />
                                    </Link>
                                </div>
                                <div className="mt-4 grid grid-cols-4 gap-2">
                                    {categories.slice(0, 8).map((category, index) => (
                                        <Link
                                            key={category.id}
                                            viewTransition
                                            to={`/products?categoryId=${category.id}`}
                                            title={category.name}
                                            className="group flex min-w-0 flex-col items-center gap-1.5"
                                        >
                                            <span className={cn("grid size-11 place-items-center overflow-hidden rounded-full bg-gradient-to-br ring-1 ring-black/[.04] transition group-hover:-translate-y-0.5 group-hover:ring-primary/25 dark:ring-white/10", categoryTints[index % categoryTints.length])}>
                                                {category.imageUrl ? <img src={imageUrl(category.imageUrl) ?? ""} alt="" className="size-full object-contain p-1.5" /> : <ShoppingBag className="size-4 text-primary" />}
                                            </span>
                                            <span className="w-full truncate text-center text-[9px] font-bold text-muted-foreground group-hover:text-primary">{category.name}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {compactProducts.map((product, index) => (
                                <MiniProductCard key={product.id} product={product} accent={index === 0 ? "emerald" : "violet"} />
                            ))}
                        </aside>
                    </div>

                    <div id="categories" className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
                        {lookups.isLoading
                            ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-[18px]" />)
                            : categories.map((category, index) => <CategoryDockCard key={category.id} category={category} index={index} />)}
                    </div>
                </div>
            </section>

            <section className="py-8 sm:py-11">
                <SectionHeading title={t("home.featuredProducts")} description={t("home.justForYouDescription")} to="/products?featured=true" />
                {products.isLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                        {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-[410px] rounded-[24px]" />)}
                    </div>
                ) : featuredProducts.length ? (
                    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                        {featuredProducts.slice(0, 5).map((product) => <ProductCard key={product.id} product={product} />)}
                    </div>
                ) : (
                    <EmptyPanel icon={<ShoppingBag className="size-6" />} title={t("home.productsUnavailable")} description={t("home.productsUnavailableDescription")} />
                )}
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(310px,.55fr)]">
                <article className="relative min-h-[330px] overflow-hidden rounded-[28px] border border-border/80 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 px-6 py-8 text-white shadow-[0_26px_72px_-48px_rgba(15,23,42,.8)] dark:border-white/12 sm:px-9">
                    <div className="absolute -end-20 -top-24 size-80 rounded-full bg-emerald-400/18 blur-3xl" />
                    <div className="relative z-10 max-w-[55%]">
                        <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-emerald-300"><BadgePercent className="size-4" />{t("home.limitedOffers")}</span>
                        <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-.045em] sm:text-4xl">{spotlightProduct?.name ?? t("home.selectedForYou")}</h2>
                        <p className="mt-3 line-clamp-3 text-sm leading-7 text-white/68">{spotlightProduct?.shortDescription ?? t("home.selectedDescription")}</p>
                        {spotlightProduct ? (
                            <div className="mt-6 flex flex-wrap items-center gap-3">
                                <Button asChild className="rounded-xl bg-white font-black text-slate-950 hover:bg-white/90">
                                    <Link viewTransition to={productPath(spotlightProduct)}>{t("home.viewProduct")}<ArrowRight className="size-4 rtl:rotate-180" /></Link>
                                </Button>
                                {spotlightProduct.price != null ? <span className="text-2xl font-black">{formatMoney(spotlightProduct.price)}</span> : null}
                            </div>
                        ) : null}
                    </div>
                    {spotlightProduct ? (
                        <Link viewTransition to={productPath(spotlightProduct)} className="absolute bottom-5 end-4 flex h-[82%] w-[42%] items-center justify-center rounded-[26px] border border-white/15 bg-white/[.98] p-6 shadow-2xl dark:bg-slate-900">
                            <img src={imageUrl(spotlightProduct.primaryImageUrl) ?? "/placeholder-product.svg"} alt={spotlightProduct.name} className="size-full object-contain drop-shadow-2xl transition duration-500 hover:scale-[1.04]" />
                        </Link>
                    ) : null}
                </article>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <InfoCard
                        icon={<Headphones />}
                        eyebrow={t("home.customerSupport")}
                        title={t("home.needHelpChoosing")}
                        description={t("home.supportDescription")}
                        action={company?.phone ? <a href={`tel:${company.phone}`}>{company.phone}</a> : company?.email ? <a href={`mailto:${company.email}`}>{company.email}</a> : <Link viewTransition to="/account/login">{t("common.account")}</Link>}
                    />
                    <InfoCard
                        icon={<MapPin />}
                        eyebrow={t("home.storeLocations")}
                        title={company?.branches?.[0]?.name ?? t("home.findNearestBranch")}
                        description={company?.branches?.[0]?.address ?? company?.address ?? t("home.branchDescription")}
                        action={<Link viewTransition to="/track-order">{t("nav.trackOrder")}</Link>}
                    />
                </div>
            </section>

            <section className="py-8 sm:py-11">
                <SectionHeading title={t("home.newArrivals")} description={t("home.freshDescription")} to="/products?sortBy=createdAt&sortDescending=true" />
                {products.isLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-[410px] rounded-[24px]" />)}</div>
                ) : (
                    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">{newestProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>
                )}
            </section>

            <section className="grid gap-3 rounded-[26px] border border-border/80 bg-card p-3 shadow-[0_18px_54px_-44px_rgba(15,23,42,.5)] dark:border-white/10 sm:grid-cols-2 lg:grid-cols-4">
                {serviceItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div key={item.title} className="flex items-center gap-3 rounded-[18px] border border-border/60 bg-muted/20 p-4 dark:border-white/8 dark:bg-white/[.025]">
                            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
                            <div><p className="text-sm font-black">{t(item.title)}</p><p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{t(item.description)}</p></div>
                        </div>
                    );
                })}
            </section>
        </div>
    );
}

function MiniProductCard({ product, accent }: { product: Product; accent: "emerald" | "violet" }) {
    const { t } = useI18n();
    return (
        <Link
            viewTransition
            to={productPath(product)}
            className={cn(
                "group grid min-h-[144px] grid-cols-[1fr_108px] overflow-hidden rounded-[24px] border p-4 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10",
                accent === "emerald" ? "border-emerald-100 bg-emerald-50/70 dark:bg-emerald-950/20" : "border-violet-100 bg-violet-50/70 dark:bg-violet-950/20",
            )}
        >
            <div className="min-w-0 self-center">
                <span className="text-[9px] font-black uppercase tracking-[.14em] text-primary">{t("home.featuredCatalog")}</span>
                <h3 className="mt-2 line-clamp-2 text-sm font-black leading-5">{product.name}</h3>
                <div className="mt-3 flex items-center gap-1.5"><Star className="size-3.5 fill-amber-400 text-amber-400" /><span className="text-[10px] font-bold text-muted-foreground">{product.reviewCount ? product.averageRating.toFixed(1) : "—"}</span></div>
                {product.price != null ? <p className="mt-2 text-lg font-black text-primary">{formatMoney(product.price)}</p> : null}
            </div>
            <div className="flex items-center justify-center overflow-hidden rounded-[18px] border border-white/70 bg-white/85 p-2 dark:border-white/10 dark:bg-slate-950/70">
                <img src={imageUrl(product.primaryImageUrl) ?? "/placeholder-product.svg"} alt={product.name} className="size-full object-contain drop-shadow-md transition duration-500 group-hover:scale-105" />
            </div>
        </Link>
    );
}

function CategoryDockCard({ category, index }: { category: CategoryNode; index: number }) {
    const { t } = useI18n();
    return (
        <Link viewTransition to={`/products?categoryId=${category.id}`} className="group grid grid-cols-[58px_1fr] items-center gap-2.5 rounded-[18px] border border-slate-200/80 bg-white p-2.5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:border-white/10 dark:bg-slate-950 md:flex md:min-h-[112px] md:flex-col md:justify-center md:text-center">
            <span className={cn("grid size-[58px] shrink-0 place-items-center overflow-hidden rounded-[16px] bg-gradient-to-br ring-1 ring-black/[.04] dark:ring-white/10", categoryTints[index % categoryTints.length])}>
                {category.imageUrl ? <img src={imageUrl(category.imageUrl) ?? ""} alt={category.name} className="size-full object-contain p-1.5 transition duration-500 group-hover:scale-105" /> : <ShoppingBag className="size-5 text-primary" />}
            </span>
            <span className="min-w-0"><span className="block line-clamp-2 text-xs font-black leading-4">{category.name}</span><span className="mt-1 block text-[9px] font-bold text-muted-foreground">{t("home.productCount", { count: category.productCount })}</span></span>
        </Link>
    );
}

function SectionHeading({ title, description, to }: { title: string; description: string; to: string }) {
    const { t } = useI18n();
    return (
        <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
            <div className="min-w-0"><h2 className="text-2xl font-black tracking-[-.042em] sm:text-3xl">{title}</h2><p className="mt-1.5 max-w-2xl text-xs leading-6 text-muted-foreground sm:text-sm">{description}</p></div>
            <Link viewTransition to={to} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-black text-primary shadow-sm transition hover:border-primary/30 hover:bg-primary/5 dark:border-white/10">{t("common.viewAll")}<ArrowRight className="size-3.5 rtl:rotate-180" /></Link>
        </div>
    );
}

function InfoCard({ icon, eyebrow, title, description, action }: { icon: ReactNode; eyebrow: string; title: string; description: string; action: ReactNode }) {
    return (
        <article className="relative overflow-hidden rounded-[24px] border border-border/80 bg-card p-5 shadow-[0_16px_46px_-40px_rgba(15,23,42,.58)] dark:border-white/10">
            <div className="absolute -end-10 -top-10 size-32 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex items-start gap-3.5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary [&>svg]:size-5">{icon}</span><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-primary">{eyebrow}</p><h3 className="mt-1.5 text-lg font-black tracking-[-.03em]">{title}</h3></div></div>
            <p className="relative mt-3 text-xs leading-6 text-muted-foreground">{description}</p>
            <div className="relative mt-4 inline-flex items-center gap-1.5 text-xs font-black text-primary [&_a]:hover:underline">{action}<ArrowRight className="size-3.5 rtl:rotate-180" /></div>
        </article>
    );
}

function EmptyPanel({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
    return <div className="rounded-[24px] border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center dark:border-white/12"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">{icon}</span><h3 className="mt-4 text-lg font-black">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p></div>;
}

function HeroSkeleton() {
    return <div className="grid min-h-[430px] items-center gap-6 px-8 py-10 lg:grid-cols-2"><div className="space-y-5"><Skeleton className="h-8 w-44 rounded-full" /><Skeleton className="h-28 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-11 w-40 rounded-xl" /></div><Skeleton className="h-[310px] rounded-full" /></div>;
}
