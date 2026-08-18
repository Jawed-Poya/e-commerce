import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
    ArrowUpRight,
    ArrowRight,
    Check,
    ChevronDown,
    ChevronRight,
    Menu,
    ShoppingBag,
    Star,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { cn } from "../../shared/lib/utils";
import { formatDecimal, formatMoney } from "../../shared/lib/money";
import { productPath } from "../../shared/lib/product-path";
import type { Product } from "../../shared/types/product";
import { buildCategoryTree, type CategoryNode } from "./category-tree";
import { getProducts } from "./catalog-api";
import { useLookups } from "./use-catalog";
import { useI18n } from "../../i18n/i18n-provider";

export function CategoryMegaMenu() {
    const { t } = useI18n();
    const lookups = useLookups();
    const categories = lookups.data?.categories ?? [];

    const roots = useMemo(() => buildCategoryTree(categories), [categories]);

    const [activeId, setActiveId] = useState<number>();

    useEffect(() => {
        if (roots.length > 0 && !roots.some((item) => item.id === activeId)) {
            setActiveId(roots[0].id);
        }
    }, [activeId, roots]);

    const active = roots.find((item) => item.id === activeId) ?? roots[0];

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <Button
                    variant="default"
                    className="group h-9 min-w-48 justify-between rounded-lg border border-primary/20 bg-primary px-3.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 data-[state=open]:bg-primary/85"
                >
                    <span className="flex items-center gap-2.5">
                        <span className="grid size-6 place-items-center rounded-md bg-white/12">
                            <Menu className="size-4" />
                        </span>
                        {t("category.browse")}
                    </span>

                    <ChevronDown className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="start"
                    sideOffset={10}
                    collisionPadding={16}
                    className="z-50 w-[min(1020px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/80 bg-background/98 text-foreground shadow-[0_24px_70px_-24px_rgba(15,23,42,0.32)] backdrop-blur-xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                >
                    {lookups.isLoading ? (
                        <CategoryLoading />
                    ) : roots.length === 0 ? (
                        <EmptyCategories />
                    ) : (
                        <div className="grid min-h-[430px] grid-cols-[285px_minmax(0,1fr)]">
                            <aside className="border-r border-border/70 bg-muted/20 p-3 dark:bg-muted/10">
                                <div className="mb-3 px-3 pb-1 pt-2">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                                        {t("category.departments")}
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                        {t("category.choose")}
                                    </p>
                                </div>

                                <div className="grid max-h-[360px] gap-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                                    {roots.map((category) => {
                                        const isActive =
                                            category.id === active?.id;

                                        return (
                                            <button
                                                key={category.id}
                                                type="button"
                                                onMouseEnter={() =>
                                                    setActiveId(category.id)
                                                }
                                                onFocus={() =>
                                                    setActiveId(category.id)
                                                }
                                                onClick={() =>
                                                    setActiveId(category.id)
                                                }
                                                className={cn(
                                                    "group flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                                                    isActive
                                                        ? "border-primary/20 bg-primary/[0.09] text-primary shadow-sm"
                                                        : "border-transparent text-muted-foreground hover:border-primary/15 hover:bg-primary/[0.06] hover:text-foreground",
                                                )}
                                            >
                                                <span className="flex min-w-0 items-center gap-3">
                                                    <CategoryImage
                                                        image={
                                                            category.imageUrl
                                                        }
                                                        active={isActive}
                                                    />

                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm font-semibold">
                                                            {category.name}
                                                        </span>

                                                        <small className="mt-0.5 block font-normal text-muted-foreground">
                                                            {
                                                                category.productCount
                                                            }{" "}
                                                            {category.productCount === 1 ? t("common.product") : t("common.productsLower")}
                                                        </small>
                                                    </span>
                                                </span>

                                                <ChevronRight
                                                    className={cn(
                                                        "size-4 shrink-0 transition-all duration-200",
                                                        isActive
                                                            ? "translate-x-0.5 text-primary"
                                                            : "opacity-35 group-hover:translate-x-0.5 group-hover:opacity-100",
                                                    )}
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            </aside>

                            {active && <ActiveCategory category={active} />}
                        </div>
                    )}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}

function ActiveCategory({ category }: { category: CategoryNode }) {
    const { t } = useI18n();
    const hasChildren = category.children.length > 0;
    const products = useQuery({
        queryKey: ["category-mega-menu-products", category.id],
        queryFn: () =>
            getProducts({
                page: 1,
                pageSize: 8,
                categoryId: category.id,
                isActive: true,
                inStock: true,
                sortBy: "createdAt",
                sortDescending: true,
            }),
        enabled: !hasChildren,
        staleTime: 5 * 60_000,
    });

    return (
        <section className="relative min-w-0 overflow-hidden p-4 lg:p-5">
            <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/8 blur-3xl dark:bg-primary/12" />

            <div className="relative flex items-center justify-between gap-4 border-b border-border/80 pb-4 dark:border-white/10">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/80 bg-white p-2 shadow-sm dark:border-white/12 dark:bg-slate-950">
                        {category.imageUrl ? (
                            <img
                                src={imageUrl(category.imageUrl) ?? ""}
                                alt={category.name}
                                className="size-full object-contain"
                            />
                        ) : (
                            <ShoppingBag className="size-6 text-muted-foreground" />
                        )}
                    </span>

                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-primary">
                            {hasChildren ? t("category.featured") : t("search.products")}
                        </p>
                        <h2 className="mt-1 truncate text-2xl font-black tracking-[-0.03em]">
                            {category.name}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {hasChildren
                                ? t("category.exploreRelated")
                                : t("category.productsInsteadOfSubcategories")}
                        </p>
                    </div>
                </div>

                <DropdownMenu.Item asChild>
                    <Link
                        viewTransition
                        to={`/products?categoryId=${category.id}`}
                        className="group flex shrink-0 items-center gap-2 rounded-xl border border-border/80 bg-background px-4 py-2.5 text-sm font-bold text-primary shadow-sm outline-none transition-all hover:border-primary/30 hover:bg-primary/5 focus:bg-primary/5 dark:border-white/12"
                    >
                        {t("category.viewAll")}
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
                    </Link>
                </DropdownMenu.Item>
            </div>

            {hasChildren ? (
                <div className="relative grid grid-cols-2 gap-3 pt-6 lg:grid-cols-3">
                    {category.children.map((subcategory) => (
                        <DropdownMenu.Item key={subcategory.id} asChild>
                            <Link
                                viewTransition
                                to={`/products?categoryId=${subcategory.id}`}
                                className="group min-w-0 rounded-xl border border-border/75 bg-card/70 p-2.5 outline-none transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm focus:border-primary/30 dark:border-white/10"
                            >
                                <span className="flex items-center gap-3">
                                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/70 bg-white p-1.5 dark:border-white/10 dark:bg-slate-950">
                                        {subcategory.imageUrl ? (
                                            <img src={imageUrl(subcategory.imageUrl) ?? ""} alt="" className="size-full object-contain" />
                                        ) : (
                                            <ShoppingBag className="size-4 text-primary" />
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-bold group-hover:text-primary">{subcategory.name}</span>
                                        <span className="mt-1 block text-[10px] text-muted-foreground">
                                            {subcategory.children.length || subcategory.productCount} {subcategory.children.length ? t("category.subcategories") : t("common.productsLower")}
                                        </span>
                                    </span>
                                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180" />
                                </span>
                            </Link>
                        </DropdownMenu.Item>
                    ))}
                </div>
            ) : products.isLoading ? (
                <div className="grid grid-cols-2 gap-3 pt-6 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <div key={index} className="h-28 animate-pulse rounded-xl border border-border/70 bg-muted/60 dark:border-white/10" />
                    ))}
                </div>
            ) : (products.data?.items.length ?? 0) > 0 ? (
                <div className="relative grid grid-cols-2 gap-3 pt-6 lg:grid-cols-4">
                    {products.data!.items.map((product) => (
                        <MegaMenuProduct key={product.id} product={product} />
                    ))}
                </div>
            ) : (
                <div className="grid min-h-64 place-items-center text-center">
                    <div>
                        <span className="mx-auto grid size-10 place-items-center rounded-xl border border-border/80 bg-muted/50 text-primary dark:border-white/10">
                            <ShoppingBag className="size-5" />
                        </span>
                        <p className="mt-4 font-bold">{t("category.browseName", { name: category.name })}</p>
                        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                            {t("category.noProductsConfigured")}
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
}

function MegaMenuProduct({ product }: { product: Product }) {
    const { t } = useI18n();
    const quantityStep = product.orderQuantityStep > 0 ? product.orderQuantityStep : 1;
    const hasOrderableStock = product.stock >= quantityStep;
    const hasDiscount =
        product.oldPrice != null &&
        product.price != null &&
        product.oldPrice > product.price;
    const discount = hasDiscount
        ? Math.round(
              ((product.oldPrice! - product.price!) / product.oldPrice!) * 100,
          )
        : 0;

    return (
        <DropdownMenu.Item asChild>
            <Link
                viewTransition
                to={productPath(product)}
                className="group relative h-[158px] min-w-0 overflow-hidden rounded-xl border border-border/75 bg-card shadow-[0_12px_30px_-26px_rgba(15,23,42,.6)] outline-none transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_18px_38px_-24px_rgba(15,23,42,.45)] focus:border-primary/30 dark:border-white/[0.07]"
            >
                <span className="absolute inset-0 bg-muted/20" />
                <img
                    src={
                        imageUrl(product.primaryImageUrl) ??
                        "/placeholder-product.svg"
                    }
                    alt={product.name}
                    className="absolute inset-0 z-[1] size-full object-cover object-center transition duration-500 ease-out group-hover:scale-[1.02]"
                />

                <span className="absolute start-2 top-2 z-20 flex max-w-[72%] flex-wrap gap-1">
                    {hasDiscount ? (
                        <span className="rounded-md bg-brand-orange px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">
                            -{discount}%
                        </span>
                    ) : null}
                    {product.isFeatured ? (
                        <span className="rounded-md bg-card/95 px-1.5 py-0.5 text-[9px] font-bold text-foreground shadow-sm ring-1 ring-black/[0.05] backdrop-blur dark:ring-white/[0.08]">
                            {t("product.featured")}
                        </span>
                    ) : null}
                </span>

                <span className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-20 bg-gradient-to-t from-background/55 via-background/10 to-transparent transition duration-300 group-hover:h-32 group-focus-visible:h-32" />

                <span className="absolute inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/95 px-2.5 py-2 shadow-[0_-8px_24px_-20px_rgba(15,23,42,.4)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/90 dark:border-white/[0.08]">
                    <span className="flex min-w-0 items-start justify-between gap-2">
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[8px] font-black uppercase tracking-[0.11em] text-primary/80">
                                {product.categoryName}
                            </span>
                            <span className="mt-0.5 block truncate text-xs font-black tracking-[-0.015em] text-foreground group-hover:text-primary group-focus-visible:text-primary">
                                {product.name}
                            </span>
                        </span>

                        <span className="shrink-0 text-end">
                            <span className="block text-sm font-black tracking-[-0.025em] text-primary">
                                {product.price != null
                                    ? formatMoney(product.price)
                                    : t("product.noPrice")}
                            </span>
                            {hasDiscount ? (
                                <span className="block text-[8px] font-semibold text-muted-foreground line-through decoration-brand-orange decoration-2">
                                    {formatMoney(product.oldPrice!)}
                                </span>
                            ) : null}
                        </span>
                    </span>

                    <span className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity,margin] duration-300 ease-out group-hover:mt-1.5 group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-visible:mt-1.5 group-focus-visible:grid-rows-[1fr] group-focus-visible:opacity-100">
                        <span className="overflow-hidden">
                            <span className="flex items-center justify-between gap-2 border-t border-border/70 pt-1.5 dark:border-white/[0.07]">
                                <span className="flex min-w-0 items-center gap-1.5 text-[8px] font-bold text-muted-foreground">
                                    <span className="inline-flex shrink-0 items-center gap-1">
                                        <Star className="size-2.5 fill-amber-400 text-amber-400" />
                                        {product.reviewCount > 0
                                            ? formatDecimal(product.averageRating)
                                            : "—"}
                                    </span>
                                    <span
                                        className={cn(
                                            "inline-flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5",
                                            hasOrderableStock
                                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                                : "bg-destructive/10 text-destructive",
                                        )}
                                    >
                                        {hasOrderableStock ? (
                                            <Check className="size-2.5" />
                                        ) : null}
                                        <span className="truncate">
                                            {hasOrderableStock
                                                ? t("product.inStock")
                                                : t("product.unavailable")}
                                        </span>
                                    </span>
                                    {product.unitName ? (
                                        <span className="max-w-14 truncate">
                                            {product.unitName}
                                        </span>
                                    ) : null}
                                </span>

                                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
                                    <ArrowUpRight className="size-3.5 rtl:rotate-[-90deg]" />
                                </span>
                            </span>
                        </span>
                    </span>
                </span>
            </Link>
        </DropdownMenu.Item>
    );
}

function CategoryImage({
    image,
    active,
}: {
    image?: string | null;
    active: boolean;
}) {
    return (
        <span
            className={cn(
                "grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted transition-all",
                active && "border-primary/20 bg-primary/10 shadow-sm",
            )}
        >
            {image ? (
                <img
                    src={imageUrl(image) ?? ""}
                    alt=""
                    className="size-full object-contain p-1"
                />
            ) : (
                <ShoppingBag
                    className={cn(
                        "size-4 text-muted-foreground",
                        active && "text-primary",
                    )}
                />
            )}
        </span>
    );
}

function CategoryLoading() {
    const { t } = useI18n();
    return (
        <div className="grid min-h-[420px] place-items-center">
            <div className="text-center">
                <span className="mx-auto grid size-11 place-items-center rounded-xl border bg-primary/10 text-primary shadow-sm">
                    <ShoppingBag className="size-5 animate-pulse" />
                </span>

                <p className="mt-4 text-sm font-bold">{t("category.loading")}</p>

                <p className="mt-1 text-xs text-muted-foreground">
                    {t("category.preparing")}
                </p>
            </div>
        </div>
    );
}

function EmptyCategories() {
    const { t } = useI18n();
    return (
        <div className="grid min-h-72 place-items-center p-8 text-center">
            <div>
                <span className="mx-auto grid size-11 place-items-center rounded-xl border bg-muted/50 text-muted-foreground">
                    <ShoppingBag className="size-6" />
                </span>

                <b className="mt-4 block text-base">{t("category.empty")}</b>

                <small className="mx-auto mt-2 block max-w-xs leading-5 text-muted-foreground">
                    {t("category.emptyHelp")}
                </small>
            </div>
        </div>
    );
}

export function MobileCategoryLinks({
    onNavigate,
}: {
    onNavigate: () => void;
}) {
    const lookups = useLookups();

    const roots = useMemo(
        () => buildCategoryTree(lookups.data?.categories ?? []),
        [lookups.data?.categories],
    );

    if (roots.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-2.5">
            {roots.map((category) => (
                <MobileCategoryBranch
                    key={category.id}
                    category={category}
                    onNavigate={onNavigate}
                />
            ))}
        </div>
    );
}

function MobileCategoryBranch({
    category,
    onNavigate,
}: {
    category: CategoryNode;
    onNavigate: () => void;
}) {
    const { t } = useI18n();
    return (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Link viewTransition
                to={`/products?categoryId=${category.id}`}
                onClick={onNavigate}
                className="group flex items-center justify-between gap-3 px-3 py-3 transition-colors hover:bg-muted/50"
            >
                <span className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border bg-primary/10 text-primary">
                        {category.imageUrl ? (
                            <img
                                src={imageUrl(category.imageUrl) ?? ""}
                                alt={category.name}
                                className="size-full object-contain p-1"
                            />
                        ) : (
                            <ShoppingBag className="size-4" />
                        )}
                    </span>

                    <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">
                            {category.name}
                        </span>

                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            {category.productCount}{" "}
                            {category.productCount === 1 ? t("common.product") : t("common.productsLower")}
                        </span>
                    </span>
                </span>

                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180" />
            </Link>

            {category.children.length > 0 && (
                <div className="mx-3 mb-3 grid overflow-hidden rounded-xl border bg-muted/20">
                    {category.children.map((child, index) => (
                        <Link viewTransition
                            key={child.id}
                            to={`/products?categoryId=${child.id}`}
                            onClick={onNavigate}
                            className={cn(
                                "group flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-primary",
                                index !== category.children.length - 1 &&
                                    "border-b border-border/70",
                            )}
                        >
                            <span className="truncate">{child.name}</span>

                            <ChevronRight className="size-3.5 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 rtl:rotate-180" />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
