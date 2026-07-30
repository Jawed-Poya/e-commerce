import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    BadgeCheck,
    BadgePercent,
    Boxes,
    Check,
    CircleHelp,
    HeartPulse,
    Mail,
    MapPin,
    PackageCheck,
    Phone,
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
        6,
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
    const primaryBranch =
        company?.branches.find((branch) => branch.isMain && branch.isActive) ??
        company?.branches.find((branch) => branch.isActive);
    const supportValue =
        company?.phone ?? company?.email ?? primaryBranch?.phone ?? null;
    const supportHref = company?.phone
        ? `tel:${company.phone}`
        : company?.email
          ? `mailto:${company.email}`
          : primaryBranch?.phone
            ? `tel:${primaryBranch.phone}`
            : null;

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
            <section className="pt-4 sm:pt-7">
                <article
                    className="relative overflow-hidden rounded-[28px] bg-[#06231e] text-white shadow-[0_28px_80px_-52px_rgba(2,20,16,.85)] ring-1 ring-white/10 dark:bg-[#041713]"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                >
                    <div className="pointer-events-none absolute -start-32 -top-36 size-[420px] rounded-full bg-primary/20 blur-[110px]" />
                    <div className="pointer-events-none absolute -bottom-52 end-1/4 size-[420px] rounded-full bg-cyan-500/10 blur-[120px]" />

                    {content.isLoading ? (
                        <HeroSkeleton />
                    ) : (
                        <div
                            key={activeSlide.id}
                            className="hero-copy-enter relative grid min-h-[570px] md:min-h-[520px] md:grid-cols-[minmax(0,.92fr)_minmax(360px,1.08fr)]"
                        >
                            <div className="relative z-10 flex flex-col justify-center px-6 pb-28 pt-10 sm:px-10 md:px-12 md:pb-24 lg:px-16">
                                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-200 ring-1 ring-white/[0.12] backdrop-blur">
                                    <HeartPulse className="size-3.5" />
                                    {activeSlide.eyebrow}
                                </div>

                                <h1 className="mt-6 max-w-2xl text-[39px] font-black leading-[1.02] tracking-[-0.055em] text-white sm:text-5xl lg:text-[64px]">
                                    {activeSlide.title}
                                </h1>

                                <p className="mt-5 max-w-xl text-sm leading-7 text-white/[0.62] sm:text-base sm:leading-8">
                                    {activeSlide.description}
                                </p>

                                {activeSlide.product?.price != null ? (
                                    <div className="mt-5 flex flex-wrap items-end gap-2">
                                        <span className="text-3xl font-black tracking-[-0.05em] text-white">
                                            {formatMoney(
                                                activeSlide.product.price,
                                            )}
                                        </span>
                                        {activeSlide.product.unitName ? (
                                            <span className="pb-1 text-xs font-semibold text-white/[0.55]">
                                                / {activeSlide.product.unitName}
                                            </span>
                                        ) : null}
                                    </div>
                                ) : null}

                                <div className="mt-7 flex flex-col gap-3 min-[430px]:flex-row min-[430px]:flex-wrap">
                                    <Button
                                        asChild
                                        size="lg"
                                        className="w-full rounded-xl px-6 font-bold shadow-none min-[430px]:w-auto"
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
                                        className="w-full rounded-xl border-white/[0.18] bg-transparent px-6 font-bold text-white hover:bg-white/[0.08] hover:text-white min-[430px]:w-auto dark:border-white/[0.14]"
                                    >
                                        <Link
                                            viewTransition
                                            to={activeSlide.secondaryUrl}
                                        >
                                            {activeSlide.secondaryText}
                                        </Link>
                                    </Button>
                                </div>

                                <div className="mt-7 grid max-w-xl grid-cols-2 gap-x-3 gap-y-3 text-[11px] sm:grid-cols-3">
                                    <TrustPoint
                                        icon={<Check />}
                                        text={t("home.liveAvailability")}
                                        inverse
                                    />
                                    <TrustPoint
                                        icon={<PackageCheck />}
                                        text={t("home.clearUnits")}
                                        inverse
                                    />
                                    <TrustPoint
                                        icon={<ShieldCheck />}
                                        text={t("home.secureShopping")}
                                        className="hidden sm:flex"
                                        inverse
                                    />
                                </div>
                            </div>

                            <div className="relative min-h-[300px] px-5 pb-6 sm:px-8 md:min-h-[520px] md:px-8 md:py-12 lg:px-12">
                                <div className="pointer-events-none absolute inset-x-[14%] bottom-[10%] top-[17%] rounded-[38px] ring-1 ring-white/15 md:inset-x-[11%] md:bottom-[13%] md:top-[13%]" />
                                <div className="pointer-events-none absolute inset-x-[20%] bottom-[16%] top-[11%] rounded-[34px] ring-1 ring-white/[0.08] md:inset-x-[17%] md:bottom-[9%] md:top-[19%]" />

                                <div className="hero-media-enter relative h-full min-h-[290px] overflow-hidden rounded-2xl bg-white/[0.06] shadow-[0_30px_65px_-35px_rgba(0,0,0,.9)] ring-1 ring-white/[0.12] md:min-h-0">
                                    <img
                                        src={activeSlide.image}
                                        alt={activeSlide.title}
                                        className={cn(
                                            "size-full transition duration-700",
                                            activeSlide.product
                                                ? "bg-white/95 object-contain p-8 dark:bg-slate-950/80"
                                                : "object-cover",
                                        )}
                                    />
                                    {!activeSlide.product ? (
                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#031713]/35 via-transparent to-white/5" />
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}

                    {slides.length > 1 ? (
                        <div className="absolute bottom-5 start-5 z-20 flex items-center gap-2 sm:start-8">
                            <button
                                type="button"
                                onClick={() => moveSlide(-1)}
                                aria-label={t("home.previousSlide")}
                                className="grid size-9 place-items-center rounded-full bg-white/[0.055] text-white ring-1 ring-white/[0.16] backdrop-blur transition hover:bg-white/[0.12]"
                            >
                                <ArrowLeft className="size-4 rtl:rotate-180" />
                            </button>
                            <div className="flex items-center gap-1.5 rounded-full bg-white/[0.055] px-2.5 py-2 ring-1 ring-white/[0.14] backdrop-blur">
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
                                                ? "w-7 bg-cyan-300"
                                                : "w-1.5 bg-white/30",
                                        )}
                                    />
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => moveSlide(1)}
                                aria-label={t("home.nextSlide")}
                                className="grid size-9 place-items-center rounded-full bg-white/[0.055] text-white ring-1 ring-white/[0.16] backdrop-blur transition hover:bg-white/[0.12]"
                            >
                                <ArrowRight className="size-4 rtl:rotate-180" />
                            </button>
                        </div>
                    ) : null}
                </article>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Link
                        viewTransition
                        to="/products"
                        className="group flex min-h-40 items-start gap-4 rounded-2xl bg-muted/[0.45] p-5 shadow-[0_14px_32px_-30px_rgba(15,23,42,.5)] ring-1 ring-black/[0.045] transition hover:-translate-y-0.5 hover:bg-muted/[0.65] dark:bg-white/[0.035] dark:ring-white/[0.045]"
                    >
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                            <Boxes className="size-5" />
                        </span>
                        <span className="min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                                {t("home.flexibleUnits")}
                            </span>
                            <span className="mt-2 block text-xl font-black tracking-[-0.03em]">
                                {t("home.unitShoppingTitle")}
                            </span>
                            <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                                {t("home.unitShoppingDescription")}
                            </span>
                            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                                {t("common.viewAll")}
                                <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                            </span>
                        </span>
                    </Link>

                    {supportHref ? (
                        <a
                            href={supportHref}
                            className="group flex min-h-40 items-start gap-4 rounded-2xl bg-muted/[0.45] p-5 shadow-[0_14px_32px_-30px_rgba(15,23,42,.5)] ring-1 ring-black/[0.045] transition hover:-translate-y-0.5 hover:bg-muted/[0.65] dark:bg-white/[0.035] dark:ring-white/[0.045]"
                        >
                            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                {company?.phone || primaryBranch?.phone ? (
                                    <Phone className="size-5" />
                                ) : (
                                    <Mail className="size-5" />
                                )}
                            </span>
                            <span className="min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                                    {t("home.customerSupport")}
                                </span>
                                <span className="mt-2 block text-xl font-black tracking-[-0.03em]">
                                    {t("home.needHelpChoosing")}
                                </span>
                                <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                                    {t("home.supportDescription")}
                                </span>
                                <span className="mt-4 inline-flex max-w-full items-center gap-2 text-xs font-black text-foreground">
                                    <span className="truncate">{supportValue}</span>
                                    <ArrowUpRight className="size-3.5 shrink-0 text-primary" />
                                </span>
                            </span>
                        </a>
                    ) : (
                        <div className="flex min-h-40 items-start gap-4 rounded-2xl bg-muted/[0.45] p-5 ring-1 ring-black/[0.045] dark:bg-white/[0.035] dark:ring-white/[0.045]">
                            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                <CircleHelp className="size-5" />
                            </span>
                            <span>
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                                    {t("home.customerSupport")}
                                </span>
                                <span className="mt-2 block text-xl font-black">
                                    {t("home.needHelpChoosing")}
                                </span>
                                <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                                    {t("home.supportDescription")}
                                </span>
                            </span>
                        </div>
                    )}
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
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <Skeleton
                                key={index}
                                className={cn(
                                    "h-72 rounded-2xl",
                                    index < 2 && "lg:col-span-2 lg:h-80",
                                )}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {categories.map((category, index) => (
                            <CategoryCard
                                key={category.id}
                                category={category}
                                featured={index < 2}
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
                    <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
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
                <div className="grid overflow-hidden rounded-[28px] bg-card shadow-[0_18px_50px_-40px_rgba(15,23,42,.5)] ring-1 ring-black/[0.05] dark:bg-white/[0.03] dark:ring-white/[0.05] lg:grid-cols-[minmax(0,1.35fr)_minmax(330px,.65fr)]">
                    <article className="relative min-h-[520px] overflow-hidden bg-[#071c18] p-6 text-white sm:min-h-[420px] sm:p-9 lg:min-h-[390px]">
                        {spotlightProduct ? (
                            <img
                                src={
                                    imageUrl(
                                        spotlightProduct.primaryImageUrl,
                                    ) ?? "/placeholder-product.svg"
                                }
                                alt={spotlightProduct.name}
                                className="absolute inset-0 size-full object-cover opacity-[0.42]"
                            />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-r from-[#061c17] via-[#061c17]/[0.92] to-[#061c17]/[0.35] rtl:bg-gradient-to-l" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#061c17] via-transparent to-transparent" />

                        <div className="relative z-10 flex h-full max-w-xl flex-col justify-end sm:justify-center">
                            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200 ring-1 ring-white/[0.12]">
                                <BadgePercent className="size-4" />
                                {t("home.limitedOffers")}
                            </span>
                            <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.045em] sm:text-4xl">
                                {spotlightProduct?.name ??
                                    t("home.selectedForYou")}
                            </h2>
                            <p className="mt-4 line-clamp-3 text-sm leading-7 text-white/[0.62]">
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
                                            {formatMoney(
                                                spotlightProduct.price,
                                            )}
                                        </span>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </article>

                    <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-1">
                        <InfoRow
                            icon={<MapPin />}
                            eyebrow={t("home.storeLocations")}
                            title={
                                primaryBranch?.name ??
                                t("home.findNearestBranch")
                            }
                            description={
                                primaryBranch?.address ??
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
                    <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                        {newestProducts.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                )}
            </section>

            <section className="grid gap-3 rounded-2xl bg-muted/35 p-3 sm:grid-cols-2 lg:grid-cols-4 dark:bg-white/[0.025]">
                {serviceItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={item.title}
                            className="flex items-center gap-3 rounded-xl bg-background/[0.75] p-4 shadow-[0_12px_26px_-28px_rgba(15,23,42,.55)] dark:bg-white/[0.035]"
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
    inverse = false,
}: {
    icon: ReactNode;
    text: string;
    className?: string;
    inverse?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex items-center gap-2 font-semibold",
                inverse ? "text-white/[0.62]" : "text-muted-foreground",
                className,
            )}
        >
            <span
                className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full [&>svg]:size-3.5",
                    inverse
                        ? "bg-cyan-300/10 text-cyan-200"
                        : "bg-primary/10 text-primary",
                )}
            >
                {icon}
            </span>
            <span>{text}</span>
        </div>
    );
}

