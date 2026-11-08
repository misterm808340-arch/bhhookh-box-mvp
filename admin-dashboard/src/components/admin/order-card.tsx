"use client";

import { useState } from "react";
import {
  Bike,
  Check,
  CircleCheck,
  CircleX,
  Copy,
  MapPin,
  Phone,
  ReceiptText,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  formatINR,
  formatOrderTime,
  isFreshPending,
  NEXT_ACTION_LABEL,
  STATUS_FLOW,
  timeAgo,
  type Order,
  type OrderStatus,
} from "@/lib/orders";
import { StatusBadge } from "./status-badge";

interface OrderCardProps {
  order: Order;
  onUpdateStatus: (order: Order, next: OrderStatus) => Promise<void>;
}

type ActingState = { kind: "advance"; next: OrderStatus } | { kind: "reject" } | null;

export function OrderCard({ order, onUpdateStatus }: OrderCardProps) {
  const [acting, setActing] = useState<ActingState>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const nextStatus = STATUS_FLOW[order.status];
  const fresh = isFreshPending(order);

  async function copyOrderId() {
    try {
      await navigator.clipboard.writeText(order.orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Could not copy order ID", variant: "destructive" });
    }
  }

  async function runAction(action: () => Promise<void>, successTitle: string) {
    try {
      await action();
      toast({ title: successTitle, description: `${order.orderId} · ${order.customer.name}` });
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      toast({
        title: "Update failed",
        description:
          code === "permission-denied"
            ? "Firestore rejected this update — check the security rules and your admin account."
            : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActing(null);
      setConfirmingReject(false);
    }
  }

  function advance() {
    if (!nextStatus || acting) return;
    setActing({ kind: "advance", next: nextStatus });
    void runAction(
      () => onUpdateStatus(order, nextStatus),
      nextStatus === "Delivered" ? "Order delivered" : `Order moved to ${nextStatus}`
    );
  }

  function reject() {
    if (acting) return;
    setActing({ kind: "reject" });
    void runAction(() => onUpdateStatus(order, "Rejected"), "Order rejected");
  }

  return (
    <article
      className={`rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
        fresh ? "border-lime-400 border-l-4" : ""
      }`}
    >
      {/* Card header */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-5 pt-4 pb-3 border-b border-dashed">
        <ReceiptText className="h-4 w-4 text-lime-deep shrink-0" />
        <button
          type="button"
          onClick={copyOrderId}
          className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-brand hover:text-lime-deep transition-colors"
          title="Copy order ID"
        >
          #{order.orderId}
          {copied ? (
            <Check className="h-3.5 w-3.5 text-lime-deep" />
          ) : (
            <Copy className="h-3 w-3 opacity-50" />
          )}
        </button>
        {fresh && (
          <span className="inline-flex items-center rounded-full bg-lime-brand px-2 py-0.5 text-[11px] font-extrabold text-brand-deep tracking-wide animate-alert-pulse">
            NEW
          </span>
        )}
        <StatusBadge status={order.status} />
        <span className="ml-auto text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {formatOrderTime(order.createdAt)} · {timeAgo(order.createdAt)}
        </span>
      </div>

      {/* Card body */}
      <div className="grid gap-4 px-4 md:px-5 py-4 md:grid-cols-[1.1fr_1.2fr_0.9fr]">
        {/* Customer */}
        <div className="space-y-2 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Customer
          </p>
          <p className="font-semibold text-brand flex items-center gap-2 truncate">
            <User className="h-4 w-4 shrink-0 text-lime-deep" />
            {order.customer.name}
          </p>
          <a
            href={`tel:${order.customer.phone}`}
            className="text-sm text-muted-foreground hover:text-brand flex items-center gap-2 w-fit"
          >
            <Phone className="h-4 w-4 shrink-0 text-lime-deep" />
            {order.customer.phone}
          </a>
          <p className="text-sm text-muted-foreground flex items-start gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-lime-deep mt-0.5" />
            <span className="break-words">{order.customer.address}</span>
          </p>
        </div>

        {/* Items */}
        <div className="space-y-2 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Items ({order.items.reduce((sum, item) => sum + item.quantity, 0)})
          </p>
          <ul className="space-y-1.5">
            {order.items.map((item, index) => (
              <li
                key={`${item.name}-${index}`}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-foreground/90 truncate">
                  <span className="inline-flex items-center justify-center min-w-6 h-6 px-1 rounded-md bg-secondary text-xs font-bold text-brand mr-2 tabular-nums">
                    {item.quantity}×
                  </span>
                  {item.name}
                </span>
                <span className="tabular-nums text-muted-foreground whitespace-nowrap">
                  {formatINR(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Amounts */}
        <div className="space-y-1.5 md:border-l md:border-dashed md:pl-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Bill
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatINR(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery</span>
            <span className="tabular-nums">{formatINR(order.deliveryFee)}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-dashed">
            <span className="text-sm font-semibold text-brand">Total</span>
            <span className="font-extrabold text-brand tabular-nums">{formatINR(order.total)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Payment: {order.paymentMethod === "COD" ? "Cash on Delivery" : order.paymentMethod}
          </p>
        </div>
      </div>

      {/* Actions */}
      {(nextStatus || order.status === "Pending") && (
        <div className="flex flex-wrap items-center gap-2 px-4 md:px-5 py-3 bg-[#f8faf8] border-t">
          {nextStatus && (
            <Button
              size="sm"
              onClick={advance}
              disabled={acting !== null}
              className="bg-brand hover:bg-brand-deep text-white"
            >
              {acting?.kind === "advance" ? (
                <CircleCheck className="h-4 w-4 animate-pulse" />
              ) : (
                <CircleCheck className="h-4 w-4" />
              )}
              {acting?.kind === "advance"
                ? "Updating…"
                : nextStatus === "Delivered"
                  ? "Mark Delivered"
                  : (NEXT_ACTION_LABEL[order.status] ?? nextStatus)}
            </Button>
          )}

          {order.status === "Pending" && !confirmingReject && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmingReject(true)}
              disabled={acting !== null}
              className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <CircleX className="h-4 w-4" />
              Reject
            </Button>
          )}

          {order.status === "Pending" && confirmingReject && (
            <>
              <span className="text-sm font-medium text-rose-700">Reject this order?</span>
              <Button size="sm" variant="destructive" onClick={reject} disabled={acting !== null}>
                {acting?.kind === "reject" ? "Rejecting…" : "Yes, Reject"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingReject(false)}
                disabled={acting !== null}
              >
                Cancel
              </Button>
            </>
          )}

          {order.status === "Preparing" && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Bike className="h-3.5 w-3.5" /> Hand over to the delivery partner when ready.
            </span>
          )}
        </div>
      )}
    </article>
  );
}
