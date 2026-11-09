"use client";

import { useState } from "react";
import {
  Bike,
  Check,
  CircleCheck,
  CircleX,
  Copy,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ASSIGNABLE_STATUSES,
  formatINR,
  formatOrderTime,
  isFreshPending,
  NEXT_ACTION,
  NEXT_ACTION_LABEL,
  timeAgo,
  type Order,
  type OrderStatus,
} from "@/lib/orders";
import { StatusBadge } from "./status-badge";

interface OrderCardProps {
  order: Order;
  drivers: Array<{ uid: string; name: string; active: boolean }>;
  onUpdateStatus: (order: Order, next: OrderStatus) => Promise<void>;
  onAssignDriver: (orderId: string, driverId: string) => Promise<void>;
}

type ActingState =
  | { kind: "advance"; next: OrderStatus }
  | { kind: "reject" }
  | { kind: "cancel" }
  | { kind: "assign" }
  | null;

export function OrderCard({ order, drivers, onUpdateStatus, onAssignDriver }: OrderCardProps) {
  const [acting, setActing] = useState<ActingState>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const nextStatus = NEXT_ACTION[order.status];
  const fresh = isFreshPending(order);
  const canAssign = ASSIGNABLE_STATUSES.includes(order.status);
  const activeDrivers = drivers.filter((driver) => driver.active);
  const terminal = order.status === "Rejected" || order.status === "Cancelled";

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
      const raw = (err as { message?: string }).message ?? "";
      const detail = code.startsWith("functions/") ? raw.replace(/^.*?:\s*/, "") : "";
      toast({
        title: "Update failed",
        description:
          detail ||
          (code === "permission-denied"
            ? "Firestore rejected this update — check the security rules and your admin account."
            : "Please try again."),
        variant: "destructive",
      });
    } finally {
      setActing(null);
      setConfirmingReject(false);
      setConfirmingCancel(false);
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

  function cancel() {
    if (acting) return;
    setActing({ kind: "cancel" });
    void runAction(() => onUpdateStatus(order, "Cancelled"), "Order cancelled");
  }

  async function assign(driverId: string) {
    if (acting) return;
    setActing({ kind: "assign" });
    const label =
      driverId === "" ? "Driver unassigned" : `Driver assigned to ${order.orderId}`;
    await runAction(() => onAssignDriver(order.orderId, driverId), label);
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
            {order.address.receiverName || order.customer.name}
          </p>
          {order.customer.email ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2 truncate">
              <Mail className="h-4 w-4 shrink-0 text-lime-deep" />
              <span className="truncate">{order.customer.email}</span>
            </p>
          ) : null}
          <a
            href={`tel:${order.address.phone || order.customer.phone}`}
            className="text-sm text-muted-foreground hover:text-brand flex items-center gap-2 w-fit"
          >
            <Phone className="h-4 w-4 shrink-0 text-lime-deep" />
            {order.address.phone || order.customer.phone}
          </a>
          <p className="text-sm text-muted-foreground flex items-start gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-lime-deep mt-0.5" />
            <span className="break-words">
              {order.address.label ? `${order.address.label} — ` : ""}
              {order.address.line}
            </span>
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
                key={`${item.productId ?? item.name}-${index}`}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-foreground/90 truncate">
                  <span className="inline-flex items-center justify-center min-w-6 h-6 px-1 rounded-md bg-secondary text-xs font-bold text-brand mr-2 tabular-nums">
                    {item.quantity}×
                  </span>
                  {item.name}
                </span>
                <span className="tabular-nums text-muted-foreground whitespace-nowrap">
                  {formatINR(item.lineTotal || item.unitPrice * item.quantity)}
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

      {/* Cancel / reject reason */}
      {terminal && order.cancelReason ? (
        <p className="mx-4 md:mx-5 mb-3 rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-700">
          {order.status === "Rejected" ? "Rejected" : "Cancelled"}: {order.cancelReason}
        </p>
      ) : null}

      {/* Driver assignment (§9) */}
      {canAssign ? (
        <div className="flex flex-wrap items-center gap-2 px-4 md:px-5 pb-3">
          <span className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1.5">
            <Bike className="h-3.5 w-3.5" /> Delivery partner:
          </span>
          <Select
            value={order.driverId ?? ""}
            onValueChange={(value) => void assign(value)}
            disabled={acting !== null || (activeDrivers.length === 0 && !order.driverId)}
          >
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue
                placeholder={activeDrivers.length === 0 ? "No active drivers — add one in Drivers" : "Assign a driver…"}
              />
            </SelectTrigger>
            <SelectContent>
              {order.driverId ? (
                <SelectItem value="">Unassign</SelectItem>
              ) : null}
              {activeDrivers.map((driver) => (
                <SelectItem key={driver.uid} value={driver.uid}>
                  {driver.name}
                  {order.driverId === driver.uid ? " (current)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {order.driverName ? (
            <span className="text-xs text-muted-foreground">on the road: {order.driverName}</span>
          ) : null}
        </div>
      ) : null}

      {/* Actions */}
      {(nextStatus || order.status === "Order Placed" || order.status === "Accepted" || order.status === "Preparing") && (
        <div className="flex flex-wrap items-center gap-2 px-4 md:px-5 py-3 bg-[#f8faf8] border-t">
          {nextStatus && (
            <Button
              size="sm"
              onClick={advance}
              disabled={acting !== null}
              className="bg-brand hover:bg-brand-deep text-white"
            >
              <CircleCheck className="h-4 w-4" />
              {acting?.kind === "advance"
                ? "Updating…"
                : (NEXT_ACTION_LABEL[order.status] ?? nextStatus)}
            </Button>
          )}

          {order.status === "Order Placed" && !confirmingReject && (
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

          {order.status === "Order Placed" && confirmingReject && (
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
                Keep
              </Button>
            </>
          )}

          {(order.status === "Accepted" || order.status === "Preparing") && !confirmingCancel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmingCancel(true)}
              disabled={acting !== null}
              className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
            >
              <CircleX className="h-4 w-4" />
              Cancel
            </Button>
          )}

          {(order.status === "Accepted" || order.status === "Preparing") && confirmingCancel && (
            <>
              <span className="text-sm font-medium text-rose-700">Cancel this order?</span>
              <Button size="sm" variant="destructive" onClick={cancel} disabled={acting !== null}>
                {acting?.kind === "cancel" ? "Cancelling…" : "Yes, Cancel"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingCancel(false)}
                disabled={acting !== null}
              >
                Keep
              </Button>
            </>
          )}

          {order.status === "Preparing" && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Bike className="h-3.5 w-3.5" /> Assign a driver — they start delivery from their app.
            </span>
          )}
        </div>
      )}
    </article>
  );
}
