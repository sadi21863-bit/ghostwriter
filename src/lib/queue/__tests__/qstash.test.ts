import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const publishJSON = vi.fn();
const verify = vi.fn();

vi.mock("@upstash/qstash", () => ({
  Client: vi.fn().mockImplementation(function (this: any) {
    this.publishJSON = (...args: any[]) => publishJSON(...args);
  }),
  Receiver: vi.fn().mockImplementation(function (this: any) {
    this.verify = (...args: any[]) => verify(...args);
  }),
}));

import { isQstashConfigured, scheduleCallback, verifyQstashRequest } from "@/lib/queue/qstash";

describe("isQstashConfigured", () => {
  const original = process.env.QSTASH_TOKEN;
  afterEach(() => { process.env.QSTASH_TOKEN = original; });

  it("is false when QSTASH_TOKEN is unset", () => {
    delete process.env.QSTASH_TOKEN;
    expect(isQstashConfigured()).toBe(false);
  });

  it("is true when QSTASH_TOKEN is set", () => {
    process.env.QSTASH_TOKEN = "qstash-token";
    expect(isQstashConfigured()).toBe(true);
  });
});

describe("scheduleCallback", () => {
  const original = process.env.QSTASH_TOKEN;
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { process.env.QSTASH_TOKEN = original; });

  it("is a no-op returning null when QStash isn't configured", async () => {
    delete process.env.QSTASH_TOKEN;
    const result = await scheduleCallback({ url: "https://example.com/cb", body: { a: 1 } });
    expect(result).toBeNull();
    expect(publishJSON).not.toHaveBeenCalled();
  });

  it("publishes with the given delay (defaulting to 15s) when configured", async () => {
    process.env.QSTASH_TOKEN = "qstash-token";
    publishJSON.mockResolvedValue({ messageId: "msg-1" });
    const result = await scheduleCallback({ url: "https://example.com/cb", body: { a: 1 } });
    expect(result).toEqual({ messageId: "msg-1" });
    expect(publishJSON).toHaveBeenCalledWith(expect.objectContaining({ url: "https://example.com/cb", body: { a: 1 }, delay: 15 }));
  });

  it("passes through a custom delaySeconds", async () => {
    process.env.QSTASH_TOKEN = "qstash-token";
    publishJSON.mockResolvedValue({ messageId: "msg-2" });
    await scheduleCallback({ url: "https://example.com/cb", body: {}, delaySeconds: 30 });
    expect(publishJSON).toHaveBeenCalledWith(expect.objectContaining({ delay: 30 }));
  });
});

describe("verifyQstashRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.QSTASH_CURRENT_SIGNING_KEY = "current-key";
    process.env.QSTASH_NEXT_SIGNING_KEY = "next-key";
  });

  it("throws when the Upstash-Signature header is missing", async () => {
    const req = new Request("http://localhost/api/queue/segmind-video-poll", { method: "POST", body: "{}" });
    await expect(verifyQstashRequest(req)).rejects.toThrow(/Missing Upstash-Signature/);
  });

  it("throws when the signature fails verification", async () => {
    verify.mockResolvedValue(false);
    const req = new Request("http://localhost/api/queue/segmind-video-poll", {
      method: "POST", headers: { "Upstash-Signature": "bad-sig" }, body: "{}",
    });
    await expect(verifyQstashRequest(req)).rejects.toThrow(/Invalid Upstash-Signature/);
  });

  it("returns the parsed body when the signature is valid", async () => {
    verify.mockResolvedValue(true);
    const req = new Request("http://localhost/api/queue/segmind-video-poll", {
      method: "POST", headers: { "Upstash-Signature": "good-sig" }, body: JSON.stringify({ shotId: "shot-1" }),
    });
    const result = await verifyQstashRequest(req);
    expect(result).toEqual({ shotId: "shot-1" });
  });
});
