import { describe, it, expect, vi, beforeEach } from "vitest";

const redisGet = vi.fn();
const redisIncr = vi.fn();
const redisExpire = vi.fn();
const redisDel = vi.fn();

vi.mock("@upstash/redis", () => ({
  // Real function expression (not an arrow function) required here - `new
  // Redis(...)` needs its mock implementation to actually support `new`,
  // which arrow functions can never do regardless of what they return.
  Redis: vi.fn().mockImplementation(function (this: any) {
    this.get = (...args: any[]) => redisGet(...args);
    this.incr = (...args: any[]) => redisIncr(...args);
    this.expire = (...args: any[]) => redisExpire(...args);
    this.del = (...args: any[]) => redisDel(...args);
  }),
}));

process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

const { isCircuitOpen, recordProviderFailure, recordProviderSuccess } = await import("../circuit-breaker");

describe("circuit-breaker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is closed (allows calls) when the failure count is below the threshold", async () => {
    redisGet.mockResolvedValue(3);
    expect(await isCircuitOpen("segmind")).toBe(false);
  });

  it("is open (blocks calls) once the failure count reaches the threshold", async () => {
    redisGet.mockResolvedValue(5);
    expect(await isCircuitOpen("segmind")).toBe(true);
  });

  it("is closed when there's no recorded failure count at all (never failed)", async () => {
    redisGet.mockResolvedValue(null);
    expect(await isCircuitOpen("segmind")).toBe(false);
  });

  it("fails OPEN when the Redis check itself throws — never blocks a real request due to its own bookkeeping breaking", async () => {
    redisGet.mockRejectedValue(new Error("Redis unreachable"));
    expect(await isCircuitOpen("segmind")).toBe(false);
  });

  it("sets an expiry only on the first recorded failure in a window, not on every subsequent one", async () => {
    redisIncr.mockResolvedValueOnce(1);
    await recordProviderFailure("segmind");
    expect(redisExpire).toHaveBeenCalledWith("gw:circuit:segmind", 120);

    redisExpire.mockClear();
    redisIncr.mockResolvedValueOnce(2);
    await recordProviderFailure("segmind");
    expect(redisExpire).not.toHaveBeenCalled();
  });

  it("never throws even if recording a failure fails (best-effort)", async () => {
    redisIncr.mockRejectedValue(new Error("Redis down"));
    await expect(recordProviderFailure("segmind")).resolves.toBeUndefined();
  });

  it("clears the failure counter on success", async () => {
    await recordProviderSuccess("segmind");
    expect(redisDel).toHaveBeenCalledWith("gw:circuit:segmind");
  });

  it("never throws even if clearing on success fails (best-effort)", async () => {
    redisDel.mockRejectedValue(new Error("Redis down"));
    await expect(recordProviderSuccess("segmind")).resolves.toBeUndefined();
  });

  it("scopes the circuit key per-provider, not globally", async () => {
    await recordProviderSuccess("higgsfield-native");
    expect(redisDel).toHaveBeenCalledWith("gw:circuit:higgsfield-native");
  });
});
