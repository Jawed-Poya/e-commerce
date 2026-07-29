import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    BadgePercent,
    BellRing,
    Clock3,
    FileText,
    Headphones,
    HeartPulse,
    MapPin,
    PackageCheck,
    RotateCcw,
    ShieldCheck,
    ShoppingBag,
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
import { PrescriptionRequestCard } from "../prescriptions/prescription-request-card";
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

const trustItems = [
    { icon: ShieldCheck, title: "home.authenticProducts", description: "home.authenticDescription" },
    { icon: BadgeCheck, title: "home.securePayment", description: "home.securePaymentDescription" },
    { icon: Truck, title: "home.onTimeDelivery", description: "home.onTimeDeliveryDescription" },
    { icon: RotateCcw, title: "home.easyReturns", description: "home.simplePolicy" },
] as const;

const healthTips = [
    { icon: HeartPulse, title: "home.tipWellnessTitle", description: "home.tipWellnessDescription" },
    { icon: Clock3, title: "home.tipRoutineTitle", description: "home.tipRoutineDescription" },
    { icon: BellRing, title: "home.tipRefillTitle", description: "home.tipRefillDescription" },
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
        pageSize: 18,
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
    const featured = items.filter((item) => item.isFeatured).slice(0, 6);
    const featuredProducts = featured.length >= 4 ? featured : items.slice(0, 8);
    const categoryTree = buildCategoryTree(lookups.data?.categories ?? []);
    const hero = content.data ? localizedHero(content.data, language) : null;
    const saleItems = items.filter(
        (item) => item.price != null && item.oldPrice != null && item.oldPrice > item.price,
    );
    const deal = saleItems[0] ?? items.find((item) => item.stock > 0) ?? items[0];

    const slides = useMemo<HeroSlide[]>(() => {
        const result: HeroSlide[] = [
            {
                id: "configured-hero",
                eyebrow: hero?.eyebrow ?? t("home.healthPriority"),
                title: hero?.title ?? t("home.heroFallbackTitle"),
                description: hero?.description ?? t("home.heroFallbackDescription"),
                primaryText: hero?.primaryButtonText ?? t("common.shopNow"),
                primaryUrl: content.data?.primaryButtonUrl ?? "/products",
                secondaryText: hero?.secondaryButtonText ?? t("prescription.uploadPrescription"),
                secondaryUrl: content.data?.secondaryButtonUrl ?? "/#prescription",
                backgroundImage: imageUrl(content.data?.heroImageUrl) ?? fallbackHeroImage,
            },
        ];

        items
            .filter((item) => item.isFeatured && item.primaryImageUrl)
            .slice(0, 3)
            .forEach((product) => {
                result.push({
                    id: `product-${product.id}`,
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

        return result;
    }, [content.data, hero, items, t]);

    useEffect(() => {
        setSlideIndex((current) => Math.min(current, Math.max(0, slides.length - 1)));
    }, [slides.length]);

    useEffect(() => {
        if (paused || slides.length < 2) return;
        const timer = window.setInterval(
            () => setSlideIndex((current) => (current + 1) % slides.length),
            6500,
        );
        return () => window.clearInterval(timer);
    }, [paused, slides.length]);

    const activeSlide = slides[slideIndex] ?? slides[0];
    const moveSlide = (direction: number) => {
        setSlideIndex(
            (current) => (current + direction + slides.length) % slides.length,
        );
    };

    return (
        <div className="mx-auto w-full max-w-[1540px] px-3 pb-4 sm:px-5 lg:px-7">
            <section className="pt-3 sm:pt-5">
                <div
                    className="group relative overflow-hidden rounded-[26px] border border-border/80 bg-card shadow-[0_26px_80px_-48px_rgba(15,23,42,.5)] dark:border-white/12"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                >
                    <div className="absolute inset-0">
                        <img
                            key={activeSlide.id}
                            src={activeSlide.backgroundImage}
                            alt=""
                            className="hero-media-enter size-full object-cover object-[72%_center] rtl:object-[28%_center]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/96 to-white/25 dark:from-[#06111e] dark:via-[#06111e]/96 dark:to-[#06111e]/35 rtl:bg-gradient-to-l" />
                        <div className="absolute -start-20 -top-28 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
                    </div>

                    <div className="relative grid min-h-[450px] items-center lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
                        <div className="max-w-3xl px-6 py-12 sm:px-10 sm:py-14 lg:px-14">
                            {content.isLoading ? (
                                <HeroSkeleton />
                            ) : (
                                <div key={activeSlide.id} className="hero-copy-enter">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary shadow-sm backdrop-blur sm:text-xs">
                                        <ShieldCheck className="size-4" />
                                        {activeSlide.eyebrow}
                                    </div>
                                    <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.04] tracking-[-0.05em] sm:text-5xl lg:text-[64px]">
                                        {activeSlide.title}
                                    </h1>
                                    <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                                        {activeSlide.description}
                                    </p>
                                    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                                        <Button
                                            asChild
                                            size="lg"
                                            className="h-12 rounded-xl px-7 font-bold shadow-lg shadow-primary/20"
                                        >
                                            <Link viewTransition to={activeSlide.primaryUrl}>
                                                {activeSlide.primaryText}
                                                <ArrowRight className="size-4 rtl:rotate-180" />
                                            </Link>
                                        </Button>
                                        {activeSlide.secondaryText && activeSlide.secondaryUrl ? (
                                            <Button
                                                asChild
                                                size="lg"
                                                variant="outline"
                                                className="h-12 rounded-xl border-border/90 bg-background/85 px-7 font-bold shadow-sm backdrop-blur dark:border-white/15"
                                            >
                                                <Link viewTransition to={activeSlide.secondaryUrl}>
                                                    <FileText className="size-4" />
                                                    {activeSlide.secondaryText}
                                                </Link>
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-xs font-semibold text-muted-foreground">
                                <HeroPromise icon={<BadgeCheck />} text={t("home.authenticProducts")} />
                                <HeroPromise icon={<Truck />} text={t("home.fastDelivery")} />
                                <HeroPromise icon={<ShieldCheck />} text={t("home.secureShopping")} />
                            </div>
                        </div>

                        <div className="relative hidden h-full min-h-[450px] items-center justify-center p-8 lg:flex">
                            {activeSlide.product ? (
                                <Link
                                    viewTransition
                                    key={activeSlide.product.id}
                                    to={productPath(activeSlide.product)}
                                    className="hero-product-enter relative flex h-[340px] w-full max-w-[390px] items-center justify-center overflow-hidden rounded-[34px] border border-white/70 bg-white/92 p-8 shadow-[0_30px_75px_-24px_rgba(15,23,42,.38)] backdrop-blur dark:border-white/12 dark:bg-slate-950/88"
                                >
                                    <div className="absolute inset-[18%] rounded-full bg-primary/15 blur-3xl" />
                                    <img
                                        src={imageUrl(activeSlide.product.primaryImageUrl) ?? "/placeholder-product.svg"}
                                        alt={activeSlide.product.name}
                                        className="relative z-10 size-full object-contain drop-shadow-2xl"
                                    />
                                    <span className="absolute bottom-5 start-5 rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow-lg">
                                        {activeSlide.product.price == null
                                            ? t("product.noPrice")
                                            : formatMoney(activeSlide.product.price)}
                                    </span>
                                </Link>
                            ) : (
                                <div className="grid w-full max-w-[360px] gap-3">
                                    {trustItems.map(({ icon: Icon, title, description }) => (
                                        <div
                                            key={title}
                                            className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/80 p-3.5 shadow-sm backdrop-blur dark:border-white/12"
                                        >
                                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                                <Icon className="size-5" />
                                            </span>
                                            <span>
                                                <span className="block text-sm font-black">{t(title)}</span>
                                                <span className="mt-0.5 block text-[11px] text-muted-foreground">{t(description)}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {slides.length > 1 ? (
                        <div className="absolute bottom-4 end-4 z-20 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => moveSlide(-1)}
                                className="grid size-9 place-items-center rounded-xl border border-border/80 bg-background/85 text-foreground shadow-md backdrop-blur transition hover:bg-primary hover:text-primary-foreground dark:border-white/12"
                                aria-label={t("home.previousSlide")}
                            >
                                <ArrowLeft className="size-4 rtl:rotate-180" />
                            </button>
                            <div className="flex gap-1.5 rounded-xl border border-border/70 bg-background/80 px-2.5 py-2 shadow-md backdrop-blur dark:border-white/12">
                                {slides.map((slide, index) => (
                                    <button
                                        key={slide.id}
                                        type="button"
                                        onClick={() => setSlideIndex(index)}
                                        className={cn(
                                            "relative h-1.5 overflow-hidden rounded-full transition-all",
                                            index === slideIndex
                                                ? "w-9 bg-primary/20"
                                                : "w-1.5 bg-foreground/25 hover:bg-foreground/45",
                                        )}
                                        aria-label={t("home.goToSlide", { number: index + 1 })}
                                    >
                                        {index === slideIndex ? (
                                            <span
                                                className="hero-progress absolute inset-y-0 start-0 bg-primary"
                                                style={{ animationPlayState: paused ? "paused" : "running" }}
                                            />
                                        ) : null}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => moveSlide(1)}
                                className="grid size-9 place-items-center rounded-xl border border-border/80 bg-background/85 text-foreground shadow-md backdrop-blur transition hover:bg-primary hover:text-primary-foreground dark:border-white/12"
                                aria-label={t("home.nextSlide")}
                            >
                                <ArrowRight className="size-4 rtl:rotate-180" />
                            </button>
                        </div>
                    ) : null}
                </div>
            </section>

            <section id="categories" className="scroll-mt-40 py-5 sm:py-7">
                <SectionHeading
                    title={t("home.shopByCategory")}
                    description={t("home.categoryDescription")}
                    to="/products"
                />
                {lookups.isLoading ? (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <Skeleton key={index} className="h-40 rounded-[20px]" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
                        {categoryTree.slice(0, 8).map((category) => (
                            <CategoryTile key={category.id} category={category} />
                        ))}
                    </div>
                )}
            </section>

            <section id="products" className="grid scroll-mt-40 gap-4 py-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(340px,.72fr)]">
                <div className="rounded-[26px] border border-border/80 bg-card p-4 shadow-[0_18px_55px_-44px_rgba(15,23,42,.5)] dark:border-white/12 sm:p-5">
                    <SectionHeading
                        compact
                        title={t("home.featuredProducts")}
                        description={t("home.justForYouDescription")}
                        to="/products?featured=true"
                    />
                    {products.isLoading ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <Skeleton key={index} className="h-[420px] rounded-[20px]" />
                            ))}
                        </div>
                    ) : products.isError ? (
                        <EmptyPanel
                            icon={<ShoppingBag className="size-6" />}
                            title={t("home.productsUnavailable")}
                            description={t("home.productsUnavailableDescription")}
                        />
                    ) : (
                        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {featuredProducts.slice(0, 6).map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    )}
                </div>

                <div id="prescription" className="scroll-mt-40">
                    <PrescriptionRequestCard compact />
                </div>
            </section>

            <section className="py-4">
                <div className="grid gap-3 rounded-[24px] border border-primary/15 bg-primary/[0.045] p-4 dark:border-primary/25 dark:bg-primary/[0.07] sm:grid-cols-2 lg:grid-cols-5">
                    <TrustMetric icon={<PackageCheck />} value={t("home.largeCatalog")} label={t("home.catalogUpdated")} />
                    <TrustMetric icon={<Star />} value={t("home.customerFocused")} label={t("home.clearProductDetails")} />
                    <TrustMetric icon={<ShieldCheck />} value={t("home.secureCheckout")} label={t("home.protectedPayments")} />
                    <TrustMetric icon={<Truck />} value={t("home.reliableDelivery")} label={t("home.deliveryTracking")} />
                    <TrustMetric icon={<RotateCcw />} value={t("home.easyReturns")} label={t("home.simplePolicy")} />
                </div>
            </section>

            <section id="deals" className="scroll-mt-40 py-5 sm:py-7">
                <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
                    <div className="relative min-h-[360px] overflow-hidden rounded-[28px] border border-primary/20 bg-gradient-to-br from-primary via-primary to-[#0e6f6d] p-7 text-primary-foreground shadow-2xl shadow-primary/20 sm:p-9">
                        <div className="absolute -end-24 -top-24 size-80 rounded-full border border-white/10 bg-white/5" />
                        <div className="relative z-10 max-w-[55%] sm:max-w-[52%]">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]">
                                <BadgePercent className="size-4" />
                                {t("home.featuredCatalog")}
                            </div>
                            <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl">
                                {t("home.selectedForYou")}
                            </h2>
                            <p className="mt-4 text-sm leading-7 text-primary-foreground/75">
                                {t("home.selectedDescription")}
                            </p>
                            <Button
                                asChild
                                variant="orange"
                                className="mt-6 h-11 rounded-xl px-5 font-bold"
                            >
                                <Link viewTransition to={deal ? productPath(deal) : "/products"}>
                                    {t("home.viewProduct")}
                                    <ArrowRight className="size-4 rtl:rotate-180" />
                                </Link>
                            </Button>
                        </div>
                        {deal ? (
                            <Link
                                viewTransition
                                to={productPath(deal)}
                                className="absolute bottom-5 end-5 flex h-[72%] w-[42%] items-center justify-center overflow-hidden rounded-[26px] border border-white/30 bg-white/95 p-5 shadow-[0_28px_70px_rgba(15,23,42,.28)] dark:bg-slate-950/90"
                            >
                                <div className="absolute inset-[16%] rounded-full bg-primary/10 blur-3xl" />
                                <img
                                    src={imageUrl(deal.primaryImageUrl) ?? "/placeholder-product.svg"}
                                    alt={deal.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="relative z-10 size-full object-contain drop-shadow-xl transition duration-500 hover:scale-[1.04]"
                                />
                            </Link>
                        ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                        <InfoCard
                            icon={<Headphones />}
                            eyebrow={t("home.customerSupport")}
                            title={t("home.needHelpChoosing")}
                            description={t("home.supportDescription")}
                            action={
                                company?.phone ? (
                                    <a href={`tel:${company.phone}`}>{company.phone}</a>
                                ) : company?.email ? (
                                    <a href={`mailto:${company.email}`}>{company.email}</a>
                                ) : (
                                    <Link viewTransition to="/account/login">{t("common.account")}</Link>
                                )
                            }
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

            <section className="py-5 sm:py-8">
                <SectionHeading
                    title={t("home.healthTips")}
                    description={t("home.healthTipsDescription")}
                    to="/products"
                />
                <div className="grid gap-3 md:grid-cols-3">
                    {healthTips.map(({ icon: Icon, title, description }, index) => (
                        <article
                            key={title}
                            className="group relative overflow-hidden rounded-[22px] border border-border/80 bg-card p-5 shadow-[0_15px_45px_-38px_rgba(15,23,42,.5)] transition hover:-translate-y-1 hover:border-primary/30 dark:border-white/12"
                        >
                            <div className="absolute -end-10 -top-10 size-32 rounded-full bg-primary/8 blur-2xl transition group-hover:bg-primary/15" />
                            <span className="relative grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                                <Icon className="size-5" />
                            </span>
                            <p className="relative mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                                {t("home.healthTipNumber", { number: index + 1 })}
                            </p>
                            <h3 className="relative mt-2 text-lg font-black tracking-[-0.025em]">
                                {t(title)}
                            </h3>
                            <p className="relative mt-3 text-sm leading-6 text-muted-foreground">
                                {t(description)}
                            </p>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}

function HeroPromise({ icon, text }: { icon: ReactNode; text: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className="text-primary [&>svg]:size-4">{icon}</span>
            {text}
        </span>
    );
}

function CategoryTile({ category }: { category: CategoryNode }) {
    const { t } = useI18n();
    return (
        <Link
            viewTransition
            to={`/products?categoryId=${category.id}`}
            className="group relative flex min-h-[152px] flex-col overflow-hidden rounded-[20px] border border-border/80 bg-card p-3 shadow-[0_12px_36px_-32px_rgba(15,23,42,.6)] transition duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_22px_48px_-32px_rgba(15,23,42,.65)] dark:border-white/12"
        >
            <span className="absolute -end-8 -top-8 size-24 rounded-full bg-primary/8 blur-2xl transition group-hover:bg-primary/16" />
            <span className="relative flex min-h-20 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-muted/50 via-background to-primary/[0.06] p-2 dark:from-slate-950 dark:via-slate-950 dark:to-primary/10">
                {category.imageUrl ? (
                    <img
                        src={imageUrl(category.imageUrl) ?? ""}
                        alt={category.name}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-contain drop-shadow-sm transition duration-500 group-hover:scale-[1.07]"
                    />
                ) : (
                    <ShoppingBag className="size-8 text-primary" />
                )}
            </span>
            <span className="relative mt-3 line-clamp-2 text-sm font-black leading-5">
                {category.name}
            </span>
            <span className="relative mt-1 text-[10px] font-semibold text-muted-foreground">
                {t("home.productCount", { count: category.productCount })}
            </span>
        </Link>
    );
}

function SectionHeading({
    title,
    description,
    to,
    compact = false,
}: {
    title: string;
    description: string;
    to: string;
    compact?: boolean;
}) {
    const { t } = useI18n();
    return (
        <div className={cn("flex items-end justify-between gap-4", compact ? "mb-4" : "mb-5")}>
            <div className="min-w-0">
                <h2 className={cn("font-black tracking-[-0.04em]", compact ? "text-2xl" : "text-2xl sm:text-3xl")}>
                    {title}
                </h2>
                <p className="mt-1.5 max-w-2xl text-xs leading-6 text-muted-foreground sm:text-sm">
                    {description}
                </p>
            </div>
            <Link
                viewTransition
                to={to}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-black text-primary transition hover:bg-primary/8"
            >
                {t("common.viewAll")}
                <ArrowRight className="size-3.5 rtl:rotate-180" />
            </Link>
        </div>
    );
}

function TrustMetric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-3 dark:border-white/10">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:size-5">
                {icon}
            </span>
            <span className="min-w-0">
                <span className="block truncate text-xs font-black">{value}</span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{label}</span>
            </span>
        </div>
    );
}

function InfoCard({
    icon,
    eyebrow,
    title,
    description,
    action,
}: {
    icon: ReactNode;
    eyebrow: string;
    title: string;
    description: string;
    action: ReactNode;
}) {
    return (
        <article className="relative overflow-hidden rounded-[24px] border border-border/80 bg-card p-5 shadow-[0_15px_45px_-38px_rgba(15,23,42,.5)] dark:border-white/12">
            <div className="absolute -end-10 -top-10 size-32 rounded-full bg-primary/8 blur-2xl" />
            <span className="relative grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary [&>svg]:size-5">
                {icon}
            </span>
            <p className="relative mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                {eyebrow}
            </p>
            <h3 className="relative mt-2 text-lg font-black tracking-[-0.025em]">{title}</h3>
            <p className="relative mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-black text-primary [&_a]:hover:underline">
                {action}
                <ArrowRight className="size-4 rtl:rotate-180" />
            </div>
        </article>
    );
}

function EmptyPanel({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
    return (
        <div className="rounded-[22px] border border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center dark:border-white/12">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                {icon}
            </span>
            <h3 className="mt-4 text-lg font-black">{title}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
    );
}

function HeroSkeleton() {
    return (
        <div className="max-w-xl space-y-5">
            <Skeleton className="h-8 w-44 rounded-full" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <div className="flex gap-3">
                <Skeleton className="h-12 w-36 rounded-xl" />
                <Skeleton className="h-12 w-36 rounded-xl" />
            </div>
        </div>
    );
}
