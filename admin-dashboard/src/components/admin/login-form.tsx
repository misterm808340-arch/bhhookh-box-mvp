"use client";

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Bike,
  BellRing,
} from "lucide-react";
import { getFirebase } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Admin sign-in screen. Credentials are created in the Firebase Console —
 * nothing is hardcoded here. After a successful sign-in we verify that the
 * email is whitelisted in the `admins` Firestore collection; otherwise the
 * user is signed straight back out.
 */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const { auth, db } = getFirebase();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const adminEmail = credential.user.email ?? "";
      const adminDoc = await getDoc(doc(db, "admins", adminEmail));
      if (!adminDoc.exists()) {
        await signOut(auth);
        setError(
          "This account is not an authorized admin. Ask the project owner to add a document with this email to the 'admins' collection in Firestore."
        );
      }
      // On success the onAuthStateChanged listener in use-admin-auth swaps the UI.
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Invalid email or password. Please try again.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a moment and try again.");
      } else if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Sign-in failed. Check your connection and Firebase configuration.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f9f6] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden lg:flex flex-col justify-between bg-brand p-10 overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#a3e635]/15 blur-2xl"
        />
        <div
          aria-hidden
          className="absolute bottom-10 -left-16 h-56 w-56 rounded-full bg-[#a3e635]/10 blur-2xl"
        />
        <div className="relative">
          <div className="flex items-center gap-4">
            <img
              src="/logo-bhhookh.png"
              alt="BHHOOKH BOX logo"
              className="h-16 w-16 rounded-2xl border border-white/15 shadow-lg"
            />
            <div>
              <p className="text-2xl font-extrabold text-white tracking-tight">BHHOOKH BOX</p>
              <p className="text-lime-brand text-sm font-medium tracking-wide">
                Fresh. Fast. Delivered.
              </p>
            </div>
          </div>
        </div>
        <div className="relative space-y-6 max-w-md">
          <h2 className="text-3xl font-bold text-white leading-snug">
            Every order, live from the kitchen to the customer&apos;s door.
          </h2>
          <ul className="space-y-4 text-sm text-white/85">
            <li className="flex items-start gap-3">
              <BellRing className="h-5 w-5 text-lime-brand shrink-0 mt-0.5" />
              Real-time order alerts with instant sound notifications.
            </li>
            <li className="flex items-start gap-3">
              <Bike className="h-5 w-5 text-lime-brand shrink-0 mt-0.5" />
              Move orders through Pending → Accepted → Preparing → Out for Delivery → Delivered.
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-lime-brand shrink-0 mt-0.5" />
              Protected by Firebase Authentication and Firestore security rules.
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-white/50">BHHOOKH BOX Admin · MVP</p>
      </section>

      {/* Sign-in form */}
      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img
              src="/logo-bhhookh.png"
              alt="BHHOOKH BOX logo"
              className="h-12 w-12 rounded-xl shadow"
            />
            <div>
              <p className="text-xl font-extrabold text-brand tracking-tight">BHHOOKH BOX</p>
              <p className="text-lime-deep text-xs font-medium">Admin Dashboard</p>
            </div>
          </div>

          <div className="bg-white border rounded-2xl shadow-sm p-6 md:p-8">
            <h1 className="text-xl font-bold text-brand">Admin Sign In</h1>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Sign in with your administrator account to manage live orders.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="admin@bhhookhbox.in"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="pl-9 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || !email.trim() || !password}
                className="w-full bg-brand hover:bg-brand-deep text-white h-11"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" /> Sign In
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-xs text-muted-foreground leading-5">
              Access is restricted to authorized administrators. Accounts are provisioned by the
              project owner in the Firebase Console and whitelisted in the{" "}
              <code className="bg-muted px-1 rounded">admins</code> Firestore collection — admin
              credentials are never stored in this app&apos;s source code.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
