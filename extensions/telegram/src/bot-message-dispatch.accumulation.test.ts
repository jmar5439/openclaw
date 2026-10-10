// Regression: streamed answer blocks must accumulate instead of overwriting.
// Producer contract: `text` carries the cumulative snapshot, `delta` the
// disjoint new chunk. Either side can go stale across lane rotations, so the
// snapshot wins whenever it already contains the base.
import { describe, expect, it } from "vitest";
import { resolveIncrementalBlockText } from "./bot-message-dispatch-reply.js";

describe("resolveIncrementalBlockText", () => {
  it("keeps the cumulative snapshot when it already contains the base", () => {
    expect(
      resolveIncrementalBlockText({
        baseText: "Hello ",
        snapshotText: "Hello world",
        delta: "world",
      }),
    ).toBe("Hello world");
  });

  it("survives a lane rotation that reset the base", () => {
    expect(
      resolveIncrementalBlockText({
        baseText: "",
        snapshotText: "Hello world",
        delta: "world",
      }),
    ).toBe("Hello world");
  });

  it("appends the delta for genuinely disjoint producers", () => {
    expect(
      resolveIncrementalBlockText({
        baseText: "Hello ",
        snapshotText: "world",
        delta: "world",
      }),
    ).toBe("Hello world");
  });

  it("never duplicates a full-text delta", () => {
    const preamble = "I will inspect the files before answering.";
    expect(
      resolveIncrementalBlockText({
        baseText: preamble,
        snapshotText: preamble,
        delta: preamble,
      }),
    ).toBe(preamble);
  });

  it("uses the snapshot as-is without a delta", () => {
    expect(
      resolveIncrementalBlockText({
        baseText: "stale base",
        snapshotText: "full cumulative text",
      }),
    ).toBe("full cumulative text");
  });

  it("uses the snapshot as-is for replace updates", () => {
    expect(
      resolveIncrementalBlockText({
        baseText: "stale base",
        snapshotText: "replacement text",
        delta: "replacement text",
        replace: true,
      }),
    ).toBe("replacement text");
  });
});
