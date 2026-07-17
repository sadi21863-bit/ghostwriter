import { describe, it, expect, afterEach, vi } from "vitest";

// authOptions builds authDb at module load via drizzle(neon(DATABASE_URL)) -
// neon() itself just constructs an HTTP-based client (no connection opened),
// so a syntactically-plausible fake URL is enough for import-time safety.
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/db";

// Real gotcha found while writing these: GoogleProvider(options)'s raw return
// object still carries next-auth's own DEFAULT profile() (which drops
// emailVerified entirely) at `.profile` - the options I actually pass in
// (including my custom profile()) sit untouched at `.options` on that same
// object. The two only get merged (my `.options.profile` overriding the
// default, confirmed by reading node_modules/next-auth/utils/merge.js -
// functions are plain Object.assign'd, second argument wins) inside
// NextAuth's own internal parseProviders(), which runs during real request
// handling, not when GoogleProvider() is simply called and inspected. So the
// correct thing for these tests to call is `google.options.profile`, not
// `google.profile` - the latter is next-auth's own unmerged default.
describe("authOptions — GoogleProvider registration (item 72)", () => {
  const ORIGINAL_ID = process.env.GOOGLE_CLIENT_ID;
  const ORIGINAL_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  afterEach(() => {
    if (ORIGINAL_ID === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = ORIGINAL_ID;
    if (ORIGINAL_SECRET === undefined) delete process.env.GOOGLE_CLIENT_SECRET; else process.env.GOOGLE_CLIENT_SECRET = ORIGINAL_SECRET;
  });

  it("registers a google provider when both env vars are set", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    vi.resetModules();

    const { authOptions } = await import("../auth");

    const google = authOptions.providers.find((p: any) => p.id === "google");
    expect(google).toBeDefined();
  }, 30000); // vi.resetModules() + dynamic import re-transforms auth.ts's whole dependency tree on this repo's slow filesystem

  it("does not register a google provider when the env vars are unset (graceful degradation)", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    vi.resetModules();

    const { authOptions } = await import("../auth");

    const google = authOptions.providers.find((p: any) => p.id === "google");
    expect(google).toBeUndefined();
  }, 30000);

  it("does not register a google provider when only one of the two env vars is set", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    delete process.env.GOOGLE_CLIENT_SECRET;
    vi.resetModules();

    const { authOptions } = await import("../auth");

    const google = authOptions.providers.find((p: any) => p.id === "google");
    expect(google).toBeUndefined();
  }, 30000);

  it("maps Google's email_verified claim to a real Date on emailVerified (real bug: this installed next-auth's default Google profile() drops it entirely)", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    vi.resetModules();

    const { authOptions } = await import("../auth");
    const google = authOptions.providers.find((p: any) => p.id === "google") as any;

    const mapped = google.options.profile({
      sub: "12345",
      name: "Ada Lovelace",
      email: "ada@example.com",
      picture: "https://example.com/ada.png",
      email_verified: true,
    });

    expect(mapped.emailVerified).toBeInstanceOf(Date);
    expect(mapped).toMatchObject({
      id: "12345",
      name: "Ada Lovelace",
      email: "ada@example.com",
      image: "https://example.com/ada.png",
    });
  }, 30000);

  it("maps an unverified Google email to emailVerified: null, not a truthy placeholder", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    vi.resetModules();

    const { authOptions } = await import("../auth");
    const google = authOptions.providers.find((p: any) => p.id === "google") as any;

    const mapped = google.options.profile({
      sub: "12345",
      name: "Ada Lovelace",
      email: "ada@example.com",
      picture: "https://example.com/ada.png",
      email_verified: false,
    });

    expect(mapped.emailVerified).toBeNull();
  }, 30000);
});
