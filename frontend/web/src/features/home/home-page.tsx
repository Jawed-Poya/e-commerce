import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
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
import {
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";

import fallbackHeroImage from "../../assets/storefront-hero.png";
import { useI18n } from "../../i18n/i18n-provider";
import { imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { Skeleton } from "../../shared/components/ui/skeleton";
import { formatMoney } from "../../shared/lib/money";
import { productPath } from "../../shared/lib/product-path";
import type { Product } from "../../shared/types/product";
import { buildCategoryTree, type CategoryNode } from "../catalog/category-tree";
import { getProducts } from "../catalog/catalog-api";
import { ProductCard } from "../catalog/product-card";
import { useLookups, useProducts } from "../catalog/use-catalog";
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
    secondaryText?: string;
    secondaryUrl?: string;
    backgroundImage: string;
    product?: Product;
}

export function HomePage() {
    const location = useLocation();
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
        pageSize: 12,
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
    const featured = items.filter((item) => item.isFeatured).slice(0, 3);
    const saleItems = items.filter(
        (item) => item.oldPrice && item.price && item.oldPrice > item.price,
    );
    const deal = saleItems[0] ?? items.find((item) => item.stock > 0) ?? items[0];
    const categoryTree = buildCategoryTree(lookups.data?.categories ?? []);
    const hero = content.data ? localizedHero(content.data, language) : null;

    const slides = useMemo<HeroSlide[]>(() => {
        const base: HeroSlide[] = [
            {
                id: "configured-hero",
                eyebrow: hero?.eyebrow ?? t("home.trustedCatalog"),
                title: hero?.title ?? t("home.shopByCategory"),
                description: hero?.description ?? t("home.categoryDescription"),
                primaryText: hero?.primaryButtonText ?? t("common.shopNow"),
                primaryUrl: content.data?.primaryButtonUrl ?? "/products",
                secondaryText:
                    hero?.secondaryButtonText ?? t("home.featuredProducts"),
                secondaryUrl:
                    content.data?.secondaryButtonUrl ?? "/products?featured=true",
                backgroundImage:
                    imageUrl(content.data?.heroImageUrl) ?? fallbackHeroImage,
            },
        ];

        featured.forEach((product) => {
            base.push({
                id: `featured-${product.id}`,
                eyebrow: t("home.featuredCatalog"),
                title: product.name,
                description:
                    product.shortDescription ?? t("home.selectedDescription"),
                primaryText: t("home.viewProduct"),
                primaryUrl: productPath(product),
                secondaryText: t("common.viewAll"),
                secondaryUrl: "/products?featured=true",
                backgroundImage: fallbackHeroImage,
                product,
            });
        });
        return base;
    }, [content.data, featured, hero, t]);

    useEffect(() => {
        setSlideIndex((current) => Math.min(current, slides.length - 1));
    }, [slides.length]);

    useEffect(() => {
        if (paused || slides.length < 2) return;
        const handle = window.setInterval(
            () => setSlideIndex((current) => (current + 1) % slides.length),
            7000,
        );
        return () => window.clearInterval(handle);
    }, [paused, slides.length]);

    const activeSlide = slides[slideIndex] ?? slides[0];
    const moveSlide = (direction: number) =>
        setSlideIndex(
            (current) => (current + direction + slides.length) % slides.length,
        );

    return (
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
            <section className="pb-6 pt-4 sm:py-7">
                <div
                    className="group relative min-h-[540px] overflow-hidden rounded-[28px] border border-border/70 bg-muted shadow-[0_26px_80px_-45px_rgba(15,23,42,.5)] sm:min-h-[610px] sm:rounded-[34px]"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                >
                    <div className="absolute inset-0">
                        <img
                            key={activeSlide.id}
                            src={activeSlide.backgroundImage}
                            alt=""
                            className="size-full animate-[fade-in_.5s_ease-out] object-cover object-[70%_center] rtl:object-[30%_center]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/10 dark:from-[#050b16] dark:via-[#050b16]/96 dark:to-[#050b16]/20 rtl:bg-gradient-to-l" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,hsl(var(--primary)/.12),transparent_35%)] rtl:bg-[radial-gradient(circle_at_85%_20%,hsl(var(--primary)/.12),transparent_35%)]" />
                    </div>

                    <div className="relative grid min-h-[540px] items-center sm:min-h-[610px] lg:grid-cols-[minmax(0,1fr)_minmax(350px,.65fr)]">
                        <div className="max-w-3xl px-6 py-16 sm:px-10 lg:px-16">
                            {content.isLoading ? (
                                <HeroSkeleton />
                            ) : (
                                <>
                                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary shadow-sm backdrop-blur-md sm:text-xs">
                                        <PackageCheck className="size-4" />
                                        {activeSlide.eyebrow}
                                    </div>
                                    <h1 className="mt-6 max-w-2xl text-4xl font-black leading-[1.03] tracking-[-0.05em] sm:text-5xl lg:text-7xl">
                                        {activeSlide.title}
                                    </h1>
                                    <p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
                                        {activeSlide.description}
                                    </p>
                                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                        <Button
                                            asChild
                                            size="lg"
                                            className="h-12 rounded-xl px-7 font-bold shadow-lg shadow-primary/20"
                                        >
                                            <Link to={activeSlide.primaryUrl}>
                                                {activeSlide.primaryText}
                                                <ArrowRight className="size-4 rtl:rotate-180" />
                                            </Link>
                                        </Button>
                                        {activeSlide.secondaryText &&
                                        activeSlide.secondaryUrl ? (
                                            <Button
                                                asChild
                                                size="lg"
                                                variant="outline"
                                                className="h-12 rounded-xl border-border/80 bg-background/80 px-7 font-bold shadow-sm backdrop-blur"
                                            >
                                                <Link to={activeSlide.secondaryUrl}>
                                                    {activeSlide.secondaryText}
                                                </Link>
                                            </Button>
                                        ) : null}
                                    </div>
                                </>
                            )}

                            <div className="mt-9 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
                                {[
                                    [Truck, t("home.fastDelivery"), t("home.safeReliable")],
                                    [RotateCcw, t("home.easyReturns"), t("home.simplePolicy")],
                                    [ShieldCheck, t("home.secureShopping"), t("home.protectedCheckout")],
                                ].map(([Icon, title, description]) => {
                                    const FeatureIcon = Icon as typeof Truck;
                                    return (
                                        <div
                                            key={String(title)}
                                            className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border/70 bg-background/80 p-2.5 text-center shadow-sm backdrop-blur-md sm:flex-row sm:p-3 sm:text-start"
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

                        {activeSlide.product ? (
                            <div className="absolute bottom-20 end-6 h-[33%] w-[42%] sm:bottom-12 sm:end-10 sm:h-[52%] sm:w-[34%] lg:static lg:me-12 lg:h-[430px] lg:w-auto">
                                <Link
                                    to={productPath(activeSlide.product)}
                                    className="relative flex size-full items-center justify-center overflow-hidden rounded-[30px] border border-white/60 bg-white/95 p-4 shadow-[0_35px_80px_-20px_rgba(15,23,42,.35)] transition hover:-translate-y-1 dark:border-white/10 dark:bg-slate-950/90 sm:p-8"
                                >
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,hsl(var(--primary)/.14),transparent_60%)]" />
                                    <img
                                        src={
                                            imageUrl(
                                                activeSlide.product.primaryImageUrl,
                                            ) ?? "/placeholder-product.svg"
                                        }
                                        alt={activeSlide.product.name}
                                        className="relative z-10 size-full object-contain drop-shadow-2xl"
                                    />
                                    <span className="absolute bottom-4 start-4 rounded-full bg-primary px-3 py-1.5 text-xs font-black text-primary-foreground shadow-lg">
                                        {activeSlide.product.price != null
                                            ? formatMoney(activeSlide.product.price)
                                            : t("product.noPrice")}
                                    </span>
                                </Link>
                            </div>
                        ) : null}
                    </div>

                    {slides.length > 1 ? (
                        <>
                            <button
                                type="button"
                                onClick={() => moveSlide(-1)}
                                className="absolute bottom-5 end-16 z-20 grid size-10 place-items-center rounded-xl border bg-background/85 text-foreground shadow-lg backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
                                aria-label={t("home.previousSlide")}
                            >
                                <ArrowLeft className="size-4 rtl:rotate-180" />
                            </button>
                            <button
                                type="button"
                                onClick={() => moveSlide(1)}
                                className="absolute bottom-5 end-5 z-20 grid size-10 place-items-center rounded-xl border bg-background/85 text-foreground shadow-lg backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
                                aria-label={t("home.nextSlide")}
                            >
                                <ArrowRight className="size-4 rtl:rotate-180" />
                            </button>
                            <div className="absolute bottom-6 start-6 z-20 flex gap-1.5 sm:start-10">
                                {slides.map((slide, index) => (
                                    <button
                                        key={slide.id}
                                        type="button"
                                        onClick={() => setSlideIndex(index)}
                                        className={`h-2 rounded-full transition-all ${
                                            index === slideIndex
                                                ? "w-8 bg-primary"
                                                : "w-2 bg-foreground/25 hover:bg-foreground/45"
                                        }`}
                                        aria-label={t("home.goToSlide", {
                                            number: index + 1,
                                        })}
                                    />
                                ))}
                            </div>
                        </>
                    ) : null}
                </div>
            </section>

            <section id="categories" className="scroll-mt-40 py-10 sm:py-16">
                <Heading
                    icon={<ShoppingBag className="size-4" />}
                    eyebrow={t("home.browseCollection")}
                    title={t("home.shopByCategory")}
                    description={t("home.categoryDescription")}
                    to="/products"
                />
                {lookups.isLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} className="h-[280px] rounded-[26px]" />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {categoryTree.slice(0, 8).map((category) => (
                            <CategoryShowcaseCard
                                key={category.id}
                                category={category}
                            />
                        ))}
                    </div>
                )}
            </section>

            <section id="deals" className="scroll-mt-40 py-8 sm:py-14">
                <div className="grid gap-4 lg:grid-cols-[1.5fr_.75fr]">
                    <div className="relative min-h-[360px] overflow-hidden rounded-[30px] bg-gradient-to-br from-primary via-primary to-[#162d69] p-7 text-primary-foreground shadow-[0_30px_80px_-40px_hsl(var(--primary))] sm:p-10">
                        <div className="absolute -end-20 -top-24 size-72 rounded-full border border-white/10 bg-white/5" />
                        <div className="relative z-10 max-w-lg">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em]">
                                <BadgePercent className="size-4" />
                                {t("home.featuredCatalog")}
                            </div>
                            <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl lg:text-5xl">
                                {t("home.selectedForYou")}
                            </h2>
                            <p className="mt-4 max-w-md text-sm leading-7 text-primary-foreground/75 sm:text-base">
                                {t("home.selectedDescription")}
                            </p>
                            <Button
                                asChild
                                variant="orange"
                                size="lg"
                                className="mt-7 h-12 rounded-xl px-6 font-bold shadow-lg"
                            >
                                <Link to={deal ? productPath(deal) : "/products"}>
                                    {t("home.viewProduct")}
                                    <ArrowRight className="size-4 rtl:rotate-180" />
                                </Link>
                            </Button>
                        </div>
                        {deal ? (
                            <div className="absolute bottom-4 end-4 h-[42%] w-[50%] sm:bottom-8 sm:end-8 sm:h-[78%] sm:w-[40%]">
                                <div className="relative flex size-full items-center justify-center overflow-hidden rounded-[28px] border border-white/30 bg-white/95 p-4 shadow-[0_28px_70px_rgba(15,23,42,.28)] dark:bg-slate-950/90 sm:rounded-[36px] sm:p-7">
                                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,hsl(var(--primary)/.12),transparent_58%)]" />
                                    <div className="pointer-events-none absolute inset-x-8 bottom-4 h-8 rounded-full bg-slate-950/12 blur-xl" />
                                    <img
                                        src={
                                            imageUrl(deal.primaryImageUrl) ??
                                            "/placeholder-product.svg"
                                        }
                                        alt={deal.name}
                                        className="relative z-10 size-full object-contain drop-shadow-xl transition-transform duration-500 hover:scale-[1.03]"
                                    />
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-1">
                        <Promo
                            icon={<Sparkles className="size-5" />}
                            label={t("home.newArrivals")}
                            title={t("home.freshProducts")}
                            description={t("home.freshDescription")}
                            className="from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/20"
                        />
                        <Promo
                            icon={<Truck className="size-5" />}
                            label={t("home.freeDelivery")}
                            title={
                                content.data?.shippingEnabled === false
                                    ? t("home.everyOrderFree")
                                    : (content.data?.freeShippingThreshold ?? 0) > 0
                                      ? t("home.qualifyingOrders", {
                                            amount: formatMoney(
                                                content.data!
                                                    .freeShippingThreshold,
                                            ),
                                        })
                                      : t("home.flatDelivery", {
                                            amount: formatMoney(
                                                content.data?.flatShippingFee ?? 0,
                                            ),
                                        })
                            }
                            description={t("home.deliveryDescription")}
                            className="from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/20"
                        />
                    </div>
                </div>
            </section>

            <section id="products" className="py-12 sm:py-20">
                <Heading
                    icon={<Star className="size-4" />}
                    eyebrow={t("home.featuredProducts")}
                    title={t("home.justForYou")}
                    description={t("home.justForYouDescription")}
                    to="/products"
                />
                {products.isError ? (
                    <div className="rounded-[26px] border border-dashed bg-muted/20 px-6 py-14 text-center">
                        <ShoppingBag className="mx-auto size-7 text-muted-foreground" />
                        <h3 className="mt-5 text-lg font-bold">
                            {t("home.productsUnavailable")}
                        </h3>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                            {t("home.productsUnavailableDescription")}
                        </p>
                    </div>
                ) : products.isLoading ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
                        {Array.from({ length: 10 }).map((_, index) => (
                            <Skeleton
                                key={index}
                                className="h-[190px] rounded-2xl sm:h-[430px]"
                            />
                        ))}
                    </div>
                ) : (
                    <ProductGrid products={items.slice(0, 10)} />
                )}
            </section>
        </div>
    );
}

