import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { CartLine, FoodItem } from '../types';
import { computeTotals } from '../lib/orders';

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  quantityOf: (itemId: string) => number;
  addItem: (item: FoodItem) => void;
  increment: (itemId: string) => void;
  decrement: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const addItem = useCallback((item: FoodItem) => {
    setLines((current) => {
      const existing = current.find((line) => line.item.id === item.id);
      if (existing) {
        return current.map((line) =>
          line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, { item, quantity: 1 }];
    });
  }, []);

  const increment = useCallback((itemId: string) => {
    setLines((current) =>
      current.map((line) =>
        line.item.id === itemId ? { ...line, quantity: Math.min(line.quantity + 1, 50) } : line
      )
    );
  }, []);

  const decrement = useCallback((itemId: string) => {
    setLines((current) =>
      current
        .map((line) => (line.item.id === itemId ? { ...line, quantity: line.quantity - 1 } : line))
        .filter((line) => line.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setLines((current) => current.filter((line) => line.item.id !== itemId));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const quantityOf = useCallback(
    (itemId: string) => lines.find((line) => line.item.id === itemId)?.quantity ?? 0,
    [lines]
  );

  const value = useMemo<CartContextValue>(() => {
    const totals = computeTotals(lines);
    return {
      lines,
      itemCount: totals.itemCount,
      subtotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      total: totals.total,
      quantityOf,
      addItem,
      increment,
      decrement,
      removeItem,
      clearCart,
    };
  }, [lines, quantityOf, addItem, increment, decrement, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside a CartProvider.');
  }
  return context;
}
