import * as Dialog from "@radix-ui/react-dialog";
import {
    ChevronLeft,
    ChevronRight,
    PackageSearch,
    Search,
    SlidersHorizontal,
    X,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { flattenCategoryTree } from "./category-tree";
import { ProductCard } from "./product-card";
import { useLookups, useProducts } from "./use-catalog";

import { Button } from "../../shared/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../shared/components/ui/select";
import { Skeleton } from "../../shared/components/ui/skeleton";
import type { CategoryLookup } from "../../shared/types/product";
import { useI18n } from "../../i18n/i18n-provider";

export function CatalogPage() {
    const { t } = useI18n();
    const [params, setParams] = useSearchParams();
    const [search, setSearch] = useState(params.get("search") ?? "");
    const [filtersOpen, setFiltersOpen] = useState(false);

    const page = Number(params.get("page") ?? 1);
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

    const query = useProducts({
        page,
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
        <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
            <nav className="mb-6 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Link
                    to="/"
                    className="rounded-md px-1 py-1 transition-colors hover:text-primary"
                >
                    {t("common.home")}
                </Link>

                <ChevronRight className="size-3.5 opacity-50 rtl:rotate-180" />

                <span className="text-foreground">{t("catalog.shop")}</span>
            </nav>

            <section className="relative mb-8 overflow-hidden rounded-[28px] border bg-gradient-to-br from-primary/10 via-background to-orange-500/5 px-6 py-9 sm:px-9 lg:px-12 lg:py-12">
                <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-orange-500/10 blur-3xl" />

                <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary shadow-sm backdrop-blur">
                            <PackageSearch className="size-3.5" />
                            {t("catalog.curated")}
                        </div>

                        <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                            {t("catalog.heroTitle")}
                        </h1>

                        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                            {t("catalog.heroDescription")}
                        </p>
                    </div>

                    {!query.isLoading && query.data && (
                        <div className="w-fit rounded-2xl border bg-background/80 px-5 py-4 shadow-sm backdrop-blur">
                            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                {t("catalog.availableNow")}
                            </span>

                            <span className="mt-1 block text-2xl font-black">
                                {query.data.totalCount}
                            </span>

                            <span className="text-xs text-muted-foreground">
                                {t("catalog.productsInCatalog")}
                            </span>
                        </div>
                    )}
                </div>
            </section>

            <div className="grid items-start gap-7 lg:grid-cols-[290px_minmax(0,1fr)]">
                <aside className="sticky top-32 hidden overflow-hidden rounded-2xl border bg-card shadow-sm lg:block">
                    <div className="p-5">{filterPanel}</div>
                </aside>

                <section className="min-w-0">
                    <div className="mb-5 rounded-2xl border bg-card p-3 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <form
                                onSubmit={submit}
                                className="group flex h-12 min-w-0 flex-1 items-center rounded-xl border bg-muted/30 p-1 transition-all focus-within:border-primary focus-within:bg-background focus-within:ring-4 focus-within:ring-primary/10"
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

                                <Button className="h-10 rounded-lg px-5 font-semibold">
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
                                        className="h-12 rounded-xl lg:hidden"
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

                                    <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-[90%] max-w-sm overflow-y-auto border-l bg-background shadow-2xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right">
                                        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-5 py-5 backdrop-blur">
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

                                        <div className="p-5">{filterPanel}</div>

                                        <div className="sticky bottom-0 border-t bg-background/95 p-5 backdrop-blur">
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
                                <SelectTrigger className="h-12 rounded-xl sm:w-56">
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
                        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {Array.from({ length: 8 }).map((_, index) => (
                                <Skeleton
                                    key={index}
                                    className="h-[430px] rounded-2xl"
                                />
                            ))}
                        </div>
                    ) : query.isError ? (
                        <EmptyState
                            title={t("catalog.unavailableTitle")}
                            text={t("catalog.loadError")}
                        />
                    ) : !query.data?.items.length ? (
                        <EmptyState
                            title={t("catalog.noMatches")}
                            text={t("catalog.noMatchesDescription")}
                            action={clearFilters}
                        />
                    ) : (
                        <>
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <p className="text-sm text-muted-foreground">
                                    {t("catalog.showingPage", { count: query.data.items.length })}
                                </p>

                                <span className="hidden text-xs text-muted-foreground sm:block">
                                    {t("catalog.pageOf", { page: query.data.page, pages: query.data.totalPages })}
                                </span>
                            </div>

                            <div className="grid auto-rows-fr items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                {query.data.items.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                    />
                                ))}
                            </div>

                            <Pagination
                                page={query.data.page}
                                totalPages={query.data.totalPages}
                                previous={query.data.hasPreviousPage}
                                next={query.data.hasNextPage}
                                onPage={(value) =>
                                    update("page", String(value))
                                }
                            />
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
        <fieldset className="rounded-xl border bg-muted/15 p-4">
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
    const { t } = useI18n();
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
                    style={{
                        left: `${minimumPercent}%`,
                        right: `${100 - maximumPercent}%`,
                    }}
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
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

function Pagination({
    page,
    totalPages,
    previous,
    next,
    onPage,
}: {
    page: number;
    totalPages: number;
    previous: boolean;
    next: boolean;
    onPage: (page: number) => void;
}) {
    const first = Math.max(1, Math.min(page - 2, totalPages - 4));

    const pages = Array.from(
        {
            length: Math.min(5, totalPages),
        },
        (_, index) => first + index,
    );

    if (totalPages <= 1) {
        return null;
    }

    return (
        <nav
            className="mt-12 flex items-center justify-center gap-1.5 rounded-2xl border bg-card p-2 shadow-sm"
            aria-label="Product pages"
        >
            <Button
                variant="ghost"
                size="icon"
                disabled={!previous}
                onClick={() => onPage(page - 1)}
                className="rounded-xl"
            >
                <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>

            {pages.map((value) => (
                <Button
                    key={value}
                    variant={value === page ? "default" : "ghost"}
                    size="icon"
                    onClick={() => onPage(value)}
                    className="rounded-xl"
                >
                    {value}
                </Button>
            ))}

            <Button
                variant="ghost"
                size="icon"
                disabled={!next}
                onClick={() => onPage(page + 1)}
                className="rounded-xl"
            >
                <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
        </nav>
    );
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
