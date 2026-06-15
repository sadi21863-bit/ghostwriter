"use client";
import { useEffect, useMemo } from "react";
import { GrowthBook, GrowthBookProvider } from "@growthbook/growthbook-react";

// A GrowthBook instance must always be present in context — useFeatureIsOn()
// throws "Missing or invalid GrowthBookProvider" otherwise (incl. during SSR
// prerendering). Features load async; isOn()/getFeatureValue() return safe
// defaults until loadFeatures() resolves.
export function GrowthBookClientProvider({ children }: { children: React.ReactNode }) {
  const growthbook = useMemo(() => new GrowthBook({
    apiHost: process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST ?? "https://cdn.growthbook.io",
    clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY ?? "",
    enableDevMode: process.env.NODE_ENV === "development",
  }), []);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY) return;
    growthbook.loadFeatures({ autoRefresh: true });
  }, [growthbook]);

  return <GrowthBookProvider growthbook={growthbook}>{children}</GrowthBookProvider>;
}
