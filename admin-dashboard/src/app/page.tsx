"use client";

import { isFirebaseConfigured } from "@/lib/firebase";
import { signOutAdmin, useAdminAuth } from "@/hooks/use-admin-auth";
import { AdminDashboard } from "@/components/admin/dashboard";
import { BrandLoader } from "@/components/admin/brand-loader";
import { LoginForm } from "@/components/admin/login-form";
import { NotAuthorized } from "@/components/admin/not-authorized";
import { SetupRequired } from "@/components/admin/setup-required";

/**
 * BHHOOKH BOX Admin Dashboard — single-page console.
 *
 * Renders one of four states based on real Firebase state:
 *   1. SetupRequired  — env vars missing (no Firebase simulation, ever)
 *   2. BrandLoader    — auth state resolving
 *   3. LoginForm      — signed out
 *   4. NotAuthorized  — signed in but not in the admins whitelist
 *   5. AdminDashboard — authorized admin: live orders, stats, status control
 */
export default function AdminPage() {
  const { loading, user, isAdmin } = useAdminAuth();

  if (!isFirebaseConfigured()) {
    return <SetupRequired />;
  }
  if (loading) {
    return <BrandLoader />;
  }
  if (!user) {
    return <LoginForm />;
  }
  if (!isAdmin) {
    return <NotAuthorized email={user.email} onSignOut={signOutAdmin} />;
  }
  return <AdminDashboard userEmail={user.email ?? ""} onSignOut={signOutAdmin} />;
}
