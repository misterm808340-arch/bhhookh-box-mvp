import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeCategories, subscribeProducts } from '../lib/catalog';
import type { Category, FoodItem } from '../types';

/**
 * Live menu catalogue shared by every screen.
 *
 * Filtering rules (mirrors the product requirements):
 *   - disabled categories are hidden from customers
 *   - unavailable products are hidden from normal ordering
 *   - products whose category is disabled are hidden as well
 */
interface CatalogContextValue {
  loading: boolean;
  error: string | null;
  /** Enabled categories only, admin sort order. */
  categories: Category[];
  /** Available products whose category is enabled, admin sort order. */
  products: FoodItem[];
  categoryById: (categoryId: string) => Category | undefined;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let pending = 2;
    const settle = () => {
      if (active && --pending === 0) setLoading(false);
    };
    const fail = (message: string) => {
      if (active) {
        setError('Could not load the menu. Please check your internet connection.');
        setLoading(false);
      }
    };

    const unsubCategories = subscribeCategories((list) => {
      if (!active) return;
      setAllCategories(list);
      setError(null);
      settle();
    }, fail);

    const unsubProducts = subscribeProducts((list) => {
      if (!active) return;
      setAllProducts(list);
      setError(null);
      settle();
    }, fail);

    return () => {
      active = false;
      unsubCategories();
      unsubProducts();
    };
  }, []);

  const value = useMemo<CatalogContextValue>(() => {
    const enabledCategories = allCategories.filter((category) => category.enabled);
    const enabledIds = new Set(enabledCategories.map((category) => category.id));
    const visibleProducts = allProducts.filter(
      (product) => product.available && enabledIds.has(product.categoryId)
    );
    return {
      loading,
      error,
      categories: enabledCategories,
      products: visibleProducts,
      categoryById: (categoryId: string) => allCategories.find((c) => c.id === categoryId),
    };
  }, [allCategories, allProducts, loading, error]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used inside a CatalogProvider.');
  }
  return context;
}
