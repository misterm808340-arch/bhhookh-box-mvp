"use client";

import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip background/text. */
  chipClass: string;
  highlight?: boolean;
}

export function StatCard({ label, value, icon: Icon, chipClass, highlight }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm ${
        highlight ? "border-lime-300 ring-1 ring-lime-200" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${chipClass}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold text-brand tabular-nums leading-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}
