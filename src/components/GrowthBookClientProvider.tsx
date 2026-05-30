"use client";
import { useEffect, useState } from "react";
import { GrowthBookProvider, GrowthBook } from "@growthbook/growthbook-react";

export function GrowthBookClientProvider({ children }: { children: React.ReactNode }) {
  const [gb] = useState(() => new GrowthBook({
    apiHost: process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST ?? "",
    clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY ?? "",
    enableDevMode: process.env.NODE_ENV === "development",
  }));

  useEffect(() => {
    gb.loadFeatures({ autoRefresh: true });
  }, [gb]);

  return <GrowthBookProvider growthbook={gb}>{children}</GrowthBookProvider>;
}
