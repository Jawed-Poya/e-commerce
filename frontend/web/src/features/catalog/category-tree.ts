import type { CategoryLookup } from "../../shared/types/product";

export type CategoryNode = CategoryLookup & {
  children: CategoryNode[];
};

export function buildCategoryTree(categories: CategoryLookup[]) {
  const ids = new Set(categories.map((category) => category.id));
  const childrenByParent = new Map<number, CategoryLookup[]>();

  categories.forEach((category) => {
    if (category.parentId == null) return;

    const children = childrenByParent.get(category.parentId) ?? [];
    children.push(category);
    childrenByParent.set(category.parentId, children);
  });

  const visit = (category: CategoryLookup, path: Set<number>): CategoryNode => {
    if (path.has(category.id)) {
      return { ...category, children: [] };
    }

    const nextPath = new Set(path).add(category.id);

    return {
      ...category,
      children: (childrenByParent.get(category.id) ?? []).map((child) =>
        visit(child, nextPath),
      ),
    };
  };

  return categories
    .filter(
      (category) =>
        category.parentId == null || !ids.has(category.parentId),
    )
    .map((category) => visit(category, new Set()));
}

export function flattenCategoryTree(categories: CategoryLookup[]) {
  const result: { category: CategoryNode; depth: number }[] = [];

  const append = (category: CategoryNode, depth: number) => {
    result.push({ category, depth });
    category.children.forEach((child) => append(child, depth + 1));
  };

  buildCategoryTree(categories).forEach((category) => append(category, 0));
  return result;
}
