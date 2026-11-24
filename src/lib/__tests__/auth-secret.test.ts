import { describe, it, expect, afterEach } from "vitest";
import { safeSecretEquals, requireBearer } from "../auth-secret";

const SECRET = "adm_2f8a91c4e7b34d0fa6c5e8b1d93f7024";

afterEach(() => {
  delete process.env.ADMIN_SECRET;
  delete process.env.CRON_SECRET;
});

describe("safeSecretEquals", () => {
  it("accepts an exact match", () => {
    expect(safeSecretEquals(SECRET, SECRET)).toBe(true);
  });

  it("rejects a near-miss that shares a long prefix", () => {
    // The realistic timing-attack shape: guess the first N bytes correctly.
    const guess = SECRET.slice(0, SECRET.length - 4) + "0000";
    expect(safeSecretEquals(guess, SECRET)).toBe(false);
  });

  it("rejects differing lengths instead of throwing", () => {
    expect(safeSecretEquals(SECRET + "extra", SECRET)).toBe(false);
    expect(safeSecretEquals(SECRET.slice(0, 4), SECRET)).toBe(false);
  });

  it("rejects empty, null and undefined on either side", () => {
    expect(safeSecretEquals(null, SECRET)).toBe(false);
    expect(safeSecretEquals(SECRET, null)).toBe(false);
    expect(safeSecretEquals(undefined, undefined)).toBe(false);
    expect(safeSecretEquals("", "")).toBe(false);
  });
});

describe("requireBearer", () => {
  it("500s when the secret is not configured — never authorizes by default", () => {
    delete process.env.ADMIN_SECRET;
    const res = requireBearer(`Bearer anything`, "ADMIN_SECRET");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
  });

  it("401s a missing Authorization header", () => {
    process.env.ADMIN_SECRET = SECRET;
    expect(requireBearer(null, "ADMIN_SECRET")!.status).toBe(401);
  });

  it("401s a header without the Bearer prefix", () => {
    process.env.ADMIN_SECRET = SECRET;
    expect(requireBearer(SECRET, "ADMIN_SECRET")!.status).toBe(401);
  });

  it("401s a wrong secret", () => {
    process.env.ADMIN_SECRET = SECRET;
    expect(requireBearer("Bearer wrong", "ADMIN_SECRET")!.status).toBe(401);
  });

  it("allows a correct bearer token", () => {
    process.env.ADMIN_SECRET = SECRET;
    expect(requireBearer(`Bearer ${SECRET}`, "ADMIN_SECRET")).toBeNull();
  });

  it("honours CRON_SECRET independently of ADMIN_SECRET", () => {
    process.env.ADMIN_SECRET = SECRET;
    process.env.CRON_SECRET = "cron_different_value";
    // The admin secret must not authorize the cron route.
    expect(requireBearer(`Bearer ${SECRET}`, "CRON_SECRET")!.status).toBe(401);
    expect(requireBearer("Bearer cron_different_value", "CRON_SECRET")).toBeNull();
  });
});