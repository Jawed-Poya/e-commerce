import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    BadgePercent,
    Boxes,
    Check,
    ChevronRight,
    CircleHelp,
    HeartPulse,
    MapPin,
    PackageCheck,
    RotateCcw,
    ShieldCheck,
    ShoppingBag,
    Sparkles,
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
    {
        icon: ShieldCheck,
        title: "home.secureShopping",
        description: "home.protectedCheckout",
    },
    {
        icon: Truck,
        title: "home.fastDelivery",
        description: "home.deliveryTracking",
    },
    {
        icon: RotateCcw,
        title: "home.easyReturns",
        description: "home.simplePolicy",
    },
    {
        icon: BadgeCheck,
        title: "home.trustedCatalog",
        description: "home.updatedInfo",
    },
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

    const items = useMemo(
        () => products.data?.items ?? [],
        [products.data?.items],
    );
    const categories = buildCategoryTree(lookups.data?.categories ?? []).slice(
        0,
        8,
    );
    const featured = items.filter((item) => item.isFeatured);
    const featuredProducts = (featured.length >= 5 ? featured : items).slice(
        0,
        10,
    );
    const newestProducts = items.slice(0, 5);
    const discountedProducts = items.filter(
        (item) =>
            item.price != null &&
            item.oldPrice != null &&
            item.oldPrice > item.price,
    );
    const spotlightProduct =
        discountedProducts[0] ?? featuredProducts[0] ?? items[0];
    const hero = content.data ? localizedHero(content.data, language) : null;

    const slides = useMemo<HeroSlide[]>(() => {
        const result: HeroSlide[] = [
            {
                id: "storefront",
                eyebrow: hero?.eyebrow ?? t("home.pharmacyEyebrow"),
                title: hero?.title ?? t("home.pharmacyHeroTitle"),
                description:
                    hero?.description ?? t("home.pharmacyHeroDescription"),
                primaryText:
                    hero?.primaryButtonText ?? t("home.shopPharmacy"),
                primaryUrl: content.data?.primaryButtonUrl ?? "/products",
                secondaryText:
                    hero?.secondaryButtonText ?? t("nav.categories"),
                secondaryUrl: content.data?.secondaryButtonUrl?.startsWith("/#")
                    ? "/#categories"
                    : content.data?.secondaryButtonUrl ?? "/#categories",
                image:
                    imageUrl(content.data?.heroImageUrl) ?? fallbackHeroImage,
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
                    description:
                        product.shortDescription ??
                        t("home.selectedDescription"),
                    primaryText: t("home.viewProduct"),
                    primaryUrl: productPath(product),
                    secondaryText: t("common.viewAll"),
                    secondaryUrl: "/products?featured=true",
                    image:
                        imageUrl(product.primaryImageUrl) ?? fallbackHeroImage,
                    product,
                });
            });

        return result;
    }, [content.data, featured, hero, t]);

    useEffect(() => {
        if (paused || slides.length < 2) return;

        const timer = window.setInterval(
            () => setSlideIndex((current) => (current + 1) % slides.length),
            6500,
        );

        return () => window.clearInterval(timer);
    }, [paused, slides.length]);

    useEffect(() => {
        setSlideIndex((current) =>
            Math.min(current, Math.max(0, slides.length - 1)),
        );
    }, [slides.length]);

    const activeSlide = slides[slideIndex] ?? slides[0];
    const moveSlide = (direction: number) => {
        setSlideIndex(
            (current) =>
                (current + direction + slides.length) % slides.length,
        );
    };

    return (
        <div className="mx-auto w-full max-w-[1480px] px-4 pb-12 sm:px-6 lg:px-8">
            <section className="pt-5 sm:pt-7">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <article
                        className="relative min-h-[470px] overflow-hidden rounded-3xl border border-border/70 bg-card shadow-[0_22px_60px_-42px_rgba(15,23,42,.35)]"
                        onMouseEnter={() => setPaused(true)}
                        onMouseLeave={() => setPaused(false)}
                    >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_34%),linear-gradient(135deg,color-mix(in_srgb,var(--muted)_70%,transparent),transparent_55%)]" />

                        {content.isLoading ? (
                            <HeroSkeleton />
                        ) : (
                            <div
                                key={activeSlide.id}
                                className="hero-copy-enter relative grid min-h-[470px] items-center gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,.9fr)_minmax(360px,1.1fr)] lg:px-14"
                            >
                                <div className="relative z-10 max-w-xl">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-primary shadow-sm backdrop-blur">
                                        <HeartPulse className="size-3.5" />
                                        {activeSlide.eyebrow}
                                    </div>

                                    <h1 className="mt-5 text-4xl font-black leading-[1.04] tracking-[-0.055em] sm:text-5xl lg:text-[58px]">
                                        {activeSlide.title}
                                    </h1>

                                    <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
                                        {activeSlide.description}
                                    </p>

                                    {activeSlide.product?.price != null ? (
                                        <div className="mt-5 flex flex-wrap items-end gap-2">
                                            <span className="text-3xl font-black tracking-[-0.05em] text-primary">
                                                {formatMoney(
                                                    activeSlide.product.price,
                                                )}
                                            </span>
                                            {activeSlide.product.unitName ? (
                                                <span className="pb-1 text-xs font-semibold text-muted-foreground">
                                                    / {activeSlide.product.unitName}
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    <div className="mt-7 flex flex-wrap gap-3">
                                        <Button
                                            asChild
                                            size="lg"
                                            className="rounded-xl px-6 font-bold shadow-none"
                                        >
                                            <Link
                                                viewTransition
                                                to={activeSlide.primaryUrl}
                                            >
                                                {activeSlide.primaryText}
                                                <ArrowRight className="size-4 rtl:rotate-180" />
                                            </Link>
                                        </Button>
                                        <Button
                                            asChild
                                            size="lg"
                                            variant="outline"
                                            className="rounded-xl px-6 font-bold"
                                        >
                                            <Link
                                                viewTransition
                                                to={activeSlide.secondaryUrl}
                                            >
                                                {activeSlide.secondaryText}
                                            </Link>
                                        </Button>
                                    </div>

                                    <div className="mt-7 grid max-w-lg grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                                        <TrustPoint
                                            icon={<Check />}
                                            text={t("home.liveAvailability")}
                                        />
                                        <TrustPoint
                                            icon={<PackageCheck />}
                                            text={t("home.clearUnits")}
                                        />
                                        <TrustPoint
                                            icon={<ShieldCheck />}
                                            text={t("home.secureShopping")}
                                            className="hidden sm:flex"
                                        />
                                    </div>
                                </div>

                                <div className="relative flex min-h-[300px] items-center justify-center lg:min-h-[420px]">
                                    <div className="absolute inset-[8%] rounded-[42px] border border-border/60 bg-background/72 shadow-[0_28px_80px_-46px_rgba(15,23,42,.45)] backdrop-blur" />
                                    <div className="absolute end-[12%] top-[13%] rounded-xl border border-border/60 bg-background/90 px-3 py-2 text-[10px] font-bold text-muted-foreground shadow-sm">
                                        <span className="block text-primary">
                                            {t("home.liveAvailability")}
                                        </span>
                                        {t("home.inStockNow")}
                                    </div>
                                    <img
                                        src={activeSlide.image}
                                        alt={activeSlide.title}
                                        className="hero-media-enter relative z-10 h-[290px] w-full object-contain p-6 drop-shadow-[0_30px_26px_rgba(15,23,42,.18)] sm:h-[350px] lg:h-[420px]"
                                    />
                                </div>
                            </div>
                        )}

                        {slides.length > 1 ? (
                            <div className="absolute bottom-5 start-6 z-20 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => moveSlide(-1)}
                                    aria-label={t("home.previousSlide")}
                                    className="grid size-9 place-items-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm backdrop-blur transition hover:border-primary/30 hover:text-primary"
                                >
                                    <ArrowLeft className="size-4 rtl:rotate-180" />
                                </button>
                                <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/90 px-2.5 py-2 shadow-sm backdrop-blur">
                                    {slides.map((slide, index) => (
                                        <button
                                            key={slide.id}
                                            type="button"
                                            aria-label={t("home.goToSlide", {
                                                number: index + 1,
                                            })}
                                            onClick={() => setSlideIndex(index)}
                                            className={cn(
                                                "h-1.5 rounded-full transition-all",
                                                index === slideIndex
                                                    ? "w-7 bg-primary"
                                                    : "w-1.5 bg-border",
                                            )}
                                        />
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => moveSlide(1)}
                                    aria-label={t("home.nextSlide")}
                                    className="grid size-9 place-items-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm backdrop-blur transition hover:border-primary/30 hover:text-primary"
                                >
                                    <ArrowRight className="size-4 rtl:rotate-180" />
                                </button>
                            </div>
                        ) : null}
                    </article>

                    <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                        <article className="relative overflow-hidden rounded-3xl border border-border/70 bg-slate-950 p-6 text-white dark:bg-black">
                            <div className="absolute -end-16 -top-16 size-48 rounded-full bg-primary/35 blur-3xl" />
                            <div className="relative">
                                <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                                    <Boxes className="size-4" />
                                    {t("home.flexibleUnits")}
                                </span>
                                <h2 className="mt-4 text-2xl font-black leading-tight tracking-[-0.04em]">
                                    {t("home.unitShoppingTitle")}
                                </h2>
                                <p className="mt-3 text-sm leading-6 text-white/65">
                                    {t("home.unitShoppingDescription")}
                                </p>
                                <Button
                                    asChild
                                    variant="secondary"
                                    className="mt-6 rounded-xl bg-white font-bold text-slate-950 hover:bg-white/90"
                                >
                                    <Link viewTransition to="/products">
                                        {t("common.viewAll")}
                                        <ArrowRight className="size-4 rtl:rotate-180" />
                                    </Link>
                                </Button>
                            </div>
                        </article>

                        <article className="rounded-3xl border border-border/70 bg-card p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                                        {t("home.customerSupport")}
                                    </p>
                                    <h2 className="mt-2 text-xl font-black tracking-[-0.03em]">
                                        {t("home.needHelpChoosing")}
                                    </h2>
                                </div>
                                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                    <CircleHelp className="size-5" />
                                </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                {t("home.supportDescription")}
                            </p>
                            <div className="mt-5 flex items-center justify-between rounded-xl border border-border/70 bg-muted/25 px-3 py-3 text-sm">
                                <span className="min-w-0 truncate font-bold">
                                    {company?.phone ??
                                        company?.email ??
                                        t("common.account")}
                                </span>
                                <ArrowRight className="size-4 shrink-0 text-primary rtl:rotate-180" />
                            </div>
                        </article>
                    </aside>
                </div>
            </section>

            <section id="categories" className="py-10 sm:py-14">
                <SectionHeading
                    eyebrow={t("home.browseCollection")}
                    title={t("home.shopByCategory")}
                    description={t("home.categoryDescription")}
                    to="/products"
                />

                {lookups.isLoading ? (
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <Skeleton
                                key={index}
                                className="h-40 rounded-2xl"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
                        {categories.map((category) => (
                            <CategoryCard
                                key={category.id}
                                category={category}
                            />
                        ))}
                    </div>
                )}
            </section>

            <section className="pb-10 sm:pb-14">
                <SectionHeading
                    eyebrow={t("home.selectedForYou")}
                    title={t("home.featuredProducts")}
                    description={t("home.justForYouDescription")}
                    to="/products?featured=true"
                />

                {products.isLoading ? (
                    <ProductGridSkeleton />
                ) : featuredProducts.length ? (
                    <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                        {featuredProducts.slice(0, 5).map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                    <EmptyPanel
                        icon={<ShoppingBag className="size-6" />}
                        title={t("home.productsUnavailable")}
                        description={t("home.productsUnavailableDescription")}
                    />
                )}
            </section>

            <section id="deals" className="pb-10 sm:pb-14">
                <div className="grid overflow-hidden rounded-3xl border border-border/70 bg-card lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,.6fr)]">
                    <article className="relative min-h-[360px] overflow-hidden bg-slate-950 px-6 py-9 text-white dark:bg-black sm:px-10">
                        <div className="absolute -end-20 -top-20 size-72 rounded-full bg-primary/35 blur-3xl" />
                        <div className="relative z-10 max-w-[58%]">
                            <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                                <BadgePercent className="size-4" />
                                {t("home.limitedOffers")}
                            </span>
                            <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.045em] sm:text-4xl">
                                {spotlightProduct?.name ??
                                    t("home.selectedForYou")}
                            </h2>
                            <p className="mt-4 line-clamp-3 text-sm leading-7 text-white/65">
                                {spotlightProduct?.shortDescription ??
                                    t("home.selectedDescription")}
                            </p>
                            {spotlightProduct ? (
                                <div className="mt-7 flex flex-wrap items-center gap-4">
                                    <Button
                                        asChild
                                        className="rounded-xl bg-white font-bold text-slate-950 hover:bg-white/90"
                                    >
                                        <Link
                                            viewTransition
                                            to={productPath(spotlightProduct)}
                                        >
                                            {t("home.viewProduct")}
                                            <ArrowRight className="size-4 rtl:rotate-180" />
                                        </Link>
                                    </Button>
                                    {spotlightProduct.price != null ? (
                                        <span className="text-2xl font-black">
                                            {formatMoney(spotlightProduct.price)}
                                        </span>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>

                        {spotlightProduct ? (
                            <Link
                                viewTransition
                                to={productPath(spotlightProduct)}
                                className="absolute bottom-6 end-5 flex h-[78%] w-[38%] items-center justify-center rounded-3xl border border-white/10 bg-white p-6 shadow-2xl dark:bg-slate-900"
                            >
                                <img
                                    src={
                                        imageUrl(
                                            spotlightProduct.primaryImageUrl,
                                        ) ?? "/placeholder-product.svg"
                                    }
                                    alt={spotlightProduct.name}
                                    className="size-full object-contain transition duration-500 hover:scale-[1.04]"
                                />
                            </Link>
                        ) : null}
                    </article>

                    <div className="grid divide-y divide-border/70">
                        <InfoRow
                            icon={<MapPin />}
                            eyebrow={t("home.storeLocations")}
                            title={
                                company?.branches?.[0]?.name ??
                                t("home.findNearestBranch")
                            }
                            description={
                                company?.branches?.[0]?.address ??
                                company?.address ??
                                t("home.branchDescription")
                            }
                            to="/track-order"
                        />
                        <InfoRow
                            icon={<Sparkles />}
                            eyebrow={t("home.freshProducts")}
                            title={t("home.newArrivals")}
                            description={t("home.freshDescription")}
                            to="/products?sortBy=createdAt&sortDescending=true"
                        />
                    </div>
                </div>
            </section>

            <section className="pb-10 sm:pb-14">
                <SectionHeading
                    eyebrow={t("home.freshProducts")}
                    title={t("home.newArrivals")}
                    description={t("home.freshDescription")}
                    to="/products?sortBy=createdAt&sortDescending=true"
                />

                {products.isLoading ? (
                    <ProductGridSkeleton />
                ) : (
                    <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                        {newestProducts.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                )}
            </section>

            <section className="grid divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4 rtl:sm:divide-x-reverse">
                {serviceItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={item.title}
                            className="flex items-center gap-3 p-5"
                        >
                            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                <Icon className="size-5" />
                            </span>
                            <div>
                                <p className="text-sm font-bold">
                                    {t(item.title)}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {t(item.description)}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </section>
        </div>
    );
}

function TrustPoint({
    icon,
    text,
    className,
}: {
    icon: ReactNode;
    text: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex items-center gap-2 font-semibold text-muted-foreground",
                className,
            )}
        >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary [&>svg]:size-3.5">
                {icon}
            </span>
            <span>{text}</span>
        </div>
    );
}

function CategoryCard({ category }: { category: CategoryNode }) {
    const { t } = useI18n();

    return (
        <Link
            viewTransition
            to={`/products?categoryId=${category.id}`}
            className="group flex min-h-40 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_38px_-28px_rgba(15,23,42,.35)]"
        >
            <span className="flex min-h-24 flex-1 items-center justify-center border-b border-border/60 bg-muted/25 p-4">
                {category.imageUrl ? (
                    <img
                        src={imageUrl(category.imageUrl) ?? ""}
                        alt={category.name}
                        className="h-20 w-full object-contain transition duration-500 group-hover:scale-105"
                    />
                ) : (
                    <ShoppingBag className="size-8 text-primary/70" />
                )}
            </span>
            <span className="p-3">
                <span className="line-clamp-2 text-sm font-bold leading-5 transition group-hover:text-primary">
                    {category.name}
                </span>
                <span className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold text-muted-foreground">
                    {t("home.productCount", {
                        count: category.productCount,
                    })}
                    <ChevronRight className="size-3.5 shrink-0 rtl:rotate-180" />
                </span>
            </span>
        </Link>
    );
}

function SectionHeading({
    eyebrow,
    title,
    description,
    to,
}: {
    eyebrow: string;
    title: string;
    description: string;
    to: string;
}) {
    const { t } = useI18n();

    return (
        <div className="mb-6 flex items-end justify-between gap-4">
            <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">
                    {eyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                    {title}
                </h2>
                <p className="mt-2 max-w-2xl text-xs leading-6 text-muted-foreground sm:text-sm">
                    {description}
                </p>
            </div>
            <Button
                asChild
                variant="outline"
                className="hidden shrink-0 rounded-xl font-bold sm:inline-flex"
            >
                <Link viewTransition to={to}>
                    {t("common.viewAll")}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                </Link>
            </Button>
        </div>
    );
}

function InfoRow({
    icon,
    eyebrow,
    title,
    description,
    to,
}: {
    icon: ReactNode;
    eyebrow: string;
    title: string;
    description: string;
    to: string;
}) {
    const { t } = useI18n();

    return (
        <Link
            viewTransition
            to={to}
            className="group flex min-h-44 items-start gap-4 p-6 transition hover:bg-muted/35"
        >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:size-5">
                {icon}
            </span>
            <span className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                    {eyebrow}
                </span>
                <span className="mt-2 block text-xl font-black tracking-[-0.03em]">
                    {title}
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    {description}
                </span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                    {t("common.open")}
                    <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </span>
            </span>
        </Link>
    );
}

function EmptyPanel({
    icon,
    title,
    description,
}: {
    icon: ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
                {icon}
            </span>
            <h3 className="mt-4 text-lg font-black">{title}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {description}
            </p>
        </div>
    );
}

function ProductGridSkeleton() {
    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-[410px] rounded-2xl" />
            ))}
        </div>
    );
}

function HeroSkeleton() {
    return (
        <div className="grid min-h-[470px] items-center gap-8 px-8 py-10 lg:grid-cols-2">
            <div className="space-y-5">
                <Skeleton className="h-8 w-44 rounded-full" />
                <Skeleton className="h-28 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-11 w-48 rounded-xl" />
            </div>
            <Skeleton className="h-[340px] rounded-3xl" />
        </div>
    );
}
