import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ProductCard } from "./product-card";
import { useLookups, useProducts } from "./use-catalog";

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const page = Number(params.get("page") ?? 1);
  const sort = params.get("sort") ?? "newest";
  const sortMap: Record<string, [string, boolean]> = { newest: ["createdAt", true], name: ["name", false], priceLow: ["price", false], priceHigh: ["price", true] };
  const [sortBy, sortDescending] = sortMap[sort] ?? sortMap.newest;
  const query = useProducts({ page, pageSize: 12, search: params.get("search") ?? undefined, categoryId: params.get("categoryId") ? Number(params.get("categoryId")) : undefined, brandId: params.get("brandId") ? Number(params.get("brandId")) : undefined, isActive: true, sortBy, sortDescending });
  const lookups = useLookups();
  const update = (name: string, value?: string) => { const next = new URLSearchParams(params); value ? next.set(name, value) : next.delete(name); if (name !== "page") next.delete("page"); setParams(next); };
  const submit = (event: FormEvent) => { event.preventDefault(); update("search", search.trim()); };
  return <section className="page-section"><div className="page-title"><p className="eyebrow">Explore the marketplace</p><h1>All products</h1><p>Search, filter, and compare products currently available in our catalog.</p></div><div className="catalog-toolbar"><form onSubmit={submit}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" /><button className="primary-button">Search</button></form><select value={params.get("categoryId") ?? ""} onChange={(e) => update("categoryId", e.target.value)}><option value="">All categories</option>{lookups.data?.categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={params.get("brandId") ?? ""} onChange={(e) => update("brandId", e.target.value)}><option value="">All brands</option>{lookups.data?.brands.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={sort} onChange={(e) => update("sort", e.target.value)}><option value="newest">Newest</option><option value="name">Name A–Z</option><option value="priceLow">Price: low to high</option><option value="priceHigh">Price: high to low</option></select>{params.toString() && <button className="clear-button" onClick={() => { setSearch(""); setParams({}); }}>Clear filters</button>}</div>
    {query.isLoading ? <div className="product-grid">{Array.from({length:8}).map((_, i) => <div className="product-skeleton" key={i} />)}</div> : query.isError ? <div className="state-card">The catalog could not be loaded. Please try again.</div> : !query.data?.items.length ? <div className="state-card"><h2>No matching products</h2><p>Try removing a filter or searching with another term.</p></div> : <><div className="results-meta">Showing {query.data.items.length} of {query.data.totalCount} products</div><div className="product-grid">{query.data.items.map((product) => <ProductCard key={product.id} product={product} />)}</div><div className="pagination"><button disabled={!query.data.hasPreviousPage} onClick={() => update("page", String(page - 1))}>Previous</button><span>Page {query.data.page} of {query.data.totalPages}</span><button disabled={!query.data.hasNextPage} onClick={() => update("page", String(page + 1))}>Next</button></div></>}
  </section>;
}
