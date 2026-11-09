"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bike,
  CircleX,
  Clock,
  Flame,
  IndianRupee,
  LayoutGrid,
  LogOut,
  PackageCheck,
  ReceiptText,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAdminOrders } from "@/hooks/use-admin-orders";
import { useDrivers } from "@/hooks/use-drivers";
import { ensureAudioUnlocked, playNewOrderChime } from "@/lib/sound";
import { formatINR, type Order } from "@/lib/orders";
import { StatCard } from "./stat-card";
import { NewOrderBanner, type NewOrderAlertData } from "./new-order-banner";
import { OrdersBoard } from "./orders-board";
import { MenuSection } from "./menu-section";
import { DriversManager } from "./drivers-manager";
import { Reports } from "./reports";

type DashboardTab = "orders" | "menu" | "drivers" | "reports";

const SOUND_STORAGE_KEY = "bhb-admin-sound-enabled";

interface DashboardProps {
  userEmail: string;
  onSignOut: () => Promise<void>;
}

export function AdminDashboard({ userEmail, onSignOut }: DashboardProps) {
  const [soundOn, setSoundOn] = useState(false);
  const [newAlert, setNewAlert] = useState<NewOrderAlertData | null>(null);
  const [tab, setTab] = useState<DashboardTab>("orders");
  const soundRef = useRef(false);
  const { toast } = useToast();

  // Restore the persisted sound preference once on mount (deferred so the
  // first client render matches the server render exactly).
  useEffect(() => {
    if (window.localStorage.getItem(SOUND_STORAGE_KEY) !== "on") return;
    const timer = window.setTimeout(() => setSoundOn(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleNewOrder = useCallback((latest: Order, count: number) => {
    setNewAlert({ count, latest, key: Date.now() });
    if (soundRef.current) {
      ensureAudioUnlocked();
      playNewOrderChime();
    }
  }, []);

  const { orders, loading, error, stats, updateOrderStatus, assignDriver } = useAdminOrders(
    true,
    handleNewOrder
  );
  const { drivers } = useDrivers(true);

  const driverOptions = drivers.map((driver) => ({
    uid: driver.uid,
    name: driver.name,
    active: driver.active,
  }));

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    soundRef.current = next;
    window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "on" : "off");
    if (next) {
      const unlocked = ensureAudioUnlocked();
      playNewOrderChime(); // immediate audible feedback (also unlocks the context)
      toast({
        title: unlocked ? "Sound notifications enabled" : "Sound needs one more click",
        description: unlocked
          ? "You will hear a chime when a new order arrives."
          : "Your browser blocked audio once — click the toggle again if you don't hear the chime.",
      });
    } else {
      toast({ title: "Sound notifications muted" });
    }
  }

  // Keep the ref in sync whenever state changes (e.g. after mount restore).
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  return (
    <div className="min-h-screen bg-[#f6f9f6] flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center gap-3">
          <img
            src="/logo-bhhookh.png"
            alt="BHHOOKH BOX logo"
            className="h-10 w-10 rounded-lg border shadow-sm"
          />
          <div className="min-w-0">
            <p className="font-extrabold text-brand tracking-tight leading-tight truncate">
              BHHOOKH BOX <span className="text-lime-deep font-bold">· Admin</span>
            </p>
            <p className="hidden sm:block text-[11px] text-muted-foreground leading-tight">
              Live order management console
            </p>
          </div>

          <span className="ml-auto hidden md:inline-flex items-center gap-1.5 rounded-full border border-lime-300 bg-[#f4f9e8] px-3 py-1 text-xs font-semibold text-lime-deep">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-lime-brand opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500" />
            </span>
            Live · Firestore
          </span>

          {/* Section switcher: orders ↔ menu ↔ drivers ↔ reports */}
          <div className="flex rounded-full border border-input bg-white p-0.5">
            {(
              [
                ["orders", ReceiptText, "Orders"],
                ["menu", LayoutGrid, "Menu"],
                ["drivers", Users, "Drivers"],
                ["reports", IndianRupee, "Reports"],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  tab === value ? "bg-brand text-white" : "text-muted-foreground hover:text-brand"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}
            title={soundOn ? "Mute new-order sound" : "Enable new-order sound"}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              soundOn
                ? "border-lime-300 bg-lime-brand text-brand-deep"
                : "border-input bg-white text-muted-foreground hover:text-brand"
            }`}
          >
            {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {soundOn ? "Sound On" : "Sound Off"}
          </button>

          <span className="hidden lg:block max-w-52 truncate text-xs text-muted-foreground">
            {userEmail}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void onSignOut()}
            className="border-brand/30 text-brand hover:bg-brand hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {newAlert && (
          <NewOrderBanner alert={newAlert} onDismiss={() => setNewAlert(null)} />
        )}

        {tab === "orders" ? (
          <>
        {/* Overview stats */}
        <section aria-label="Overview" className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard label="Total Orders" value={stats.total} icon={ReceiptText} chipClass="bg-brand text-white" />
          <StatCard
            label="New / Order Placed"
            value={stats.orderPlaced}
            icon={Clock}
            chipClass="bg-amber-100 text-amber-700"
            highlight={stats.orderPlaced > 0}
          />
          <StatCard label="Preparing" value={stats.preparing} icon={Flame} chipClass="bg-violet-100 text-violet-700" />
          <StatCard label="Out for Delivery" value={stats.outForDelivery} icon={Bike} chipClass="bg-sky-100 text-sky-700" />
          <StatCard
            label="Today's Sales"
            value={formatINR(stats.todaySales)}
            icon={IndianRupee}
            chipClass="bg-lime-brand text-brand-deep"
          />
          <StatCard label="Delivered (all time)" value={stats.delivered} icon={PackageCheck} chipClass="bg-emerald-100 text-emerald-700" />
          <StatCard label="Rejected" value={stats.rejected} icon={CircleX} chipClass="bg-rose-100 text-rose-600" />
          <StatCard label="Cancelled" value={stats.cancelled} icon={CircleX} chipClass="bg-slate-100 text-slate-600" />
        </section>

        {/* Live orders */}
        <section aria-label="Orders" className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-brand">Live Orders</h2>
              <p className="text-sm text-muted-foreground">
                Streamed in real time from Firestore · newest first · accepted totals ₹{formatINR(stats.totalValue)}
              </p>
            </div>
          </div>
          <OrdersBoard
            orders={orders}
            drivers={driverOptions}
            loading={loading}
            error={error}
            onUpdateStatus={updateOrderStatus}
            onAssignDriver={assignDriver}
          />
        </section>
          </>
        ) : tab === "menu" ? (
          <MenuSection />
        ) : tab === "drivers" ? (
          <DriversManager />
        ) : (
          <Reports orders={orders} loading={loading} error={error} />
        )}
      </main>

      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>BHHOOKH BOX Admin Dashboard · MVP</span>
          <span>Firestore real-time · Firebase Auth secured</span>
        </div>
      </footer>
    </div>
  );
}
