"use client";

import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotAuthorizedProps {
  email: string | null;
  onSignOut: () => Promise<void>;
}

/** Signed in successfully, but the email is not whitelisted in the admins collection. */
export function NotAuthorized({ email, onSignOut }: NotAuthorizedProps) {
  return (
    <main className="min-h-screen bg-[#f6f9f6] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 mb-4">
          <ShieldAlert className="h-7 w-7 text-rose-600" />
        </span>
        <h1 className="text-xl font-bold text-brand">Access not authorized</h1>
        <p className="text-sm text-muted-foreground mt-2">
          You are signed in as{" "}
          <span className="font-medium text-foreground">{email ?? "an unknown account"}</span>, but
          this email is not whitelisted as an admin.
        </p>
        <div className="mt-4 rounded-lg bg-[#f4f8f4] border text-left p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-brand mb-1">How to fix this</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open Firebase Console → Firestore Database.</li>
            <li>
              Create a collection named <code className="bg-white px-1 rounded">admins</code> (if it
              doesn&apos;t exist).
            </li>
            <li>
              Add a document whose <strong>Document ID is exactly this email</strong> and set{" "}
              <code className="bg-white px-1 rounded">role: &quot;admin&quot;</code>.
            </li>
          </ol>
        </div>
        <Button
          onClick={() => void onSignOut()}
          className="mt-6 bg-brand hover:bg-brand-deep text-white w-full"
        >
          Sign out
        </Button>
      </div>
    </main>
  );
}
