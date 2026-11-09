"use client";

import { useMemo, useState } from "react";
import {
  Bike,
  CircleCheck,
  CircleX,
  Clock,
  Flame,
  IndianRupee,
  Inbox,
  PackageCheck,
  ReceiptText,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ASSIGNABLE_STATUSES,
  formatINR,
  formatOrderTime,
  istDayKey,
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
} from "@/lib/orders";
import { StatCard } from "./stat-card";
import { StatusBadge } from "./status-badge";

/**
 * Admin → Reports (§11): today's totals, per-status breakdown and the
 * searchable order history. Cancelled/Rejected orders are NEVER counted as
 * sales — only as volume — mirroring the Cloud Function's ledger.
 */
export function Reports({
  orders,
  loading,
  error,
}: {
  orders: Order[];
  loading: boolean;
  error: string | null;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | OrderStatus>("All");

  const todayKey = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  const counts = useMemo(() => {
    const map = new Map<OrderStatus, number>();
    for (const status of ORDER_STATUSES) map.set(status, 0);
    for (const order of orders) map.set(order.status, (map.get(order.status) ?? 0) + 1);
    return map;
  }, [orders]);

  const today = useMemo(() => {
    const todays = orders.filter((order) => istDayKey(order.createdAt) === todayKey);
    const sales = todays
      .filter((order) => order.status !== "Rejected" && order.status !== "Cancelled")
      .reduce((sum, order) => sum + order.total, 0);
    return { orders: todays.length, sales };
  }, [orders, todayKey]);

  const lifetimeSales = useMemo(
    () =>
      orders
        .filter((order) => order.status !== "Rejected" && order.status !== "Cancelled")
        .reduce((sum, order) => sum + order.total, 0),
    [orders]
  );

  const history = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "All" && order.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        order.orderId.toLowerCase().includes(needle) ||
        order.customer.name.toLowerCase().includes(needle) ||
        order.customer.email.toLowerCase().includes(needle) ||
        order.address.receiverName.toLowerCase().includes(needle) ||
        order.address.phone.includes(needle)
      );
    });
  }, [orders, search, statusFilter]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <CircleX className="h-6 w-6 text-red-500 mx-auto mb-2" />
        <p className="font-semibold text-red-700">Could not load reports</p>
        <p className="text-sm text-red-600 mt-1 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Today + lifetime */}
      <section aria-label="Today" className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Today's Orders" value={today.orders} icon={ReceiptText} chipClass="bg-brand text-white" />
        <StatCard
          label="Today's Sales"
          value={formatINR(today.sales)}
          icon={IndianRupee}
          chipClass="bg-lime-brand text-brand-deep"
        />
        <StatCard label="Lifetime Sales" value={formatINR(lifetimeSales)} icon={IndianRupee} chipClass="bg-brand text-white" />
        <StatCard
          label="Open Orders"
          value={
            (counts.get("Order Placed") ?? 0) +
            (counts.get("Accepted") ?? 0) +
            (counts.get("Preparing") ?? 0) +
            (counts.get("Out for Delivery") ?? 0)
          }
          icon={Clock}
          chipClass="bg-amber-100 text-amber-700"
        />
      </section>

      {/* Status breakdown */}
      <section aria-label="Status breakdown" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Order Placed" value={counts.get("Order Placed") ?? 0} icon={Clock} chipClass="bg-amber-100 text-amber-700" />
        <StatCard label="Accepted" value={counts.get("Accepted") ?? 0} icon={CircleCheck} chipClass="bg-teal-100 text-teal-700" />
        <StatCard label="Preparing" value={counts.get("Preparing") ?? 0} icon={Flame} chipClass="bg-violet-100 text-violet-700" />
        <StatCard label="Out for Delivery" value={counts.get("Out for Delivery") ?? 0} icon={Bike} chipClass="bg-sky-100 text-sky-700" />
        <StatCard label="Delivered" value={counts.get("Delivered") ?? 0} icon={PackageCheck} chipClass="bg-emerald-100 text-emerald-700" />
        <StatCard label="Rejected" value={counts.get("Rejected") ?? 0} icon={CircleX} chipClass="bg-rose-100 text-rose-600" />
        <StatCard label="Cancelled" value={counts.get("Cancelled") ?? 0} icon={CircleX} chipClass="bg-slate-100 text-slate-600" />
      </section>

      {/* Order history */}
      <section aria-label="Order history" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand">Order History</h2>
            <p className="text-sm text-muted-foreground">
              Every order ever placed · {history.length} shown
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ID, name, email, phone…"
                className="pl-8 w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "All" | OrderStatus)}
              className="h-9 rounded-md border border-input bg-white px-2.5 text-sm font-medium text-brand"
              aria-label="Filter by status"
            >
              <option value="All">All statuses</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-[#fbfdfb] p-10 text-center">
            <Inbox className="h-8 w-8 text-lime-deep/60 mx-auto mb-3" />
            <p className="font-semibold text-brand">No orders match</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different search or clear the status filter.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b bg-[#f8faf8] text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Order</th>
                  <th className="px-4 py-2.5 font-semibold">Placed (IST)</th>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Items</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Total</th>
                  <th className="px-4 py-2.5 font-semibold">Payment</th>
                  <th className="px-4 py-2.5 font-semibold">Driver</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((order) => (
                  <tr key={order.id} className="hover:bg-[#fafcf9]">
                    <td className="px-4 py-2.5 font-mono font-bold text-brand whitespace-nowrap">
                      #{order.orderId}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatOrderTime(order.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 max-w-44">
                      <p className="font-medium text-foreground truncate">
                        {order.address.receiverName || order.customer.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.customer.email || order.address.phone}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums text-brand whitespace-nowrap">
                      {formatINR(order.total)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {order.paymentMethod === "COD" ? "COD" : order.paymentMethod}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {order.driverName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Sales figures exclude Rejected and Cancelled orders. Driver assignment is available for
          orders in {ASSIGNABLE_STATUSES.join(" / ")} from the Orders tab.
        </p>
      </section>
    </div>
  );
}
