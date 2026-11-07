import { Loader2 } from "lucide-react";

/** Full-screen branded loader shown while Firebase auth state resolves. */
export function BrandLoader({ label = "Connecting to Firebase…" }: { label?: string }) {
  return (
    <main className="min-h-screen bg-[#f6f9f6] flex flex-col items-center justify-center gap-5">
      <img
        src="/logo-bhhookh.png"
        alt="BHHOOKH BOX logo"
        className="h-20 w-20 rounded-2xl shadow-md"
      />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-lime-deep" />
        <span>{label}</span>
      </div>
    </main>
  );
}
