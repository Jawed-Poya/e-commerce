import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
    ArrowRight,
    ChevronDown,
    ChevronRight,
    Menu,
    ShoppingBag,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { cn } from "../../shared/lib/utils";
import { buildCategoryTree, type CategoryNode } from "./category-tree";
import { useLookups } from "./use-catalog";

export function CategoryMegaMenu() {
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
                    variant="secondary"
                    className="group mr-7 h-10 min-w-56 justify-between rounded-xl border border-primary/15 bg-primary/8 px-3.5 font-bold text-primary shadow-none transition-all hover:border-primary/25 hover:bg-primary/15 hover:text-primary data-[state=open]:border-primary data-[state=open]:bg-primary data-[state=open]:text-primary-foreground dark:bg-primary/10"
                >
                    <span className="flex items-center gap-2.5">
                        <span className="grid size-7 place-items-center rounded-lg border border-primary/10 bg-background/80 shadow-sm transition-colors group-data-[state=open]:border-white/10 group-data-[state=open]:bg-white/15 group-data-[state=open]:text-white">
                            <Menu className="size-4" />
                        </span>
                        Browse categories
                    </span>

                    <ChevronDown className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="start"
                    sideOffset={10}
                    collisionPadding={16}
                    className="z-50 w-[min(1020px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border/80 bg-background/95 text-foreground shadow-[0_32px_90px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:shadow-[0_32px_90px_-20px_rgba(0,0,0,0.65)]"
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
                                        Product departments
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                        Choose a category to explore its
                                        products.
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
                                                        ? "border-primary/15 bg-background text-primary shadow-sm"
                                                        : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/70 hover:text-foreground",
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
                                                            {category.productCount ===
                                                            1
                                                                ? "product"
                                                                : "products"}
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
    return (
        <section className="relative min-w-0 overflow-hidden p-7">
            <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/8 blur-3xl dark:bg-primary/10" />

            <div className="relative flex items-center justify-between gap-6 border-b border-border/70 pb-6">
                <div className="flex min-w-0 items-center gap-4">
                    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-muted shadow-sm">
                        {category.imageUrl ? (
                            <img
                                src={imageUrl(category.imageUrl) ?? ""}
                                alt={category.name}
                                className="size-full object-cover"
                            />
                        ) : (
                            <ShoppingBag className="size-6 text-muted-foreground" />
                        )}
                    </span>

                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-primary">
                            Featured category
                        </p>

                        <h2 className="mt-1 truncate text-2xl font-black tracking-[-0.03em]">
                            {category.name}
                        </h2>

                        <p className="mt-1 text-xs text-muted-foreground">
                            Explore related products and subcategories.
                        </p>
                    </div>
                </div>

                <DropdownMenu.Item asChild>
                    <Link
                        to={`/products?categoryId=${category.id}`}
                        className="group flex shrink-0 items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-bold text-primary shadow-sm outline-none transition-all hover:border-primary/30 hover:bg-primary/5 focus:bg-primary/5"
                    >
                        View all
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </DropdownMenu.Item>
            </div>

            {category.children.length > 0 ? (
                <div className="relative grid grid-cols-2 gap-x-8 gap-y-8 pt-7 lg:grid-cols-3">
                    {category.children.map((subcategory) => (
                        <div key={subcategory.id} className="min-w-0">
                            <DropdownMenu.Item asChild>
                                <Link
                                    to={`/products?categoryId=${subcategory.id}`}
                                    className="group flex items-center justify-between gap-2 rounded-lg text-sm font-bold outline-none transition-colors hover:text-primary focus:text-primary"
                                >
                                    <span className="truncate">
                                        {subcategory.name}
                                    </span>

                                    <ChevronRight className="size-3.5 shrink-0 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                                </Link>
                            </DropdownMenu.Item>

                            {subcategory.children.length > 0 ? (
                                <div className="mt-3 grid gap-2.5">
                                    {subcategory.children.map((child) => (
                                        <DropdownMenu.Item
                                            key={child.id}
                                            asChild
                                        >
                                            <Link
                                                to={`/products?categoryId=${child.id}`}
                                                className="group flex min-w-0 items-center gap-2 text-sm text-muted-foreground outline-none transition-colors hover:text-primary focus:text-primary"
                                            >
                                                <span className="size-1 shrink-0 rounded-full bg-border transition-colors group-hover:bg-primary" />

                                                <span className="truncate">
                                                    {child.name}
                                                </span>
                                            </Link>
                                        </DropdownMenu.Item>
                                    ))}
                                </div>
                            ) : (
                                <small className="mt-2 block text-muted-foreground">
                                    {subcategory.productCount}{" "}
                                    {subcategory.productCount === 1
                                        ? "product"
                                        : "products"}
                                </small>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid min-h-64 place-items-center text-center">
                    <div>
                        <span className="mx-auto grid size-12 place-items-center rounded-2xl border bg-muted/50 text-primary">
                            <ShoppingBag className="size-5" />
                        </span>

                        <p className="mt-4 font-bold">Browse {category.name}</p>

                        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                            This category does not have subcategories yet. You
                            can still view all available products.
                        </p>

                        <DropdownMenu.Item asChild>
                            <Link
                                to={`/products?categoryId=${category.id}`}
                                className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-primary outline-none transition-colors hover:bg-primary/5"
                            >
                                View products
                                <ArrowRight className="size-4" />
                            </Link>
                        </DropdownMenu.Item>
                    </div>
                </div>
            )}
        </section>
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
                    className="size-full object-cover"
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
    return (
        <div className="grid min-h-[420px] place-items-center">
            <div className="text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl border bg-primary/10 text-primary shadow-sm">
                    <ShoppingBag className="size-5 animate-pulse" />
                </span>

                <p className="mt-4 text-sm font-bold">Loading categories...</p>

                <p className="mt-1 text-xs text-muted-foreground">
                    Preparing the product catalog.
                </p>
            </div>
        </div>
    );
}

function EmptyCategories() {
    return (
        <div className="grid min-h-72 place-items-center p-8 text-center">
            <div>
                <span className="mx-auto grid size-14 place-items-center rounded-2xl border bg-muted/50 text-muted-foreground">
                    <ShoppingBag className="size-6" />
                </span>

                <b className="mt-4 block text-base">No categories available</b>

                <small className="mx-auto mt-2 block max-w-xs leading-5 text-muted-foreground">
                    Categories will appear here after they are configured in the
                    product catalog.
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
    return (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <Link
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
                                className="size-full object-cover"
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
                            {category.productCount === 1
                                ? "product"
                                : "products"}
                        </span>
                    </span>
                </span>

                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>

            {category.children.length > 0 && (
                <div className="mx-3 mb-3 grid overflow-hidden rounded-xl border bg-muted/20">
                    {category.children.map((child, index) => (
                        <Link
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

                            <ChevronRight className="size-3.5 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
