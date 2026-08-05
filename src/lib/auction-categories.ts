import type { AuctionCategory } from "@/lib/schemas";

export interface AuctionCategoryGroup {
  parent: AuctionCategory;
  children: AuctionCategory[];
}

export interface AuctionCategoryNavigation {
  groups: AuctionCategoryGroup[];
  standalone: AuctionCategory[];
}

const categoryCollator = new Intl.Collator("de-DE", { sensitivity: "base" });

function sortCategories(categories: AuctionCategory[]): AuctionCategory[] {
  return [...categories].sort((left, right) => categoryCollator.compare(left.displayName, right.displayName));
}

export function buildAuctionCategoryNavigation(categories: AuctionCategory[]): AuctionCategoryNavigation {
  const categoriesByName = new Map(categories.map((category) => [category.name, category]));
  const childrenByParent = new Map<string, AuctionCategory[]>();

  categories.forEach((category) => {
    if (!category.parentCategory || !categoriesByName.has(category.parentCategory)) return;
    const children = childrenByParent.get(category.parentCategory) ?? [];
    children.push(category);
    childrenByParent.set(category.parentCategory, children);
  });

  const groups = sortCategories(
    categories.filter((category) => childrenByParent.has(category.name)),
  ).map((parent) => ({
    parent,
    children: sortCategories(childrenByParent.get(parent.name) ?? []),
  }));

  const groupedNames = new Set(groups.flatMap((group) => [
    group.parent.name,
    ...group.children.map((category) => category.name),
  ]));

  return {
    groups,
    standalone: sortCategories(categories.filter((category) => !groupedNames.has(category.name))),
  };
}
