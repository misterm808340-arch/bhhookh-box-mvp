import type { OrderStatus } from "@/lib/orders";

const STATUS_STYLES: Record<OrderStatus, string> = {
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  Accepted: "bg-teal-100 text-teal-800 border-teal-200",
  Preparing: "bg-violet-100 text-violet-800 border-violet-200",
  "Out for Delivery": "bg-sky-100 text-sky-800 border-sky-200",
  Delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Rejected: "bg-rose-100 text-rose-700 border-rose-200",
};

const STATUS_DOTS: Record<OrderStatus, string> = {
  Pending: "bg-amber-500",
  Accepted: "bg-teal-500",
  Preparing: "bg-violet-500",
  "Out for Delivery": "bg-sky-500",
  Delivered: "bg-emerald-500",
  Rejected: "bg-rose-500",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[status]}`} />
      {status}
    </span>
  );
}
