"use client";

import { AlertTriangle, LayoutGrid, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalog } from "@/hooks/use-catalog";
import { CategoriesManager } from "./categories-manager";
import { ProductsManager } from "./products-manager";

/**
 * Admin → Menu tab: category management + product management,
 * both live from Firestore with per-category product counts.
 */
export function MenuSection() {
  const { categories, products, countsByCategory, loading, error } = useCatalog();

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
        <p className="font-semibold text-red-700">Could not load the menu</p>
        <p className="text-sm text-red-600 mt-1 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }

  const enabledCount = categories.filter((category) => category.enabled).length;
  const availableCount = products.filter((product) => product.available).length;

  return (
    <div className="space-y-8">
      <section aria-label="Categories" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-lime-deep" />
              Categories
            </h2>
            <p className="text-sm text-muted-foreground">
              {categories.length} total · {enabledCount} enabled · customers see enabled only
            </p>
          </div>
        </div>
        <CategoriesManager categories={categories} counts={countsByCategory} />
      </section>

      <section aria-label="Products" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand flex items-center gap-2">
              <Package className="h-5 w-5 text-lime-deep" />
              Products
            </h2>
            <p className="text-sm text-muted-foreground">
              {products.length} total · {availableCount} available · filter by category below
            </p>
          </div>
        </div>
        <ProductsManager categories={categories} products={products} counts={countsByCategory} />
      </section>
    </div>
  );
}
