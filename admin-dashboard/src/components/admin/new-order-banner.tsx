"use client";

import { BellRing, X } from "lucide-react";
import type { Order } from "@/lib/orders";

export interface NewOrderAlertData {
  count: number;
  latest: Order;
  key: number;
}

/** Slide-in banner shown when new pending orders arrive in real time. */
export function NewOrderBanner({ alert, onDismiss }: { alert: NewOrderAlertData; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="animate-slide-down rounded-xl border border-lime-300 bg-gradient-to-r from-[#f2fcdc] to-white p-4 flex items-center gap-3 shadow-sm"
    >
      <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-brand">
        <BellRing className="h-5 w-5 text-brand-deep" />
        <span className="absolute inset-0 rounded-full animate-alert-pulse" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-brand">
          {alert.count > 1 ? `${alert.count} new orders received` : "New order received"}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          <span className="font-mono font-semibold text-lime-deep">#{alert.latest.orderId}</span>
          {" · "}
          {alert.latest.customer.name}
          {" · "}
          {alert.latest.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-[#e7f3d8] hover:text-brand"
        aria-label="Dismiss new order alert"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
