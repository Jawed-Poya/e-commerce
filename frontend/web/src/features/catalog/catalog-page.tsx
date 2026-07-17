import * as Dialog from "@radix-ui/react-dialog";
import {
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../shared/components/ui/select";
import { Skeleton } from "../../shared/components/ui/skeleton";
import { ProductCard } from "./product-card";
import { useLookups, useProducts } from "./use-catalog";
import { flattenCategoryTree } from "./category-tree";
import type { CategoryLookup } from "../../shared/types/product";

export function CatalogPage() {
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
  const query = useProducts({
    page,
    pageSize: 12,
    search: params.get("search") ?? undefined,
    categoryId: params.get("categoryId")
      ? Number(params.get("categoryId"))
      : undefined,
    brandId: params.get("brandId") ? Number(params.get("brandId")) : undefined,
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
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
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
      ? { key: "search", label: `Search: ${params.get("search")}` }
      : null,
    category ? { key: "categoryId", label: category.name } : null,
    brand ? { key: "brandId", label: brand.name } : null,
    unit ? { key: "unitId", label: unit.name } : null,
    params.get("minPrice")
      ? { key: "minPrice", label: `From $${params.get("minPrice")}` }
      : null,
    params.get("maxPrice")
      ? { key: "maxPrice", label: `Up to $${params.get("maxPrice")}` }
      : null,
    params.get("stock") === "in"
      ? { key: "stock", label: "In stock" }
      : params.get("stock") === "out"
        ? { key: "stock", label: "Out of stock" }
        : null,
    params.get("isFeatured") === "true"
      ? { key: "isFeatured", label: "Featured" }
      : null,
  ].filter(Boolean) as { key: string; label: string }[];

  const filterPanel = (
    <FilterPanel
      categoryId={params.get("categoryId") ?? "all"}
      brandId={params.get("brandId") ?? "all"}
      unitId={params.get("unitId") ?? "all"}
      stock={params.get("stock") ?? "all"}
      featured={params.get("isFeatured") ?? "all"}
      minPrice={params.get("minPrice") ?? ""}
      maxPrice={params.get("maxPrice") ?? ""}
      categories={lookups.data?.categories ?? []}
      brands={lookups.data?.brands ?? []}
      units={lookups.data?.units ?? []}
      onChange={update}
      onClear={clearFilters}
      hasFilters={activeFilters.length > 0}
    />
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <nav className="mb-7 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">Shop</span>
      </nav>

      <div className="mb-9 border-b pb-8">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">
          Curated marketplace
        </p>
        <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              Find products made for you.
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
              Browse the complete catalog with clear prices, real availability,
              and useful product details.
            </p>
          </div>
          {!query.isLoading && query.data && (
            <p className="shrink-0 text-sm text-muted-foreground">
              <b className="text-foreground">{query.data.totalCount}</b>{" "}
              products available
            </p>
          )}
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="sticky top-24 hidden rounded-lg border bg-card p-5 lg:block">
          {filterPanel}
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <form
              onSubmit={submit}
              className="flex h-11 min-w-0 flex-1 items-center rounded-lg border bg-background transition focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20"
            >
              <Search className="ml-3 size-4 shrink-0 text-muted-foreground" />
              <input
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by product name or barcode"
              />
              <Button className="mr-1 h-9">Search</Button>
            </form>

            <Dialog.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
              <Dialog.Trigger asChild>
                <Button variant="outline" className="lg:hidden">
                  <SlidersHorizontal /> Filters
                  {activeFilters.length > 0 && (
                    <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      {activeFilters.length}
                    </span>
                  )}
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
                <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-[88%] max-w-sm overflow-y-auto border-l bg-background p-6">
                  <div className="mb-7 flex items-center justify-between">
                    <Dialog.Title className="text-lg font-bold">
                      Filter products
                    </Dialog.Title>
                    <Dialog.Close asChild>
                      <Button variant="ghost" size="icon">
                        <X />
                      </Button>
                    </Dialog.Close>
                  </div>
                  {filterPanel}
                  <Dialog.Close asChild>
                    <Button className="mt-6 w-full">Show products</Button>
                  </Dialog.Close>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>

            <Select
              value={sort}
              onValueChange={(value) => update("sort", value)}
            >
              <SelectTrigger className="sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="priceLow">Price: low to high</SelectItem>
                <SelectItem value="priceHigh">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {activeFilters.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => {
                    if (filter.key === "search") setSearch("");
                    update(filter.key);
                  }}
                  className="inline-flex h-8 items-center gap-2 rounded-full border bg-background px-3 text-xs font-medium hover:border-primary"
                >
                  {filter.label} <X className="size-3" />
                </button>
              ))}
              <button
                onClick={clearFilters}
                className="px-2 text-xs font-semibold text-destructive hover:underline"
              >
                Clear all
              </button>
            </div>
          )}

          {query.isLoading ? (
            <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-[430px]" />
              ))}
            </div>
          ) : query.isError ? (
            <EmptyState
              title="The catalog is unavailable"
              text="We couldn't load products right now. Please try again shortly."
            />
          ) : !query.data?.items.length ? (
            <EmptyState
              title="No matching products"
              text="Try a different search or remove one of the active filters."
              action={clearFilters}
            />
          ) : (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                Showing {query.data.items.length} products on this page
              </div>
              <div className="grid auto-rows-fr items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {query.data.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination
                page={query.data.page}
                totalPages={query.data.totalPages}
                previous={query.data.hasPreviousPage}
                next={query.data.hasNextPage}
                onPage={(value) => update("page", String(value))}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

type Lookup = { id: number; name: string };
function FilterPanel({
  categoryId,
  brandId,
  unitId,
  stock,
  featured,
  minPrice,
  maxPrice,
  categories,
  brands,
  units,
  onChange,
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
  categories: CategoryLookup[];
  brands: Lookup[];
  units: Lookup[];
  onChange: (key: string, value?: string) => void;
  onClear: () => void;
  hasFilters: boolean;
}) {
  const orderedCategories = flattenCategoryTree(categories);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold">
          <SlidersHorizontal className="size-4" /> Filters
        </span>
        {hasFilters && (
          <button
            onClick={onClear}
            className="text-xs font-semibold text-destructive hover:underline"
          >
            Reset
          </button>
        )}
      </div>
      <div className="grid gap-6">
        <Filter label="Category">
          <Select
            value={categoryId}
            onValueChange={(value) => onChange("categoryId", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {orderedCategories.map(({ category, depth }) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  <span style={{ paddingInlineStart: depth * 12 }}>
                    {depth > 0 && "↳ "}
                    {category.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Filter>
        <Filter label="Brand">
          <Select
            value={brandId}
            onValueChange={(value) => onChange("brandId", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {brands.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Filter>
        <Filter label="Price range">
          <div className="grid grid-cols-2 gap-2">
            <label className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={minPrice}
                onChange={(event) => onChange("minPrice", event.target.value)}
                placeholder="Min"
                className="h-10 w-full rounded-md border bg-background pl-7 pr-2 text-sm font-normal tracking-normal text-foreground transition focus:border-primary focus:ring-2 focus:ring-ring/20"
              />
            </label>
            <label className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maxPrice}
                onChange={(event) => onChange("maxPrice", event.target.value)}
                placeholder="Max"
                className="h-10 w-full rounded-md border bg-background pl-7 pr-2 text-sm font-normal tracking-normal text-foreground transition focus:border-primary focus:ring-2 focus:ring-ring/20"
              />
            </label>
          </div>
        </Filter>
        <Filter label="Availability">
          <Select
            value={stock}
            onValueChange={(value) => onChange("stock", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any availability</SelectItem>
              <SelectItem value="in">In stock</SelectItem>
              <SelectItem value="out">Out of stock</SelectItem>
            </SelectContent>
          </Select>
        </Filter>
        <Filter label="Collection">
          <Select
            value={featured}
            onValueChange={(value) => onChange("isFeatured", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              <SelectItem value="true">Featured products</SelectItem>
            </SelectContent>
          </Select>
        </Filter>
        <Filter label="Unit">
          <Select
            value={unitId}
            onValueChange={(value) => onChange("unitId", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All units</SelectItem>
              {units.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
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
    <label className="grid gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
      {label}
      {children}
    </label>
  );
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
    { length: Math.min(5, totalPages) },
    (_, i) => first + i,
  );
  if (totalPages <= 1) return null;
  return (
    <nav
      className="mt-12 flex items-center justify-center gap-1"
      aria-label="Product pages"
    >
      <Button
        variant="ghost"
        size="icon"
        disabled={!previous}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft />
      </Button>
      {pages.map((value) => (
        <Button
          key={value}
          variant={value === page ? "default" : "ghost"}
          size="icon"
          onClick={() => onPage(value)}
        >
          {value}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="icon"
        disabled={!next}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight />
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
  return (
    <div className="rounded-lg border border-dashed p-16 text-center">
      <PackageSearch className="mx-auto size-9 text-muted-foreground" />
      <h2 className="mt-5 text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {text}
      </p>
      {action && (
        <Button variant="outline" className="mt-6" onClick={action}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
