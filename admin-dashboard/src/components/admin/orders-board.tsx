"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Inbox, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ORDER_STATUSES, type Order, type OrderStatus } from "@/lib/orders";
import { OrderCard } from "./order-card";

type Filter = "All" | OrderStatus;

const FILTERS: Filter[] = ["All", ...ORDER_STATUSES];

interface OrdersBoardProps {
  orders: Order[];
  loading: boolean;
  error: string | null;
  onUpdateStatus: (order: Order, next: OrderStatus) => Promise<void>;
}

export function OrdersBoard({ orders, loading, error, onUpdateStatus }: OrdersBoardProps) {
  const [filter, setFilter] = useState<Filter>("All");

  const counts = useMemo(() => {
    const map = new Map<Filter, number>();
    map.set("All", orders.length);
    for (const status of ORDER_STATUSES) {
      map.set(status, orders.filter((order) => order.status === status).length);
    }
    return map;
  }, [orders]);

  const visible = useMemo(
    () => (filter === "All" ? orders : orders.filter((order) => order.status === filter)),
    [orders, filter]
  );

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
        <p className="font-semibold text-red-700">Live connection problem</p>
        <p className="text-sm text-red-600 mt-1 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="rounded-xl border bg-white p-5 space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 ml-auto" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status filter chips */}
      <div className="flex gap-2 overflow-x-auto slim-scroll pb-1 -mx-1 px-1">
        {FILTERS.map((status) => {
          const active = filter === status;
          const count = counts.get(status) ?? 0;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand text-white border-brand shadow-sm"
                  : "bg-white text-brand border-input hover:border-lime-deep hover:bg-[#f4f9ee]"
              }`}
            >
              {status}
              <span
                className={`text-xs tabular-nums rounded-full px-1.5 ${
                  active ? "bg-white/20" : "bg-secondary text-lime-deep"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-[#fbfdfb] p-10 text-center">
          {filter === "All" ? (
            <>
              <Inbox className="h-8 w-8 text-lime-deep/60 mx-auto mb-3" />
              <p className="font-semibold text-brand">No orders yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Place an order from the BHHOOKH BOX Android app — it will appear here instantly,
                in real time.
              </p>
            </>
          ) : (
            <>
              <WifiOff className="h-8 w-8 text-lime-deep/60 mx-auto mb-3" />
              <p className="font-semibold text-brand">No {filter} orders right now</p>
              <p className="text-sm text-muted-foreground mt-1">
                New orders in this status will show up automatically.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 border-brand text-brand hover:bg-brand hover:text-white"
                onClick={() => setFilter("All")}
              >
                Show all orders
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} onUpdateStatus={onUpdateStatus} />
          ))}
        </div>
      )}
    </div>
  );
}
