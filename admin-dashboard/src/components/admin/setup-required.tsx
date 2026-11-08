import { KeyRound } from "lucide-react";
import { firebaseConfig } from "@/lib/firebase";

/** Rendered instead of the console when NEXT_PUBLIC_FIREBASE_* env vars are missing. */
export function SetupRequired() {
  return (
    <main className="min-h-screen bg-[#f6f9f6] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-brand px-6 py-8 flex items-center gap-4">
          <img
            src="/logo-bhhookh.png"
            alt="BHHOOKH BOX logo"
            className="h-14 w-14 rounded-xl border border-white/20"
          />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">BHHOOKH BOX</h1>
            <p className="text-lime-brand text-sm font-medium">Admin Dashboard</p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="flex items-start gap-3 mb-6">
            <KeyRound className="h-5 w-5 text-lime-deep mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-brand">Firebase configuration required</h2>
              <p className="text-sm text-muted-foreground mt-1">
                This dashboard is wired to real Firebase Authentication and Firestore — no demo
                mode. Add your shared Firebase project credentials to{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">.env.local</code> and
                restart the dev server.
              </p>
            </div>
          </div>

          <div className="bg-[#0b1f17] text-[#d7f7c9] rounded-xl p-4 text-xs font-mono leading-6 overflow-x-auto">
            <div className="text-[#86b98f]"># admin-dashboard/.env.local</div>
            <div>NEXT_PUBLIC_FIREBASE_API_KEY={firebaseConfig.apiKey || "your-api-key"}</div>
            <div>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN={firebaseConfig.authDomain || "your-project.firebaseapp.com"}</div>
            <div>NEXT_PUBLIC_FIREBASE_PROJECT_ID={firebaseConfig.projectId || "your-project-id"}</div>
            <div>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET={firebaseConfig.storageBucket || "your-project.appspot.com"}</div>
            <div>NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID={firebaseConfig.messagingSenderId || "000000000000"}</div>
            <div>NEXT_PUBLIC_FIREBASE_APP_ID={firebaseConfig.appId || "1:000000000000:web:xxxxxxxx"}</div>
          </div>

          <ol className="mt-6 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Create (or open) your Firebase project at console.firebase.google.com.</li>
            <li>Project settings → General → Your apps → Web app → copy the config values.</li>
            <li>Paste them into <code className="bg-muted px-1 rounded">.env.local</code> in the admin-dashboard folder.</li>
            <li>Enable Authentication (Email/Password) and Firestore, then deploy firestore.rules from the /firebase folder.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
