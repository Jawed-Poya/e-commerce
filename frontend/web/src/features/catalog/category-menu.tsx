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
          className="mr-8 min-w-52 justify-between rounded-md"
        >
          <span className="flex items-center gap-2">
            <Menu /> Browse categories
          </span>
          <ChevronDown />
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-50 w-[min(960px,calc(100vw-4rem))] overflow-hidden rounded-lg border bg-background text-foreground shadow-xl"
        >
          {lookups.isLoading ? (
            <div className="grid min-h-80 place-items-center text-sm text-muted-foreground">
              Loading categories...
            </div>
          ) : roots.length === 0 ? (
            <div className="grid min-h-52 place-items-center p-8 text-center">
              <span>
                <ShoppingBag className="mx-auto mb-3 size-6 text-muted-foreground" />
                <b className="block">No categories available</b>
                <small className="mt-1 block text-muted-foreground">
                  Categories will appear here when they are configured.
                </small>
              </span>
            </div>
          ) : (
            <div className="grid min-h-[390px] grid-cols-[250px_1fr]">
              <div className="border-r bg-muted/30 p-2">
                {roots.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onMouseEnter={() => setActiveId(category.id)}
                    onFocus={() => setActiveId(category.id)}
                    onClick={() => setActiveId(category.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left text-sm transition-colors",
                      category.id === active?.id
                        ? "bg-background font-semibold text-primary"
                        : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{category.name}</span>
                      <small className="font-normal text-muted-foreground">
                        {category.productCount} products
                      </small>
                    </span>
                    <ChevronRight className="size-4 shrink-0" />
                  </button>
                ))}
              </div>

              {active && (
                <div className="p-6">
                  <div className="flex items-center justify-between gap-5 border-b pb-5">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                        {active.imageUrl ? (
                          <img
                            src={imageUrl(active.imageUrl) ?? ""}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <ShoppingBag className="size-5 text-muted-foreground" />
                        )}
                      </span>
                      <span>
                        <small className="font-semibold uppercase tracking-widest text-primary">
                          Category
                        </small>
                        <h2 className="mt-1 text-xl font-black">
                          {active.name}
                        </h2>
                      </span>
                    </div>
                    <DropdownMenu.Item asChild>
                      <Link
                        to={`/products?categoryId=${active.id}`}
                        className="flex shrink-0 items-center gap-2 text-sm font-semibold text-primary outline-none hover:underline"
                      >
                        View all <ArrowRight className="size-4" />
                      </Link>
                    </DropdownMenu.Item>
                  </div>

                  {active.children.length > 0 ? (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-7 pt-6 lg:grid-cols-3">
                      {active.children.map((subcategory) => (
                        <div key={subcategory.id}>
                          <DropdownMenu.Item asChild>
                            <Link
                              to={`/products?categoryId=${subcategory.id}`}
                              className="font-bold outline-none hover:text-primary"
                            >
                              {subcategory.name}
                            </Link>
                          </DropdownMenu.Item>
                          {subcategory.children.length > 0 ? (
                            <div className="mt-3 grid gap-2">
                              {subcategory.children.map((child) => (
                                <DropdownMenu.Item key={child.id} asChild>
                                  <Link
                                    to={`/products?categoryId=${child.id}`}
                                    className="text-sm text-muted-foreground outline-none hover:text-primary"
                                  >
                                    {child.name}
                                  </Link>
                                </DropdownMenu.Item>
                              ))}
                            </div>
                          ) : (
                            <small className="mt-2 block text-muted-foreground">
                              {subcategory.productCount} products
                            </small>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid min-h-52 place-items-center text-center">
                      <span>
                        <p className="font-semibold">Browse {active.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          This category does not have subcategories yet.
                        </p>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
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

  if (roots.length === 0) return null;

  return (
    <div className="mt-6 border-t pt-6">
      <p className="mb-3 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Shop by category
      </p>
      <div className="grid gap-4">
        {roots.map((category) => (
          <MobileCategoryBranch
            key={category.id}
            category={category}
            onNavigate={onNavigate}
          />
        ))}
      </div>
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
    <div>
      <Link
        to={`/products?categoryId=${category.id}`}
        onClick={onNavigate}
        className="flex items-center justify-between rounded-md px-2 py-1.5 font-semibold hover:bg-muted"
      >
        {category.name}
        <span className="text-xs font-normal text-muted-foreground">
          {category.productCount}
        </span>
      </Link>
      {category.children.length > 0 && (
        <div className="ms-3 mt-1 grid border-s ps-3">
          {category.children.map((child) => (
            <Link
              key={child.id}
              to={`/products?categoryId=${child.id}`}
              onClick={onNavigate}
              className="py-1.5 text-sm text-muted-foreground hover:text-primary"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
