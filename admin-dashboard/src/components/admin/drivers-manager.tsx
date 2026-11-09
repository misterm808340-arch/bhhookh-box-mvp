"use client";

import { useState } from "react";
import { Bike, Loader2, Plus, ShieldBan, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { callableErrorMessage } from "@/lib/firebase";
import { useDrivers, type DriverRow } from "@/hooks/use-drivers";

/**
 * Admin → Drivers tab (§9): create driver accounts, enable/disable them and
 * delete them. Accounts are real Firebase Auth users created by the
 * `createDriver` Cloud Function with a temporary password the admin shares
 * with the rider; the driver signs into the SAME Android app and lands in the
 * driver console.
 */
export function DriversManager() {
  const { drivers, loading, error, createDriver, setDriverActive, deleteDriver } =
    useDrivers(true);
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DriverRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function submitCreate() {
    if (creating) return;
    if (name.trim().length < 2) {
      toast({ title: "Enter the driver's full name", variant: "destructive" });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast({ title: "Enter a valid driver email", variant: "destructive" });
      return;
    }
    if (!/^\d{10}$/.test(phone.trim())) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({
        title: "Temporary password too short",
        description: "Use at least 6 characters — the rider can change it later.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      await createDriver({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });
      toast({
        title: "Driver created",
        description: `${name.trim()} can now sign in to the app with the temporary password.`,
      });
      setCreateOpen(false);
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
    } catch (err) {
      toast({ title: "Could not create driver", description: callableErrorMessage(err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(driver: DriverRow) {
    setTogglingId(driver.uid);
    try {
      await setDriverActive(driver.uid, !driver.active);
      toast({
        title: driver.active ? "Driver disabled" : "Driver enabled",
        description: driver.active
          ? `${driver.name} can no longer act on orders.`
          : `${driver.name} is back on the road.`,
      });
    } catch (err) {
      toast({ title: "Could not update driver", description: callableErrorMessage(err), variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDriver(deleteTarget.uid);
      toast({ title: "Driver deleted", description: `${deleteTarget.name} was removed.` });
      setDeleteTarget(null);
    } catch (err) {
      toast({ title: "Could not delete driver", description: callableErrorMessage(err), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <ShieldBan className="h-6 w-6 text-red-500 mx-auto mb-2" />
        <p className="font-semibold text-red-700">Driver roster unavailable</p>
        <p className="text-sm text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading drivers…" : `${drivers.length} driver${drivers.length === 1 ? "" : "s"} · ${drivers.filter((d) => d.active).length} active`}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-brand hover:bg-brand-deep text-white">
          <Plus className="h-4 w-4" /> Add Driver
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : drivers.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-[#fbfdfb] p-10 text-center">
          <Bike className="h-8 w-8 text-lime-deep/60 mx-auto mb-3" />
          <p className="font-semibold text-brand">No drivers yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Add a driver account, share the temporary password with the rider, and they sign in
            to the same BHHOOKH BOX app to receive deliveries.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white divide-y">
          {drivers.map((driver) => (
            <div key={driver.uid} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="h-9 w-9 rounded-lg bg-lime-brand/30 border border-lime-200 flex items-center justify-center">
                <Bike className="h-4.5 w-4.5 text-brand" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-brand text-sm flex items-center gap-2">
                  {driver.name}
                  {driver.active ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                      Active
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100">
                      Disabled
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {driver.email} · +91 {driver.phone}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={togglingId === driver.uid}
                onClick={() => void toggleActive(driver)}
                className={driver.active ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}
              >
                {togglingId === driver.uid ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : driver.active ? (
                  <ShieldBan className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {driver.active ? "Disable" : "Enable"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeleteTarget(driver)}
                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a delivery driver</DialogTitle>
            <DialogDescription>
              Creates a real Firebase Auth account + driver profile. Share the temporary password
              with the rider — they sign in to the BHHOOKH BOX app and land in the delivery console.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="driver-name">Full name</Label>
              <Input id="driver-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ravi Kumar" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="driver-email">Login email</Label>
              <Input id="driver-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ravi@bhhookhbox.in" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="driver-phone">Mobile number</Label>
              <Input
                id="driver-phone"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="driver-password">Temporary password</Label>
              <Input id="driver-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 characters" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={() => void submitCreate()} disabled={creating} className="bg-brand hover:bg-brand-deep text-white">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Driver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation (§14) */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the driver&apos;s login and profile permanently. Orders already
              delivered keep their history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Driver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