function CategoryCard({
    category,
    featured,
}: {
    category: CategoryNode;
    featured: boolean;
}) {
    const { t } = useI18n();
    const categoryImage = imageUrl(category.imageUrl);
    const categoryMeta = category.children.length
        ? category.children
              .slice(0, 2)
              .map((child) => child.name)
              .join(" · ")
        : `${t("home.productCount", {
              count: category.productCount,
          })} · ${t("home.categoryProducts")}`;

    if (featured) {
        return (
            <Link
                viewTransition
                to={`/products?categoryId=${category.id}`}
                className="group relative min-h-[310px] overflow-hidden rounded-2xl bg-slate-900 shadow-[0_18px_48px_-34px_rgba(15,23,42,.7)] ring-1 ring-black/[0.06] sm:min-h-[330px] lg:col-span-2 dark:ring-white/[0.05]"
            >
                {categoryImage ? (
                    <img
                        src={categoryImage}
                        alt={category.name}
                        className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.045]"
                    />
                ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,color-mix(in_srgb,var(--primary)_38%,transparent),transparent_38%),linear-gradient(135deg,#102820,#071713)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/[0.78] via-black/[0.15] to-black/[0.05]" />
                <span className="absolute end-5 top-5 grid size-11 place-items-center rounded-full bg-white/[0.12] text-white ring-1 ring-white/[0.18] backdrop-blur transition group-hover:bg-white group-hover:text-slate-950">
                    <ArrowUpRight className="size-5" />
                </span>
                <span className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                    <span className="block text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">
                        {category.name}
                    </span>
                    <span className="mt-2 block max-w-md text-xs font-semibold leading-5 text-white/[0.65] sm:text-sm">
                        {categoryMeta}
                    </span>
                </span>
            </Link>
        );
    }

    return (
        <Link
            viewTransition
            to={`/products?categoryId=${category.id}`}
            className="group flex min-h-[310px] flex-col overflow-hidden rounded-2xl bg-muted/[0.38] p-5 shadow-[0_14px_34px_-30px_rgba(15,23,42,.48)] ring-1 ring-black/[0.05] transition duration-300 hover:-translate-y-0.5 hover:bg-muted/[0.58] dark:bg-white/[0.03] dark:ring-white/[0.045]"
        >
            <span className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-foreground shadow-sm ring-1 ring-black/[0.05] transition group-hover:bg-primary group-hover:text-primary-foreground dark:bg-white/[0.055] dark:ring-white/[0.06]">
                    <ArrowUpRight className="size-4" />
                </span>
                <span className="min-w-0 pt-1">
                    <span className="block text-xl font-black tracking-[-0.03em]">
                        {category.name}
                    </span>
                    <span className="mt-2 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                        {categoryMeta}
                    </span>
                </span>
            </span>

            <span className="mt-5 block min-h-0 flex-1 overflow-hidden rounded-xl bg-background/[0.80]">
                {categoryImage ? (
                    <img
                        src={categoryImage}
                        alt={category.name}
                        className="size-full min-h-[170px] object-cover transition duration-700 group-hover:scale-[1.045]"
                    />
                ) : (
                    <span className="grid min-h-[170px] place-items-center bg-gradient-to-br from-primary/[0.12] to-muted text-primary">
                        <ShoppingBag className="size-10" />
                    </span>
                )}
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
                className="hidden shrink-0 rounded-xl border-black/[0.08] bg-transparent font-bold sm:inline-flex dark:border-white/[0.08]"
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
            className="group flex min-h-44 items-start gap-4 rounded-2xl bg-muted/[0.38] p-5 transition hover:bg-muted/[0.58] dark:bg-white/[0.035]"
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
                <span className="mt-2 line-clamp-3 block text-sm leading-6 text-muted-foreground">
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
        <div className="rounded-2xl bg-muted/30 px-6 py-16 text-center ring-1 ring-black/[0.045] dark:bg-white/[0.025] dark:ring-white/[0.045]">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton
                    key={index}
                    className="h-[196px] rounded-2xl sm:h-[410px]"
                />
            ))}
        </div>
    );
}

function HeroSkeleton() {
    return (
        <div className="grid min-h-[570px] items-center gap-8 px-8 py-10 md:min-h-[520px] md:grid-cols-2">
            <div className="space-y-5">
                <Skeleton className="h-8 w-44 rounded-full bg-white/10" />
                <Skeleton className="h-28 w-full rounded-2xl bg-white/10" />
                <Skeleton className="h-20 w-full rounded-2xl bg-white/10" />
                <Skeleton className="h-11 w-48 rounded-xl bg-white/10" />
            </div>
            <Skeleton className="h-[340px] rounded-3xl bg-white/10" />
        </div>
    );
}
