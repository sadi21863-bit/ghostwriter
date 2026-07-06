import { describe, it, expect } from "vitest";
import { priorityColor, promiseStatusLabel, threadStatusLabel } from "@/lib/story/promise-tracker";

describe("priorityColor", () => {
  it("maps A/B/C to distinct colors", () => {
    expect(priorityColor("A")).toBe("#ef4444");
    expect(priorityColor("B")).toBe("#f59e0b");
    expect(priorityColor("C")).toBe("#6b7280");
  });

  it("falls back to C's color for an unknown priority", () => {
    expect(priorityColor("Z")).toBe(priorityColor("C"));
  });
});

describe("promiseStatusLabel", () => {
  it("labels known statuses", () => {
    expect(promiseStatusLabel("open")).toBe("Open");
    expect(promiseStatusLabel("paid_off")).toBe("Paid Off");
  });

  it("title-cases an unknown snake_case status as a safe fallback", () => {
    expect(promiseStatusLabel("some_new_status")).toBe("Some New Status");
  });
});

describe("threadStatusLabel", () => {
  it("labels known statuses", () => {
    expect(threadStatusLabel("open")).toBe("Open");
    expect(threadStatusLabel("resolved")).toBe("Resolved");
  });

  it("title-cases an unknown status as a safe fallback", () => {
    expect(threadStatusLabel("archived_early")).toBe("Archived Early");
  });
});
