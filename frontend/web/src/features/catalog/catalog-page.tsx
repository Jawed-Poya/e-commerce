import * as Dialog from "@radix-ui/react-dialog";
import {
    ChevronRight,
    LoaderCircle,
    PackageSearch,
    Search,
    SlidersHorizontal,
    X,
} from "lucide-react";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router-dom";

import { flattenCategoryTree } from "./category-tree";
import { ProductCard } from "./product-card";
import { useProductPins } from "./product-pins-context";
import { useInfiniteProducts, useLookups } from "./use-catalog";

import { imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../shared/components/ui/select";
import { Skeleton } from "../../shared/components/ui/skeleton";
import { ScrollArea } from "../../shared/components/ui/scroll-area";
import { formatMoney } from "../../shared/lib/money";
import type { CategoryLookup, Product } from "../../shared/types/product";
import { useI18n } from "../../i18n/i18n-provider";

export function CatalogPage() {
    const { t } = useI18n();
    const [params, setParams] = useSearchParams();
    const [search, setSearch] = useState(params.get("search") ?? "");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const pins = useProductPins();
    const sort = params.get("sort") ?? "newest";

    const sortMap: Record<string, [string, boolean]> = {
        newest: ["createdAt", true],
        name: ["name", false],
        priceLow: ["price", false],
        priceHigh: ["price", true],
    };

    const [sortBy, sortDescending] = sortMap[sort] ?? sortMap.newest;

    const lookups = useLookups();

    const priceMinimum = Math.floor(lookups.data?.minimumPrice ?? 0);

    const priceMaximum = Math.max(
        priceMinimum + 1,
        Math.ceil(lookups.data?.maximumPrice ?? priceMinimum + 1),
    );

    const query = useInfiniteProducts({
        pageSize: 12,
        search: params.get("search") ?? undefined,
        categoryId: params.get("categoryId")
            ? Number(params.get("categoryId"))
            : undefined,
        brandId: params.get("brandId")
            ? Number(params.get("brandId"))
            : undefined,
        unitId: params.get("unitId") ? Number(params.get("unitId")) : undefined,
        minPrice: params.get("minPrice")
            ? Number(params.get("minPrice"))
            : undefined,
        maxPrice: params.get("maxPrice")
            ? Number(params.get("maxPrice"))
            : undefined,
        isFeatured: params.get("isFeatured") === "true" ? true : undefined,
        inStock:
            params.get("stock") === "in"
                ? true
                : params.get("stock") === "out"
                  ? false
                  : undefined,
        isActive: true,
        sortBy,
        sortDescending,
    });

    const loadedProducts = useMemo(
        () => query.data?.pages.flatMap((result) => result.items) ?? [],
        [query.data?.pages],
    );
    const matchingPinnedProducts = useMemo(
        () =>
            pins.pinnedProducts.filter((product) =>
                matchesCatalogFilters(product, params),
            ),
        [params, pins.pinnedProducts],
    );
    const displayedProducts = useMemo(() => {
        const products = new Map<number, (typeof loadedProducts)[number]>();

        matchingPinnedProducts.forEach((product) =>
            products.set(product.id, product),
        );
        loadedProducts.forEach((product) => {
            if (pins.pinnedIds.includes(product.id)) {
                products.set(product.id, product);
            } else if (!products.has(product.id)) {
                products.set(product.id, product);
            }
        });

        return [
            ...pins.pinnedIds
                .map((id) => products.get(id))
                .filter((product) => product != null),
            ...[...products.values()].filter(
                (product) => !pins.pinnedIds.includes(product.id),
            ),
        ];
    }, [loadedProducts, matchingPinnedProducts, pins.pinnedIds]);
    const firstPage = query.data?.pages[0];
    const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

    useEffect(() => {
        const target = loadMoreRef.current;
        if (!target || !hasNextPage) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !isFetchingNextPage) {
                    void fetchNextPage();
                }
            },
            { rootMargin: "500px 0px" },
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    const update = (key: string, value?: string) => {
        const next = new URLSearchParams(params);

        if (value && value !== "all") {
            next.set(key, value);
        } else {
            next.delete(key);
        }

        if (key !== "page") {
            next.delete("page");
        }

        setParams(next);
    };

    const updatePriceRange = (minimum: number, maximum: number) => {
        const next = new URLSearchParams(params);

        if (minimum > priceMinimum) {
            next.set("minPrice", String(minimum));
        } else {
            next.delete("minPrice");
        }

        if (maximum < priceMaximum) {
            next.set("maxPrice", String(maximum));
        } else {
            next.delete("maxPrice");
        }

        next.delete("page");
        setParams(next);
    };

    const clearFilters = () => {
        setSearch("");
        setParams(sort === "newest" ? {} : { sort });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        update("search", search.trim());
    };

    const category = lookups.data?.categories.find(
        (item) => String(item.id) === params.get("categoryId"),
    );

    const brand = lookups.data?.brands.find(
        (item) => String(item.id) === params.get("brandId"),
    );

    const unit = lookups.data?.units.find(
        (item) => String(item.id) === params.get("unitId"),
    );

    const rootCategories = (lookups.data?.categories ?? []).filter(
        (item) => item.parentId == null,
    );

    const activeFilters = [
        params.get("search")
            ? {
                  key: "search",
                  label: t("catalog.searchLabel", { value: params.get("search") ?? "" }),
              }
            : null,
        category
            ? {
                  key: "categoryId",
                  label: category.name,
              }
            : null,
        brand
            ? {
                  key: "brandId",
                  label: brand.name,
              }
            : null,
        unit
            ? {
                  key: "unitId",
                  label: unit.name,
              }
            : null,
        params.get("minPrice") || params.get("maxPrice")
            ? {
                  key: "price",
                  label: `${formatCurrency(
                      Number(params.get("minPrice") ?? priceMinimum),
                  )} – ${formatCurrency(
                      Number(params.get("maxPrice") ?? priceMaximum),
                  )}`,
              }
            : null,
        params.get("stock") === "in"
            ? {
                  key: "stock",
                  label: t("catalog.inStock"),
              }
            : params.get("stock") === "out"
              ? {
                    key: "stock",
                    label: t("catalog.outOfStock"),
                }
              : null,
        params.get("isFeatured") === "true"
            ? {
                  key: "isFeatured",
                  label: t("catalog.featured"),
              }
            : null,
    ].filter(Boolean) as {
        key: string;
        label: string;
    }[];

    const filterPanel = (
        <FilterPanel
            categoryId={params.get("categoryId") ?? "all"}
            brandId={params.get("brandId") ?? "all"}
            unitId={params.get("unitId") ?? "all"}
            stock={params.get("stock") ?? "all"}
            featured={params.get("isFeatured") ?? "all"}
            minPrice={params.get("minPrice") ?? ""}
            maxPrice={params.get("maxPrice") ?? ""}
            priceMinimum={priceMinimum}
            priceMaximum={priceMaximum}
            categories={lookups.data?.categories ?? []}
            brands={lookups.data?.brands ?? []}
            units={lookups.data?.units ?? []}
            onChange={update}
            onPriceChange={updatePriceRange}
            onClear={clearFilters}
            hasFilters={activeFilters.length > 0}
        />
    );

    return (
        <div className="mx-auto w-full max-w-[1380px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <nav className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Link viewTransition
                    to="/"
                    className="rounded-md px-1 py-1 transition-colors hover:text-primary"
                >
                    {t("common.home")}
                </Link>

                <ChevronRight className="size-3.5 opacity-50 rtl:rotate-180" />

                <span className="text-foreground">{t("catalog.shop")}</span>
            </nav>

            <section className="relative mb-5 overflow-hidden rounded-xl bg-card px-5 py-6 shadow-[0_16px_42px_-36px_rgba(15,23,42,.48)] ring-1 ring-black/[0.05] sm:px-7 lg:px-8 lg:py-7 dark:bg-white/[0.03] dark:ring-white/[0.05]">
                <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/[0.08] blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-brand-orange/[0.08] blur-3xl" />

                <div className="relative flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                            <PackageSearch className="size-3.5" />
                            {t("catalog.curated")}
                        </div>

                        <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.045em] sm:text-4xl">
                            {t("catalog.heroTitle")}
                        </h1>

                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                            {t("catalog.heroDescription")}
                        </p>
                    </div>

                    {!query.isLoading && firstPage && (
                        <div className="w-fit rounded-xl bg-background/[0.80] px-4 py-3 ring-1 ring-black/[0.05] dark:bg-white/[0.04] dark:ring-white/[0.05]">
                            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                {t("catalog.availableNow")}
                            </span>

                            <span className="mt-1 block text-xl font-black">
                                {firstPage.totalCount}
                            </span>

                            <span className="text-xs text-muted-foreground">
                                {t("catalog.productsInCatalog")}
                            </span>
                        </div>
                    )}
                </div>
            </section>

            {rootCategories.length > 0 ? (
                <div className="mb-5 overflow-x-auto rounded-xl bg-card p-2 shadow-[0_12px_30px_-28px_rgba(15,23,42,.45)] ring-1 ring-black/[0.05] [scrollbar-width:none] dark:bg-white/[0.025] dark:ring-white/[0.05] [&::-webkit-scrollbar]:hidden">
                    <div className="flex min-w-max snap-x snap-mandatory items-center gap-2">
                        <button
                            type="button"
                            onClick={() => update("categoryId")}
                            className={`h-11 snap-start rounded-xl px-3 text-[12px] font-bold transition ${
                                !params.get("categoryId")
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                            {t("catalog.allCategories")}
                        </button>
                        {rootCategories.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => update("categoryId", String(item.id))}
                                className={`flex h-11 w-40 snap-start items-center gap-2 rounded-xl px-2 text-start text-[12px] font-bold transition ${
                                    params.get("categoryId") === String(item.id)
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                            >
                                <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted/75">
                                    {item.imageUrl ? (
                                        <img
                                            src={imageUrl(item.imageUrl) ?? ""}
                                            alt=""
                                            className="size-full object-contain p-0.5"
                                        />
                                    ) : (
                                        <PackageSearch className="size-4" />
                                    )}
                                </span>
                                <span className="min-w-0 flex-1 truncate">
                                    {item.name}
                                </span>
                                <span className="rounded-full bg-foreground/[0.08] px-1.5 py-0.5 text-[9px]">
                                    {item.productCount}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="sticky top-28 hidden max-h-[calc(100vh-8rem)] overflow-hidden rounded-xl bg-card shadow-[0_16px_38px_-34px_rgba(15,23,42,.48)] ring-1 ring-black/[0.05] lg:flex lg:flex-col dark:bg-white/[0.025] dark:ring-white/[0.05]">
                    <div className="bg-muted/35 p-4 dark:bg-white/[0.025]">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                            {t("catalog.filterProducts")}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {t("catalog.filterDescription")}
                        </p>
                    </div>
                    <ScrollArea className="min-h-0 flex-1">
                        <div className="p-4 pe-5">{filterPanel}</div>
                    </ScrollArea>
                </aside>

                <section className="min-w-0">
                    <div className="mb-4 rounded-xl bg-card p-2.5 shadow-[0_12px_30px_-28px_rgba(15,23,42,.45)] ring-1 ring-black/[0.05] dark:bg-white/[0.025] dark:ring-white/[0.05]">
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <form
                                onSubmit={submit}
                                className="group flex h-10 min-w-0 flex-1 items-center rounded-lg border bg-background p-1 transition focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/10"
                            >
                                <Search className="ml-3 size-4.5 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />

                                <input
                                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder={t("catalog.searchPlaceholder")}
                                />

                                <Button className="h-8 rounded-md px-4 font-semibold">
                                    {t("catalog.searchAction")}
                                </Button>
                            </form>

                            <Dialog.Root
                                open={filtersOpen}
                                onOpenChange={setFiltersOpen}
                            >
                                <Dialog.Trigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-10 rounded-lg lg:hidden"
                                    >
                                        <SlidersHorizontal className="size-4" />
                                        {t("catalog.filters")}
                                        {activeFilters.length > 0 && (
                                            <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                                {activeFilters.length}
                                            </span>
                                        )}
                                    </Button>
                                </Dialog.Trigger>

                                <Dialog.Portal>
                                    <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in" />

                                    <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[90%] max-w-sm flex-col overflow-hidden border-l bg-background shadow-2xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right">
                                        <div className="z-10 flex shrink-0 items-center justify-between border-b bg-background/[0.95] px-5 py-5 backdrop-blur">
                                            <div>
                                                <Dialog.Title className="text-lg font-black">
                                                    {t("catalog.filterProducts")}
                                                </Dialog.Title>

                                                <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                                                    {t("catalog.filterDescription")}
                                                </Dialog.Description>
                                            </div>

                                            <Dialog.Close asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-xl"
                                                >
                                                    <X className="size-5" />
                                                </Button>
                                            </Dialog.Close>
                                        </div>

                                        <ScrollArea className="min-h-0 flex-1">
                                            <div className="p-4 pe-5">{filterPanel}</div>
                                        </ScrollArea>

                                        <div className="shrink-0 border-t bg-background/[0.95] p-5 backdrop-blur">
                                            <Dialog.Close asChild>
                                                <Button className="h-11 w-full rounded-xl">
                                                    {t("catalog.showProducts")}
                                                </Button>
                                            </Dialog.Close>
                                        </div>
                                    </Dialog.Content>
                                </Dialog.Portal>
                            </Dialog.Root>

                            <Select
                                value={sort}
                                onValueChange={(value) => update("sort", value)}
                            >
                                <SelectTrigger className="h-10 rounded-lg sm:w-52">
                                    <SelectValue />
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectItem value="newest">
                                        {t("catalog.newest")}
                                    </SelectItem>
                                    <SelectItem value="name">
                                        {t("catalog.nameAsc")}
                                    </SelectItem>
                                    <SelectItem value="priceLow">
                                        {t("catalog.priceLow")}
                                    </SelectItem>
                                    <SelectItem value="priceHigh">
                                        {t("catalog.priceHigh")}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {activeFilters.length > 0 && (
                        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed bg-muted/20 p-3">
                            <span className="mr-1 text-xs font-semibold text-muted-foreground">
                                {t("catalog.activeFilters")}
                            </span>

                            {activeFilters.map((filter) => (
                                <button
                                    key={filter.key}
                                    type="button"
                                    onClick={() => {
                                        if (filter.key === "search") {
                                            setSearch("");
                                        }

                                        if (filter.key === "price") {
                                            updatePriceRange(
                                                priceMinimum,
                                                priceMaximum,
                                            );
                                        } else {
                                            update(filter.key);
                                        }
                                    }}
                                    className="group inline-flex h-8 items-center gap-2 rounded-full border bg-background px-3 text-xs font-semibold shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                                >
                                    <span className="max-w-48 truncate">
                                        {filter.label}
                                    </span>

                                    <X className="size-3 opacity-50 transition-opacity group-hover:opacity-100" />
                                </button>
                            ))}

                            <button
                                type="button"
                                onClick={clearFilters}
                                className="rounded-full px-3 py-2 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10"
                            >
                                {t("catalog.clearAll")}
                            </button>
                        </div>
                    )}

                    {query.isLoading ? (
                        <div className="grid auto-rows-fr grid-cols-2 gap-2.5 sm:gap-4">
                            {Array.from({ length: 8 }).map((_, index) => (
                                <Skeleton
                                    key={index}
                                    className="h-[430px] rounded-2xl"
                                />
                            ))}
                        </div>
                    ) : query.isError && !query.data ? (
                        <EmptyState
                            title={t("catalog.unavailableTitle")}
                            text={t("catalog.loadError")}
                        />
                    ) : !displayedProducts.length ? (
                        <EmptyState
                            title={t("catalog.noMatches")}
                            text={t("catalog.noMatchesDescription")}
                            action={clearFilters}
                        />
                    ) : (
                        <>
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <p className="text-sm text-muted-foreground">
                                    {t("catalog.showingLoaded", {
                                        count: displayedProducts.length,
                                        total: firstPage?.totalCount ?? displayedProducts.length,
                                    })}
                                </p>

                                {matchingPinnedProducts.length > 0 ? (
                                    <span className="hidden text-xs font-bold text-primary sm:block">
                                        {t("catalog.pinnedFirst", {
                                            count: matchingPinnedProducts.length,
                                        })}
                                    </span>
                                ) : null}
                            </div>

                            <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-2.5 sm:gap-4">
                                {displayedProducts.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                    />
                                ))}
                            </div>

                            <div
                                ref={loadMoreRef}
                                className="mt-8 flex min-h-16 items-center justify-center"
                            >
                                {query.hasNextPage ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-11 rounded-xl px-6"
                                        disabled={query.isFetchingNextPage}
                                        onClick={() => void query.fetchNextPage()}
                                    >
                                        {query.isFetchingNextPage ? (
                                            <LoaderCircle className="size-4 animate-spin" />
                                        ) : null}
                                        {query.isFetchingNextPage
                                            ? t("catalog.loadingMore")
                                            : t("catalog.loadMore")}
                                    </Button>
                                ) : (
                                    <p className="text-xs font-semibold text-muted-foreground">
                                        {t("catalog.allLoaded")}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}

type Lookup = {
    id: number;
    name: string;
};

function FilterPanel({
    categoryId,
    brandId,
    unitId,
    stock,
    featured,
    minPrice,
    maxPrice,
    priceMinimum,
    priceMaximum,
    categories,
    brands,
    units,
    onChange,
    onPriceChange,
    onClear,
    hasFilters,
}: {
    categoryId: string;
    brandId: string;
    unitId: string;
    stock: string;
    featured: string;
    minPrice: string;
    maxPrice: string;
    priceMinimum: number;
    priceMaximum: number;
    categories: CategoryLookup[];
    brands: Lookup[];
    units: Lookup[];
    onChange: (key: string, value?: string) => void;
    onPriceChange: (minimum: number, maximum: number) => void;
    onClear: () => void;
    hasFilters: boolean;
}) {
    const { t } = useI18n();
    const orderedCategories = flattenCategoryTree(categories);

    return (
        <div>
            <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                    <span className="flex items-center gap-2 text-base font-black">
                        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                            <SlidersHorizontal className="size-4" />
                        </span>
                        {t("catalog.filters")}
                    </span>

                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                        {t("catalog.heroDescription")}
                    </span>
                </div>

                {hasFilters && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10"
                    >
                        {t("catalog.clearFilters")}
                    </button>
                )}
            </div>

            <div className="grid gap-3">
                <Filter label={t("catalog.category")}>
                    <Select
                        value={categoryId}
                        onValueChange={(value) => onChange("categoryId", value)}
                    >
                        <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue />
                        </SelectTrigger>

                        <SelectContent>
                            <SelectItem value="all">{t("catalog.allCategories")}</SelectItem>

                            {orderedCategories.map(({ category, depth }) => (
                                <SelectItem
                                    key={category.id}
                                    value={String(category.id)}
                                >
                                    <span
                                        style={{
                                            paddingInlineStart: depth * 12,
                                        }}
                                    >
                                        {depth > 0 && "↳ "}
                                        {category.name}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Filter>

                <Filter label={t("catalog.brand")}>
                    <Select
                        value={brandId}
                        onValueChange={(value) => onChange("brandId", value)}
                    >
                        <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue />
                        </SelectTrigger>

                        <SelectContent>
                            <SelectItem value="all">{t("catalog.allBrands")}</SelectItem>

                            {brands.map((item) => (
                                <SelectItem
                                    key={item.id}
                                    value={String(item.id)}
                                >
                                    {item.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Filter>

                <Filter label={t("catalog.priceRange")}>
                    <PriceRange
                        minimum={priceMinimum}
                        maximum={priceMaximum}
                        selectedMinimum={minPrice}
                        selectedMaximum={maxPrice}
                        onChange={onPriceChange}
                    />
                </Filter>

                <Filter label={t("catalog.availability")}>
                    <ChoiceGroup
                        value={stock}
                        onChange={(value) => onChange("stock", value)}
                        options={[
                            {
                                value: "all",
                                label: t("catalog.any"),
                            },
                            {
                                value: "in",
                                label: t("catalog.inStock"),
                            },
                            {
                                value: "out",
                                label: t("product.soldOut"),
                            },
                        ]}
                    />
                </Filter>

                <Filter label={t("catalog.collection")}>
                    <ChoiceGroup
                        value={featured}
                        onChange={(value) => onChange("isFeatured", value)}
                        options={[
                            {
                                value: "all",
                                label: t("catalog.allProducts"),
                            },
                            {
                                value: "true",
                                label: t("catalog.featured"),
                            },
                        ]}
                    />
                </Filter>

                <Filter label={t("catalog.unit")}>
                    <Select
                        value={unitId}
                        onValueChange={(value) => onChange("unitId", value)}
                    >
                        <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue />
                        </SelectTrigger>

                        <SelectContent>
                            <SelectItem value="all">{t("catalog.allUnits")}</SelectItem>

                            {units.map((item) => (
                                <SelectItem
                                    key={item.id}
                                    value={String(item.id)}
                                >
                                    {item.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Filter>
            </div>
        </div>
    );
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
    return (
        <fieldset className="rounded-2xl bg-muted/[0.32] p-4 ring-1 ring-black/[0.045] transition hover:bg-muted/[0.48] dark:bg-white/[0.025] dark:ring-white/[0.045]">
            <legend className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                {label}
            </legend>

            <div className="mt-1">{children}</div>
        </fieldset>
    );
}

function ChoiceGroup({
    value,
    options,
    onChange,
}: {
    value: string;
    options: {
        value: string;
        label: string;
    }[];
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                        value === option.value
                            ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                            : "bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function PriceRange({
    minimum,
    maximum,
    selectedMinimum,
    selectedMaximum,
    onChange,
}: {
    minimum: number;
    maximum: number;
    selectedMinimum: string;
    selectedMaximum: string;
    onChange: (minimum: number, maximum: number) => void;
}) {
    const { t, direction } = useI18n();
    const span = Math.max(1, maximum - minimum);
    const step = span <= 100 ? 1 : span <= 500 ? 5 : span <= 2000 ? 10 : 50;

    const getMinimum = () =>
        Math.min(
            maximum - step,
            Math.max(minimum, Number(selectedMinimum || minimum)),
        );

    const getMaximum = () =>
        Math.max(
            minimum + step,
            Math.min(maximum, Number(selectedMaximum || maximum)),
        );

    const [draftMinimum, setDraftMinimum] = useState(getMinimum);
    const [draftMaximum, setDraftMaximum] = useState(getMaximum);

    useEffect(() => {
        setDraftMinimum(getMinimum());
        setDraftMaximum(getMaximum());
    }, [minimum, maximum, selectedMinimum, selectedMaximum]);

    const minimumPercent = ((draftMinimum - minimum) / span) * 100;

    const maximumPercent = ((draftMaximum - minimum) / span) * 100;

    const commit = () => onChange(draftMinimum, draftMaximum);

    return (
        <div>
            <div className="grid grid-cols-2 gap-2">
                <PriceValue label={t("catalog.minimum")} value={draftMinimum} />

                <PriceValue label={t("catalog.maximum")} value={draftMaximum} align="end" />
            </div>

            <div className="relative mt-5 h-6">
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />

                <div
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary shadow-sm"
                    style={
                        direction === "rtl"
                            ? {
                                  right: `${minimumPercent}%`,
                                  left: `${100 - maximumPercent}%`,
                              }
                            : {
                                  left: `${minimumPercent}%`,
                                  right: `${100 - maximumPercent}%`,
                              }
                    }
                />

                <input
                    type="range"
                    aria-label={t("catalog.minimum")}
                    min={minimum}
                    max={maximum}
                    step={step}
                    value={draftMinimum}
                    onChange={(event) =>
                        setDraftMinimum(
                            Math.min(
                                Number(event.target.value),
                                draftMaximum - step,
                            ),
                        )
                    }
                    onPointerUp={commit}
                    onKeyUp={commit}
                    onBlur={commit}
                    dir={direction}
                    className="price-range-input absolute inset-0 z-20 w-full"
                />

                <input
                    type="range"
                    aria-label={t("catalog.maximum")}
                    min={minimum}
                    max={maximum}
                    step={step}
                    value={draftMaximum}
                    onChange={(event) =>
                        setDraftMaximum(
                            Math.max(
                                Number(event.target.value),
                                draftMinimum + step,
                            ),
                        )
                    }
                    onPointerUp={commit}
                    onKeyUp={commit}
                    onBlur={commit}
                    dir={direction}
                    className="price-range-input absolute inset-0 z-30 w-full"
                />
            </div>

            <div className="mt-1 flex justify-between text-[10px] font-medium text-muted-foreground">
                <span>{formatCurrency(minimum)}</span>
                <span>{formatCurrency(maximum)}</span>
            </div>
        </div>
    );
}

function PriceValue({
    label,
    value,
    align = "start",
}: {
    label: string;
    value: number;
    align?: "start" | "end";
}) {
    return (
        <div
            className={`rounded-xl border bg-background px-3 py-2.5 shadow-sm ${
                align === "end" ? "text-end" : ""
            }`}
        >
            <small className="block text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {label}
            </small>

            <b className="mt-1 block text-sm text-foreground">
                {formatCurrency(value)}
            </b>
        </div>
    );
}

function formatCurrency(value: number) {
    return formatMoney(value);
}

function matchesCatalogFilters(product: Product, params: URLSearchParams) {
    const search = params.get("search")?.trim().toLocaleLowerCase();
    const categoryId = Number(params.get("categoryId"));
    const brandId = Number(params.get("brandId"));
    const unitId = Number(params.get("unitId"));
    const minimum = Number(params.get("minPrice"));
    const maximum = Number(params.get("maxPrice"));

    if (
        search &&
        !`${product.name} ${product.barcode ?? ""}`
            .toLocaleLowerCase()
            .includes(search)
    ) {
        return false;
    }
    if (categoryId && product.categoryId !== categoryId) return false;
    if (brandId && product.brandId !== brandId) return false;
    if (unitId && product.unitId !== unitId) return false;
    if (
        params.has("minPrice") &&
        (product.price == null || product.price < minimum)
    ) {
        return false;
    }
    if (
        params.has("maxPrice") &&
        (product.price == null || product.price > maximum)
    ) {
        return false;
    }
    if (params.get("stock") === "in" && product.stock <= 0) return false;
    if (params.get("stock") === "out" && product.stock > 0) return false;
    if (params.get("isFeatured") === "true" && !product.isFeatured) {
        return false;
    }
    return product.isActive;
}

function EmptyState({
    title,
    text,
    action,
}: {
    title: string;
    text: string;
    action?: () => void;
}) {
    const { t } = useI18n();
    return (
        <div className="relative overflow-hidden rounded-[28px] border border-dashed bg-muted/15 px-6 py-20 text-center">
            <div className="pointer-events-none absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />

            <div className="relative">
                <span className="mx-auto grid size-16 place-items-center rounded-2xl border bg-background text-muted-foreground shadow-sm">
                    <PackageSearch className="size-7" />
                </span>

                <h2 className="mt-6 text-xl font-black">{title}</h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    {text}
                </p>

                {action && (
                    <Button
                        variant="outline"
                        className="mt-6 rounded-xl"
                        onClick={action}
                    >
                        {t("catalog.clearFilters")}
                    </Button>
                )}
            </div>
        </div>
    );
}
