import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const loadFeatures = vi.fn();
const setAttributes = vi.fn();
const isOn = vi.fn();
vi.mock("@growthbook/growthbook", () => ({
  GrowthBook: vi.fn().mockImplementation(function () {
    return {
      loadFeatures: (...args: any[]) => loadFeatures(...args),
      setAttributes: (...args: any[]) => setAttributes(...args),
      isOn: (...args: any[]) => isOn(...args),
    };
  }),
}));

const ORIGINAL_KEY = process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY;

describe("isFeatureOnServer", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    loadFeatures.mockResolvedValue(undefined);
    isOn.mockReturnValue(true);
    // The singleton GrowthBook instance/load timestamp live at module scope —
    // reset the module each test so one test's state can't leak into another.
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY;
    else process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY = ORIGINAL_KEY;
  });

  it("returns false without ever loading features when the client key is unset", async () => {
    delete process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY;
    const { isFeatureOnServer } = await import("@/lib/growthbook-server");
    const result = await isFeatureOnServer("quality_stack", "user-1", "story_pro");
    expect(result).toBe(false);
    expect(loadFeatures).not.toHaveBeenCalled();
  });

  it("fails open to false when loadFeatures throws", async () => {
    process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY = "sdk-test-key";
    loadFeatures.mockRejectedValue(new Error("network down"));
    const { isFeatureOnServer } = await import("@/lib/growthbook-server");
    const result = await isFeatureOnServer("quality_stack", "user-1", "story_pro");
    expect(result).toBe(false);
  });

  it("returns the flag value and sets per-request attributes when configured", async () => {
    process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY = "sdk-test-key";
    const { isFeatureOnServer } = await import("@/lib/growthbook-server");
    const result = await isFeatureOnServer("quality_stack", "user-1", "story_pro");
    expect(result).toBe(true);
    expect(setAttributes).toHaveBeenCalledWith({ id: "user-1", tier: "story_pro" });
    expect(isOn).toHaveBeenCalledWith("quality_stack");
  });
});