function CategoryShowcaseCard({ category }: { category: CategoryNode }) {
    const { t } = useI18n();
    const hasChildren = category.children.length > 0;
    const products = useQuery({
        queryKey: ["home-category-products", category.id],
        queryFn: () =>
            getProducts({
                page: 1,
                pageSize: 3,
                categoryId: category.id,
                isActive: true,
                sortBy: "createdAt",
                sortDescending: true,
            }),
        enabled: !hasChildren,
        staleTime: 5 * 60_000,
    });

    return (
        <article className="group relative min-h-[280px] overflow-hidden rounded-[26px] border border-border/70 bg-card p-5 shadow-[0_14px_45px_-32px_rgba(15,23,42,.45)] transition duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_24px_65px_-34px_rgba(15,23,42,.5)] dark:shadow-black/25">
            <div className="absolute -end-12 -top-12 size-40 rounded-full bg-primary/8 blur-2xl" />
            <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                        {hasChildren
                            ? t("home.subcategories")
                            : t("home.categoryProducts")}
                    </p>
                    <h3 className="mt-2 truncate text-xl font-black tracking-[-0.025em]">
                        {category.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {category.productCount} {t("common.products")}
                    </p>
                </div>
                <Link
                    to={`/products?categoryId=${category.id}`}
                    className="grid size-10 shrink-0 place-items-center rounded-xl border bg-background text-primary shadow-sm transition group-hover:border-primary/30 group-hover:bg-primary group-hover:text-primary-foreground"
                    aria-label={t("home.openCategory", {
                        category: category.name,
                    })}
                >
                    <ArrowRight className="size-4 rtl:rotate-180" />
                </Link>
            </div>

            {hasChildren ? (
                <div className="relative mt-6 grid grid-cols-2 gap-2.5">
                    {category.children.slice(0, 4).map((child) => (
                        <Link
                            key={child.id}
                            to={`/products?categoryId=${child.id}`}
                            className="flex min-w-0 items-center gap-3 rounded-2xl border bg-background/75 p-2.5 transition hover:border-primary/30 hover:bg-primary/5"
                        >
                            <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
                                {child.imageUrl ? (
                                    <img
                                        src={imageUrl(child.imageUrl) ?? ""}
                                        alt=""
                                        className="size-full object-contain p-1.5"
                                    />
                                ) : (
                                    <ShoppingBag className="size-4 text-primary" />
                                )}
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-bold">
                                    {child.name}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                    {child.productCount} {t("common.products")}
                                </span>
                            </span>
                        </Link>
                    ))}
                </div>
            ) : products.isLoading ? (
                <div className="mt-6 grid gap-2.5">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-[58px] rounded-2xl" />
                    ))}
                </div>
            ) : (products.data?.items.length ?? 0) > 0 ? (
                <div className="relative mt-6 grid gap-2.5">
                    {products.data!.items.map((product) => (
                        <Link
                            key={product.id}
                            to={productPath(product)}
                            className="flex min-w-0 items-center gap-3 rounded-2xl border bg-background/75 p-2 transition hover:border-primary/30 hover:bg-primary/5"
                        >
                            <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1.5 dark:bg-slate-950">
                                <img
                                    src={
                                        imageUrl(product.primaryImageUrl) ??
                                        "/placeholder-product.svg"
                                    }
                                    alt=""
                                    className="size-full object-contain"
                                />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold">
                                    {product.name}
                                </span>
                                <span className="mt-0.5 block text-xs font-black text-primary">
                                    {product.price != null
                                        ? formatMoney(product.price)
                                        : t("product.noPrice")}
                                </span>
                            </span>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="relative mt-6 rounded-2xl border border-dashed p-5 text-center">
                    <p className="text-sm font-bold">
                        {t("home.noCategoryProducts")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("home.noCategoryProductsHelp")}
                    </p>
                </div>
            )}
        </article>
    );
}

function ProductGrid({ products }: { products: Product[] }) {
    return (
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
            {products.map((product) => (
                <ProductCard key={product.id} product={product} />
            ))}
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
    icon: ReactNode;
    eyebrow: string;
    title: string;
    description: string;
    to: string;
}) {
    const { t } = useI18n();
    return (
        <div className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-primary">
                    {icon}
                    {eyebrow}
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
                    {title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {description}
                </p>
            </div>
            <Button asChild variant="outline" className="w-fit rounded-xl">
                <Link to={to}>
                    {t("common.viewAll")}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                </Link>
            </Button>
        </div>
    );
}

function Promo({
    icon,
    label,
    title,
    description,
    className,
}: {
    icon: ReactNode;
    label: string;
    title: string;
    description: string;
    className: string;
}) {
    return (
        <article
            className={`relative overflow-hidden rounded-[26px] border bg-gradient-to-br p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,.5)] sm:p-7 ${className}`}
        >
            <div className="absolute -end-10 -top-10 size-32 rounded-full bg-white/25 blur-xl" />
            <span className="relative grid size-11 place-items-center rounded-2xl bg-background/80 text-primary shadow-sm backdrop-blur">
                {icon}
            </span>
            <p className="relative mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                {label}
            </p>
            <h3 className="relative mt-2 text-lg font-black leading-snug tracking-[-0.025em] sm:text-xl">
                {title}
            </h3>
            <p className="relative mt-3 text-xs leading-6 text-muted-foreground sm:text-sm">
                {description}
            </p>
        </article>
    );
}

function HeroSkeleton() {
    return (
        <div className="max-w-xl space-y-5">
            <Skeleton className="h-8 w-44 rounded-full" />
            <Skeleton className="h-16 w-full max-w-lg rounded-2xl" />
            <Skeleton className="h-24 w-full max-w-xl rounded-2xl" />
            <div className="flex gap-3">
                <Skeleton className="h-12 w-36 rounded-xl" />
                <Skeleton className="h-12 w-36 rounded-xl" />
            </div>
        </div>
    );
}
