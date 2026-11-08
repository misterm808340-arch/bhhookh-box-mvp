"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, type DocumentData } from "firebase/firestore";
import { getFirebase, isFirebaseConfigured } from "@/lib/firebase";
import {
  bySortOrderThenName,
  mapCategory,
  mapProduct,
  type Category,
  type Product,
} from "@/lib/catalog";

/**
 * Live admin catalogue via Firestore onSnapshot — categories + products in
 * one hook, with per-category product counts and CRUD-friendly callbacks.
 */
export function useCatalog() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    const { db } = getFirebase();
    let pending = 2;

    const settle = () => {
      pending -= 1;
      if (pending === 0) setLoading(false);
    };
    const fail = (err: Error) => {
      setLoading(false);
      setError(err.message);
    };

    const unsubCategories = onSnapshot(
      collection(db, "categories"),
      (snapshot) => {
        setCategories(
          snapshot.docs
            .map(mapCategory)
            .filter((category): category is Category => category !== null)
            .sort(bySortOrderThenName)
        );
        setError(null);
        settle();
      },
      fail
    );
    const unsubProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        setProducts(
          snapshot.docs
            .map(mapProduct)
            .filter((product): product is Product => product !== null)
            .sort(bySortOrderThenName)
        );
        setError(null);
        settle();
      },
      fail
    );
    return () => {
      unsubCategories();
      unsubProducts();
    };
  }, []);

  /** Category document id → number of products assigned. */
  const countsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      map.set(product.categoryId, (map.get(product.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const categoryById = useCallback(
    (id: string) => categories.find((category) => category.id === id),
    [categories]
  );

  return { categories, products, countsByCategory, categoryById, loading, error };
}
