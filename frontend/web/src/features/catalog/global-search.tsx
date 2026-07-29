import { useQuery } from "@tanstack/react-query";
import {
    ArrowRight,
    FolderTree,
    LoaderCircle,
    PackageSearch,
    Search,
    X,
} from "lucide-react";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import { useI18n } from "../../i18n/i18n-provider";
import { imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../shared/components/ui/select";
import { formatMoney } from "../../shared/lib/money";
import { productPath } from "../../shared/lib/product-path";
import { cn } from "../../shared/lib/utils";
import { getProducts } from "./catalog-api";
import { flattenCategoryTree } from "./category-tree";
import { useLookups } from "./use-catalog";

interface GlobalSearchProps {
    compact?: boolean;
    onNavigate?: () => void;
    className?: string;
}

export function GlobalSearch({
    compact = false,
    onNavigate,
    className,
}: GlobalSearchProps) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const lookups = useLookups();
    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");
    const [categoryId, setCategoryId] = useState("all");
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handle = window.setTimeout(() => setDebounced(query.trim()), 220);
        return () => window.clearTimeout(handle);
    }, [query]);

    useEffect(() => {
        const close = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", close);
        return () => document.removeEventListener("pointerdown", close);
    }, []);

    const selectedCategory =
        categoryId === "all"
            ? null
            : lookups.data?.categories.find(
                  (item) => String(item.id) === categoryId,
              ) ?? null;

    const products = useQuery({
        queryKey: ["global-search", debounced, categoryId],
        queryFn: () =>
            getProducts({
                page: 1,
                pageSize: 6,
                search: debounced,
                categoryId:
                    categoryId === "all" ? undefined : Number(categoryId),
                isActive: true,
                sortBy: "name",
                sortDescending: false,
            }),
        enabled: open && debounced.length >= 2,
        staleTime: 30_000,
    });

    const categoryMatches = useMemo(() => {
        if (debounced.length < 2) return [];

        const categories = lookups.data?.categories ?? [];
        const normalized = debounced.toLocaleLowerCase();
        const byId = new Map(categories.map((category) => [category.id, category]));
        const matches = new Map<number, (typeof categories)[number]>();

        categories
            .filter((category) =>
                category.name.toLocaleLowerCase().includes(normalized),
            )
            .forEach((category) => matches.set(category.id, category));

        for (const product of products.data?.items ?? []) {
            let category = byId.get(product.categoryId);
            while (category) {
                matches.set(category.id, category);
                category = category.parentId == null
                    ? undefined
                    : byId.get(category.parentId);
            }
        }

        if (selectedCategory) matches.set(selectedCategory.id, selectedCategory);
        return Array.from(matches.values()).slice(0, 6);
    }, [
        debounced,
        lookups.data?.categories,
        products.data?.items,
        selectedCategory,
    ]);

    const goToResults = (event?: FormEvent) => {
        event?.preventDefault();
        const params = new URLSearchParams();
        if (query.trim()) params.set("search", query.trim());
        if (categoryId !== "all") params.set("categoryId", categoryId);
        navigate(`/products${params.size ? `?${params.toString()}` : ""}`, { viewTransition: true });
        setOpen(false);
        onNavigate?.();
    };

    const orderedCategories = flattenCategoryTree(
        lookups.data?.categories ?? [],
    );
    const showDropdown =
        open && (query.trim().length > 0 || categoryId !== "all");

    return (
        <div ref={containerRef} className={cn("relative min-w-0", className)}>
            <form
                onSubmit={goToResults}
                className={cn(
                    "group flex w-full items-center border border-input bg-muted/35 transition-all duration-200 focus-within:border-primary/60 focus-within:bg-background focus-within:shadow-[0_16px_40px_-28px_rgba(15,23,42,.6)] focus-within:ring-4 focus-within:ring-primary/10",
                    compact
                        ? "h-11 rounded-2xl p-1"
                        : "h-12 rounded-2xl p-1 shadow-sm",
                )}
            >
                <Search className="ms-3 size-4.5 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <input
                    ref={inputRef}
                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                    value={query}
                    onFocus={() => setOpen(true)}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Escape") {
                            setOpen(false);
                            inputRef.current?.blur();
                        }
                    }}
                    placeholder={t("header.searchPlaceholder")}
                    aria-label={t("common.search")}
                />

                {!compact ? (
                    <div className="hidden h-8 min-w-44 border-s ps-1 lg:block">
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger className="h-8 rounded-lg border-0 bg-transparent px-2 shadow-none focus:ring-0">
                                <SelectValue
                                    placeholder={t("catalog.allCategories")}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t("catalog.allCategories")}
                                </SelectItem>
                                {orderedCategories.map(({ category, depth }) => (
                                    <SelectItem
                                        key={category.id}
                                        value={String(category.id)}
                                    >
                                        <span
                                            style={{
                                                paddingInlineStart: depth * 10,
                                            }}
                                        >
                                            {depth > 0 ? "↳ " : ""}
                                            {category.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : null}

                {query ? (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery("");
                            setDebounced("");
                            inputRef.current?.focus();
                        }}
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label={t("common.clearAll")}
                    >
                        <X className="size-3.5" />
                    </button>
                ) : null}

                <Button
                    type="submit"
                    size={compact ? "sm" : "default"}
                    className={cn(
                        "shrink-0 rounded-xl font-semibold shadow-sm",
                        compact ? "h-9 px-4" : "h-10 px-5",
                    )}
                >
                    {compact ? (
                        <Search className="size-4" />
                    ) : (
                        t("common.search")
                    )}
                </Button>
            </form>

            {showDropdown ? (
                <div className="absolute inset-x-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-[22px] border border-border/80 bg-popover/98 dark:border-white/12 text-popover-foreground shadow-[0_28px_80px_-30px_rgba(15,23,42,.55)] backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3 border-b bg-muted/25 px-4 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-black uppercase tracking-[0.15em] text-primary">
                                {t("search.liveResults")}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {selectedCategory
                                    ? t("search.inCategory", {
                                          category: selectedCategory.name,
                                      })
                                    : t("search.allCatalog")}
                            </p>
                        </div>
                        {compact ? (
                            <Select value={categoryId} onValueChange={setCategoryId}>
                                <SelectTrigger className="h-8 w-36 rounded-lg bg-background px-2 text-xs shadow-sm">
                                    <SelectValue placeholder={t("catalog.allCategories")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        {t("catalog.allCategories")}
                                    </SelectItem>
                                    {orderedCategories.map(({ category, depth }) => (
                                        <SelectItem
                                            key={category.id}
                                            value={String(category.id)}
                                        >
                                            <span style={{ paddingInlineStart: depth * 10 }}>
                                                {depth > 0 ? "↳ " : ""}
                                                {category.name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={t("common.close")}
                        >
                            <X className="size-4" />
                        </button>
                    </div>

                    {query.trim().length < 2 ? (
                        <div className="grid min-h-40 place-items-center p-6 text-center">
                            <div>
                                <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                                    <PackageSearch className="size-5" />
                                </span>
                                <p className="mt-3 text-sm font-bold">
                                    {t("search.typeMore")}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {t("search.typeMoreHelp")}
                                </p>
                            </div>
                        </div>
                    ) : products.isFetching ? (
                        <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
                            <LoaderCircle className="size-4 animate-spin" />
                            {t("common.loading")}
                        </div>
                    ) : (
                        <div className="grid max-h-[460px] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_230px]">
                            <div className="p-3">
                                <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                                    {t("search.products")}
                                </p>
                                <div className="grid gap-1.5">
                                    {(products.data?.items ?? []).map((product) => (
                                        <Link viewTransition
                                            key={product.id}
                                            to={productPath(product)}
                                            onClick={() => {
                                                setOpen(false);
                                                onNavigate?.();
                                            }}
                                            className="group flex min-w-0 items-center gap-3 rounded-2xl border border-transparent p-2 transition hover:border-primary/20 hover:bg-primary/5"
                                        >
                                            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border bg-white p-1.5 dark:bg-slate-950">
                                                <img
                                                    src={
                                                        imageUrl(
                                                            product.primaryImageUrl,
                                                        ) ??
                                                        "/placeholder-product.svg"
                                                    }
                                                    alt=""
                                                    className="size-full object-contain"
                                                />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-bold group-hover:text-primary">
                                                    {product.name}
                                                </span>
                                                <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                                                    {product.categoryName} · {product.stock} {t("product.availability")}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-sm font-black">
                                                {product.price != null
                                                    ? formatMoney(product.price)
                                                    : "—"}
                                            </span>
                                        </Link>
                                    ))}
                                    {!products.data?.items.length ? (
                                        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                            {t("catalog.noMatches")}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <aside className="border-t bg-muted/20 p-3 lg:border-s lg:border-t-0">
                                <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                                    {t("search.categories")}
                                </p>
                                <div className="grid gap-1">
                                    {categoryMatches.map((category) => (
                                        <Link viewTransition
                                            key={category.id}
                                            to={`/products?categoryId=${category.id}`}
                                            onClick={() => {
                                                setOpen(false);
                                                onNavigate?.();
                                            }}
                                            className="flex items-center gap-2 rounded-xl p-2 text-sm font-semibold transition hover:bg-background hover:text-primary hover:shadow-sm"
                                        >
                                            <FolderTree className="size-4 shrink-0" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate">{category.name}</span>
                                                <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                                                    {category.productCount} {t("common.productsLower")}
                                                </span>
                                            </span>
                                            <ArrowRight className="size-3.5 rtl:rotate-180" />
                                        </Link>
                                    ))}
                                    {!categoryMatches.length ? (
                                        <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                                            {t("search.noCategories")}
                                        </p>
                                    ) : null}
                                </div>
                            </aside>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => goToResults()}
                        className="flex w-full items-center justify-between border-t bg-muted/25 px-4 py-3 text-sm font-bold transition hover:bg-primary/8 hover:text-primary"
                    >
                        {t("search.viewAll")}
                        <ArrowRight className="size-4 rtl:rotate-180" />
                    </button>
                </div>
            ) : null}
        </div>
    );
}
