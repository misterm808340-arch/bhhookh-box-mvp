"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { Bike, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { callableErrorMessage, getFirebase, isFirebaseConfigured } from "@/lib/firebase";

/**
 * Admin → Delivery settings: the flat delivery fee the WHOLE system uses.
 *
 * Single source of truth: Firestore `settings/app.deliveryFee`.
 * - The customer app reads it for display (`fetchDeliveryFee`).
 * - The `createOrder` Cloud Function charges it server-side (validated again:
 *   0–500, integer) — the client never decides the fee.
 * Rules allow admin-only writes with exactly this shape.
 */
const DEFAULT_FEE = 20;

export function DeliverySettingsCard() {
  const [fee, setFee] = useState<string>("");
  const [loading, setLoading] = useState(isFirebaseConfigured());
  const [saving, setSaving] = useState(false);
  const [initialised, setInitialised] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    const { db } = getFirebase();
    const unsubscribe = onSnapshot(
      doc(db, "settings", "app"),
      (snapshot) => {
        const value = Number(snapshot.data()?.deliveryFee);
        setFee(
          String(
            Number.isFinite(value) && value >= 0 && value <= 500 ? Math.round(value) : DEFAULT_FEE
          )
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (loading || initialised) return;
    setInitialised(true);
  }, [loading, initialised]);

  async function handleSave() {
    const parsedFee = Math.round(Number(fee));
    if (!Number.isFinite(parsedFee) || parsedFee < 0 || parsedFee > 500) {
      toast({
        title: "Check the delivery fee",
        description: "Enter a whole amount between ₹0 and ₹500.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { db } = getFirebase();
      await setDoc(
        doc(db, "settings", "app"),
        { deliveryFee: parsedFee, updatedAt: serverTimestamp() },
        { merge: true }
      );
      toast({
        title: "Delivery fee saved",
        description: `₹${parsedFee} applies to every new order, charged server-side.`,
      });
    } catch (error) {
      toast({
        title: "Could not save the delivery fee",
        description: callableErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Delivery settings" className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bike className="h-4.5 w-4.5 text-lime-deep" />
        <div>
          <h3 className="font-bold text-brand text-sm">Delivery fee</h3>
          <p className="text-[11px] text-muted-foreground">
            Shown in the customer checkout and charged by the server when the order is created.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 max-w-md">
        <div className="grid gap-1.5">
          <Label htmlFor="cfg-fee" className="text-xs">
            Flat delivery fee (₹)
          </Label>
          <Input
            id="cfg-fee"
            type="number"
            min={0}
            max={500}
            value={fee}
            onChange={(event) => setFee(event.target.value.replace(/\D/g, "").slice(0, 4))}
            disabled={loading || !isFirebaseConfigured()}
            className="h-9 w-32"
          />
        </div>
        <Button
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving || loading || !isFirebaseConfigured()}
          className="bg-brand text-white hover:bg-brand/90"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save fee
        </Button>
      </div>
    </section>
  );
}
