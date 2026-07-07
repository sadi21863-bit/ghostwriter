// Core SDK, NOT growthbook-react -- the React package's GrowthBook export pulls
// in React.createContext at module-load time, which crashes any server-only
// module (like this one) that imports it outside a Client Component. This file
// never touches React; it only needs the isomorphic evaluation engine.
import { GrowthBook } from "@growthbook/growthbook";

// Server-side GrowthBook evaluation — first use of this pattern in the codebase.
// Every other flag (homeRedesign, streaming, etc.) is only ever checked
// client-side via GrowthBookClientProvider/useFeatureIsOn. This mirrors that
// setup but as a lazy singleton (same pattern as src/db/index.ts's getDb()),
// re-fetching feature definitions at most every 5 minutes instead of per request.
let _gb: GrowthBook | null = null;
let _loadedAt = 0;
const REFRESH_MS = 5 * 60 * 1000;

async function getServerGrowthBook(): Promise<GrowthBook> {
  if (!_gb) {
    _gb = new GrowthBook({
      apiHost: process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST ?? "https://cdn.growthbook.io",
      clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY ?? "",
    });
  }
  if (Date.now() - _loadedAt > REFRESH_MS) {
    await _gb.loadFeatures();
    _loadedAt = Date.now();
  }
  return _gb;
}

// Fail-open to OFF on any error (missing client key, network failure, etc.) —
// a flag-check problem must never change generation behavior unexpectedly.
export async function isFeatureOnServer(flagKey: string, userId: string, tier: string): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY) return false;
  try {
    const gb = await getServerGrowthBook();
    gb.setAttributes({ id: userId, tier });
    return gb.isOn(flagKey);
  } catch {
    return false;
  }
}
