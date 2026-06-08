"use client";
import { useEffect, useState } from "react";
import type { GrowthBook, GrowthBookProvider } from "@growthbook/growthbook-react";

// The GrowthBook SDK is loaded on demand (not in the initial bundle) — no
// feature flags are consumed yet, so every page paying for it upfront isn't worth it.
export function GrowthBookClientProvider({ children }: { children: React.ReactNode }) {
  const [sdk, setSdk] = useState<{ Provider: typeof GrowthBookProvider; instance: GrowthBook } | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@growthbook/growthbook-react").then(({ GrowthBook: GB, GrowthBookProvider: Provider }) => {
      if (cancelled) return;
      const instance = new GB({
        apiHost: process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST ?? "",
        clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY ?? "",
        enableDevMode: process.env.NODE_ENV === "development",
      });
      instance.loadFeatures({ autoRefresh: true });
      setSdk({ Provider, instance });
    });
    return () => { cancelled = true; };
  }, []);

  if (!sdk) return <>{children}</>;
  return <sdk.Provider growthbook={sdk.instance}>{children}</sdk.Provider>;
}
