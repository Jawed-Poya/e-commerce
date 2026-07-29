import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    BadgePercent,
    Clock3,
    Headphones,
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
        pageSize: 24,
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
    const categoryTree = buildCategoryTree(lookups.data?.categories ?? []);
    const featured = items.filter((item) => item.isFeatured);
    const featuredProducts = (featured.length >= 4 ? featured : items).slice(0, 8);
    const newestProducts = items.slice(0, 8);
    const discountedProducts = items.filter(
        (item) => item.price != null && item.oldPrice != null && item.oldPrice > item.price,
    );
    const spotlightProduct = discountedProducts[0] ?? featuredProducts[0] ?? items[0];
    const hero = content.data ? localizedHero(content.data, language) : null;

    const slides = useMemo<HeroSlide[]>(() => {
        const configuredSecondaryUrl = content.data?.secondaryButtonUrl;
        const hasRemovedPrescriptionLink = configuredSecondaryUrl
            ?.toLowerCase()
            .includes("prescription");
        const secondaryUrl = hasRemovedPrescriptionLink
            ? "/?section=categories#categories"
            : configuredSecondaryUrl ?? "/?section=categories#categories";
        const secondaryText = hasRemovedPrescriptionLink
            ? t("nav.categories")
            : hero?.secondaryButtonText ?? t("nav.categories");

        const result: HeroSlide[] = [
            {
                id: "storefront",
                eyebrow: hero?.eyebrow ?? t("home.safeReliable"),
                title: hero?.title ?? t("home.heroFallbackTitle"),
                description: hero?.description ?? t("home.heroFallbackDescription"),
                primaryText: hero?.primaryButtonText ?? t("common.shopNow"),
                primaryUrl: content.data?.primaryButtonUrl ?? "/products",
                secondaryText,
                secondaryUrl,
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
            7000,
        );
        return () => window.clearInterval(timer);
    }, [paused, slides.length]);

    useEffect(() => {
        setSlideIndex((current) => Math.min(current, Math.max(0, slides.length - 1)));
    }, [slides.length]);

    const activeSlide = slides[slideIndex] ?? slides[0];
    const moveSlide = (direction: number) => {
        setSlideIndex((current) => (current + direction + slides.length) % slides.length);
    };

    return (
        <div className="mx-auto w-full max-w-[1480px] px-3 pb-10 sm:px-5 lg:px-7">
            <section className="pt-4 sm:pt-6">
                <div
                    className="relative overflow-hidden rounded-[30px] border border-border/80 bg-card shadow-[0_28px_90px_-52px_rgba(15,23,42,.52)] dark:border-white/12 dark:shadow-[0_30px_90px_-54px_rgba(0,0,0,.88)]"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_34%),radial-gradient(circle_at_90%_90%,color-mix(in_srgb,var(--brand-orange)_10%,transparent),transparent_32%)]" />

                    <div className="relative grid min-h-[520px] lg:grid-cols-[minmax(0,1.02fr)_minmax(430px,.98fr)]">
                        <div className="flex items-center px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
                            {content.isLoading ? (
                                <HeroSkeleton />
                            ) : (
                                <div key={activeSlide.id} className="hero-copy-enter max-w-2xl">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary sm:text-xs">
                                        <Sparkles className="size-4" />
                                        {activeSlide.eyebrow}
                                    </div>
                                    <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.052em] sm:text-5xl lg:text-[64px]">
                                        {activeSlide.title}
                                    </h1>
                                    <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                                        {activeSlide.description}
                                    </p>

                                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                        <Button asChild size="lg" className="h-12 rounded-xl px-7 font-bold shadow-lg shadow-primary/20">
                                            <Link viewTransition to={activeSlide.primaryUrl}>
                                                {activeSlide.primaryText}
                                                <ArrowRight className="size-4 rtl:rotate-180" />
                                            </Link>
                                        </Button>
                                        <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-border/90 bg-background/75 px-7 font-bold backdrop-blur dark:border-white/15 dark:bg-white/[0.04]">
                                            <Link viewTransition to={activeSlide.secondaryUrl}>
                                                {activeSlide.secondaryText}
                                            </Link>
                                        </Button>
                                    </div>

                                    <div className="mt-9 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
                                        <MiniPromise icon={<ShieldCheck />} title={t("home.secureShopping")} />
                                        <MiniPromise icon={<Truck />} title={t("home.fastDelivery")} />
                                        <MiniPromise icon={<PackageCheck />} title={t("home.liveAvailability")} className="col-span-2 sm:col-span-1" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative min-h-[380px] overflow-hidden border-t border-border/70 bg-muted/25 lg:min-h-0 lg:border-s lg:border-t-0 dark:border-white/10 dark:bg-white/[0.025]">
                            <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,color-mix(in_srgb,var(--primary)_7%,transparent)_100%)]" />
                            <div className="absolute inset-[12%] rounded-full bg-primary/12 blur-3xl" />
                            <div key={activeSlide.id} className="hero-product-enter absolute inset-0 flex items-center justify-center p-7 sm:p-10">
                                <div className="relative flex size-full max-h-[430px] max-w-[620px] items-center justify-center overflow-hidden rounded-[28px] border border-white/75 bg-white/90 p-6 shadow-[0_28px_80px_-34px_rgba(15,23,42,.45)] backdrop-blur dark:border-white/12 dark:bg-slate-950/82">
                                    <img
                                        src={activeSlide.image}
                                        alt={activeSlide.product?.name ?? activeSlide.title}
                                        className={cn(
                                            "size-full drop-shadow-2xl",
                                            activeSlide.product ? "object-contain" : "object-cover",
                                        )}
                                    />
                                    {activeSlide.product?.price != null ? (
                                        <div className="absolute bottom-5 start-5 rounded-2xl border border-white/80 bg-background/92 px-4 py-3 shadow-xl backdrop-blur dark:border-white/12">
                                            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                                {activeSlide.product.categoryName}
                                            </span>
                                            <span className="mt-1 block text-xl font-black tracking-[-0.03em]">
                                                {formatMoney(activeSlide.product.price)}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>

                    {slides.length > 1 ? (
                        <div className="absolute bottom-4 end-4 z-20 flex items-center gap-2 rounded-2xl border border-border/70 bg-background/88 p-1.5 shadow-lg backdrop-blur dark:border-white/12">
                            <button
                                type="button"
                                onClick={() => moveSlide(-1)}
                                className="grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-primary hover:text-primary-foreground"
                                aria-label={t("home.previousSlide")}
                            >
                                <ArrowLeft className="size-4 rtl:rotate-180" />
                            </button>
                            <div className="flex items-center gap-1.5 px-1">
                                {slides.map((slide, index) => (
                                    <button
                                        key={slide.id}
                                        type="button"
                                        onClick={() => setSlideIndex(index)}
                                        className={cn(
                                            "h-1.5 rounded-full transition-all",
                                            index === slideIndex ? "w-8 bg-primary" : "w-1.5 bg-foreground/20 hover:bg-foreground/40",
                                        )}
                                        aria-label={t("home.goToSlide", { number: index + 1 })}
                                    />
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => moveSlide(1)}
                                className="grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-primary hover:text-primary-foreground"
                                aria-label={t("home.nextSlide")}
                            >
                                <ArrowRight className="size-4 rtl:rotate-180" />
                            </button>
                        </div>
                    ) : null}
                </div>
            </section>

            <section className="py-4 sm:py-5">
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                    {serviceItems.map(({ icon: Icon, title, description }) => (
                        <div key={title} className="flex items-center gap-3 rounded-2xl border border-border/75 bg-card px-4 py-3.5 shadow-[0_12px_34px_-30px_rgba(15,23,42,.55)] dark:border-white/10">
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                <Icon className="size-5" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-black">{t(title)}</span>
                                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{t(description)}</span>
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            <section id="categories" className="scroll-mt-40 py-7 sm:py-10">
                <SectionHeading title={t("home.shopByCategory")} description={t("home.categoryDescription")} to="/products" />
                {lookups.isLoading ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                        {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-56 rounded-[24px]" />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                        {categoryTree.slice(0, 6).map((category, index) => (
                            <CategoryTile key={category.id} category={category} emphasis={index < 2} />
                        ))}
                    </div>
                )}
            </section>

            <section id="products" className="scroll-mt-40 py-7 sm:py-10">
                <SectionHeading title={t("home.featuredProducts")} description={t("home.justForYouDescription")} to="/products?featured=true" />
                {products.isLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-[430px] rounded-[24px]" />)}
                    </div>
                ) : products.isError ? (
                    <EmptyPanel icon={<ShoppingBag className="size-6" />} title={t("home.productsUnavailable")} description={t("home.productsUnavailableDescription")} />
                ) : (
                    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
                    </div>
                )}
            </section>

            <section id="deals" className="scroll-mt-40 py-7 sm:py-10">
                <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
                    <article className="relative min-h-[420px] overflow-hidden rounded-[30px] border border-primary/20 bg-gradient-to-br from-primary via-primary to-[color-mix(in_srgb,var(--primary)_68%,#041827)] p-7 text-primary-foreground shadow-[0_28px_80px_-40px_color-mix(in_srgb,var(--primary)_60%,transparent)] sm:p-10">
                        <div className="absolute -end-24 -top-20 size-80 rounded-full border border-white/10 bg-white/5" />
                        <div className="absolute -bottom-32 start-12 size-80 rounded-full bg-brand-orange/20 blur-3xl" />
                        <div className="relative z-10 max-w-[58%] sm:max-w-[54%]">
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]">
                                <BadgePercent className="size-4" />
                                {t("home.limitedOffers")}
                            </span>
                            <h2 className="mt-6 text-3xl font-black leading-tight tracking-[-0.045em] sm:text-5xl">
                                {spotlightProduct?.name ?? t("home.selectedForYou")}
                            </h2>
                            <p className="mt-4 max-w-lg text-sm leading-7 text-primary-foreground/78 sm:text-base">
                                {spotlightProduct?.shortDescription ?? t("home.selectedDescription")}
                            </p>
                            <div className="mt-7 flex flex-wrap items-center gap-3">
                                <Button asChild variant="orange" className="h-11 rounded-xl px-5 font-bold">
                                    <Link viewTransition to={spotlightProduct ? productPath(spotlightProduct) : "/products"}>
                                        {t("home.viewProduct")}
                                        <ArrowRight className="size-4 rtl:rotate-180" />
                                    </Link>
                                </Button>
                                {spotlightProduct?.price != null ? (
                                    <span className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-lg font-black backdrop-blur">
                                        {formatMoney(spotlightProduct.price)}
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        {spotlightProduct ? (
                            <Link viewTransition to={productPath(spotlightProduct)} className="absolute bottom-6 end-5 flex h-[72%] w-[39%] items-center justify-center overflow-hidden rounded-[26px] border border-white/30 bg-white/96 p-6 shadow-[0_34px_80px_-28px_rgba(2,8,23,.5)] dark:bg-slate-950/90 sm:end-8 sm:w-[41%]">
                                <div className="absolute inset-[18%] rounded-full bg-primary/10 blur-3xl" />
                                <img src={imageUrl(spotlightProduct.primaryImageUrl) ?? "/placeholder-product.svg"} alt={spotlightProduct.name} loading="lazy" decoding="async" className="relative z-10 size-full object-contain drop-shadow-2xl transition duration-500 hover:scale-[1.04]" />
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
                </div>
            </section>

            <section className="py-7 sm:py-10">
                <SectionHeading title={t("home.newArrivals")} description={t("home.freshDescription")} to="/products?sortBy=createdAt&sortDescending=true" />
                {products.isLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[430px] rounded-[24px]" />)}
                    </div>
                ) : (
                    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {newestProducts.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}
                    </div>
                )}
            </section>

            <section className="pb-3 pt-5">
                <div className="relative overflow-hidden rounded-[28px] border border-border/80 bg-card px-6 py-8 shadow-[0_24px_70px_-48px_rgba(15,23,42,.5)] dark:border-white/12 sm:px-9 lg:flex lg:items-center lg:justify-between lg:gap-8">
                    <div className="absolute -end-20 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
                    <div className="relative max-w-2xl">
                        <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                            <Clock3 className="size-4" />
                            {t("home.freshProducts")}
                        </span>
                        <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                            {t("home.browseCollection")}
                        </h2>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">
                            {t("footer.description")}
                        </p>
                    </div>
                    <Button asChild size="lg" className="relative mt-6 h-12 rounded-xl px-7 font-bold lg:mt-0">
                        <Link viewTransition to="/products">
                            {t("common.viewAll")}
                            <ArrowRight className="size-4 rtl:rotate-180" />
                        </Link>
                    </Button>
                </div>
            </section>
        </div>
    );
}

function MiniPromise({ icon, title, className }: { icon: ReactNode; title: string; className?: string }) {
    return (
        <div className={cn("flex items-center gap-2.5 rounded-2xl border border-border/70 bg-background/70 px-3 py-2.5 text-xs font-bold shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.035]", className)}>
            <span className="text-primary [&>svg]:size-4">{icon}</span>
            <span className="truncate">{title}</span>
        </div>
    );
}

function CategoryTile({ category, emphasis }: { category: CategoryNode; emphasis?: boolean }) {
    const { t } = useI18n();
    return (
        <Link
            viewTransition
            to={`/products?categoryId=${category.id}`}
            className={cn(
                "group relative flex min-h-[210px] flex-col overflow-hidden rounded-[24px] border border-border/80 bg-card p-3.5 shadow-[0_16px_44px_-36px_rgba(15,23,42,.65)] transition duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_24px_60px_-38px_rgba(15,23,42,.72)] dark:border-white/12",
                emphasis && "sm:col-span-1",
            )}
        >
            <span className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[18px] bg-gradient-to-br from-slate-50 via-white to-primary/[0.06] p-4 dark:from-slate-950 dark:via-slate-950 dark:to-primary/10">
                <span className="absolute inset-[18%] rounded-full bg-primary/8 blur-2xl transition group-hover:bg-primary/16" />
                {category.imageUrl ? (
                    <img src={imageUrl(category.imageUrl) ?? ""} alt={category.name} loading="lazy" decoding="async" className="relative z-10 size-full object-contain drop-shadow-md transition duration-500 group-hover:scale-[1.06]" />
                ) : (
                    <ShoppingBag className="relative z-10 size-10 text-primary" />
                )}
            </span>
            <span className="mt-4 line-clamp-2 text-sm font-black leading-5">{category.name}</span>
            <span className="mt-1.5 text-[11px] font-medium text-muted-foreground">{t("home.productCount", { count: category.productCount })}</span>
        </Link>
    );
}

function SectionHeading({ title, description, to }: { title: string; description: string; to: string }) {
    const { t } = useI18n();
    return (
        <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
            <div className="min-w-0">
                <h2 className="text-2xl font-black tracking-[-0.042em] sm:text-3xl">{title}</h2>
                <p className="mt-1.5 max-w-2xl text-xs leading-6 text-muted-foreground sm:text-sm">{description}</p>
            </div>
            <Link viewTransition to={to} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-black text-primary shadow-sm transition hover:border-primary/30 hover:bg-primary/5 dark:border-white/10">
                {t("common.viewAll")}
                <ArrowRight className="size-3.5 rtl:rotate-180" />
            </Link>
        </div>
    );
}

function InfoCard({ icon, eyebrow, title, description, action }: { icon: ReactNode; eyebrow: string; title: string; description: string; action: ReactNode }) {
    return (
        <article className="relative overflow-hidden rounded-[26px] border border-border/80 bg-card p-6 shadow-[0_18px_52px_-42px_rgba(15,23,42,.58)] dark:border-white/12">
            <div className="absolute -end-12 -top-12 size-36 rounded-full bg-primary/10 blur-2xl" />
            <span className="relative grid size-12 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary [&>svg]:size-5">{icon}</span>
            <p className="relative mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
            <h3 className="relative mt-2 text-xl font-black tracking-[-0.03em]">{title}</h3>
            <p className="relative mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-black text-primary [&_a]:hover:underline">
                {action}
                <ArrowRight className="size-4 rtl:rotate-180" />
            </div>
        </article>
    );
}

function EmptyPanel({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
    return (
        <div className="rounded-[24px] border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center dark:border-white/12">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">{icon}</span>
            <h3 className="mt-4 text-lg font-black">{title}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
    );
}

function HeroSkeleton() {
    return (
        <div className="max-w-xl space-y-5">
            <Skeleton className="h-8 w-44 rounded-full" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <div className="flex gap-3">
                <Skeleton className="h-12 w-36 rounded-xl" />
                <Skeleton className="h-12 w-36 rounded-xl" />
            </div>
        </div>
    );
}
