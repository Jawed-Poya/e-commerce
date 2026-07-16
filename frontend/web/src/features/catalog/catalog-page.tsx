import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
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
export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const page = Number(params.get("page") ?? 1);
  const sort = params.get("sort") ?? "newest";
  const sortMap: Record<string, [string, boolean]> = {
    newest: ["createdAt", true],
    name: ["name", false],
    priceLow: ["price", false],
    priceHigh: ["price", true],
  };
  const [sortBy, sortDescending] = sortMap[sort] ?? sortMap.newest;
  const query = useProducts({
    page,
    pageSize: 12,
    search: params.get("search") ?? undefined,
    categoryId: params.get("categoryId")
      ? Number(params.get("categoryId"))
      : undefined,
    brandId: params.get("brandId") ? Number(params.get("brandId")) : undefined,
    isActive: true,
    sortBy,
    sortDescending,
  });
  const lookups = useLookups();
  const update = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    update("search", search.trim());
  };
  const filtered = Boolean(
    params.get("search") || params.get("categoryId") || params.get("brandId"),
  );
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="mb-10 max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">
          Curated marketplace
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Discover your next favorite.
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          Search the entire catalog and narrow the results by category, brand or
          price.
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-max rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2 font-bold">
            <SlidersHorizontal className="size-4 text-primary" />
            Filters
          </div>
          <div className="grid gap-5">
            <Filter label="Category">
              <Select
                value={params.get("categoryId") ?? "all"}
                onValueChange={(v) => update("categoryId", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {lookups.data?.categories.map((x) => (
                    <SelectItem key={x.id} value={String(x.id)}>
                      {x.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Filter>
            <Filter label="Brand">
              <Select
                value={params.get("brandId") ?? "all"}
                onValueChange={(v) => update("brandId", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All brands</SelectItem>
                  {lookups.data?.brands.map((x) => (
                    <SelectItem key={x.id} value={String(x.id)}>
                      {x.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Filter>
            {filtered && (
              <Button
                variant="destructive"
                onClick={() => {
                  setSearch("");
                  setParams({});
                }}
              >
                <X />
                Clear filters
              </Button>
            )}
          </div>
        </aside>
        <div>
          <div className="mb-7 flex flex-col gap-3 sm:flex-row">
            <form
              onSubmit={submit}
              className="flex h-11 flex-1 items-center rounded-md border bg-background"
            >
              <Search className="ml-3 size-4 text-muted-foreground" />
              <input
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
              />
              <Button className="mr-1 h-9">Search</Button>
            </form>
            <Select value={sort} onValueChange={(v) => update("sort", v)}>
              <SelectTrigger className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
                <SelectItem value="priceLow">Price: low to high</SelectItem>
                <SelectItem value="priceHigh">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {query.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[420px]" />
              ))}
            </div>
          ) : query.isError ? (
            <Empty
              title="Catalog unavailable"
              text="We couldn't load products. Please try again shortly."
            />
          ) : !query.data?.items.length ? (
            <Empty
              title="No products found"
              text="Try another search or remove one of your filters."
            />
          ) : (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                Showing{" "}
                <b className="text-foreground">{query.data.items.length}</b> of{" "}
                {query.data.totalCount} products
              </div>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {query.data.items.map((x) => (
                  <ProductCard key={x.id} product={x} />
                ))}
              </div>
              <div className="mt-10 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  disabled={!query.data.hasPreviousPage}
                  onClick={() => update("page", String(page - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page <b className="text-foreground">{query.data.page}</b> of{" "}
                  {query.data.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={!query.data.hasNextPage}
                  onClick={() => update("page", String(page + 1))}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </div>
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
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/40 p-16 text-center">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
