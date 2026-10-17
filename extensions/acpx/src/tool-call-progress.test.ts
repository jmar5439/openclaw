// Regression: ACP `tool_call` stream events must surface as tool-start
// progress notifications so channels render tool execution indicators.
// Terminal statuses stay on the result path and resolve to undefined.
import { describe, expect, it } from "vitest";
import { resolveAcpToolCallProgress } from "./harness-attempt.js";

describe("resolveAcpToolCallProgress", () => {
  it("opens the indicator on a tool_call start", () => {
    expect(
      resolveAcpToolCallProgress({
        tag: "tool_call",
        status: "running",
        title: "Read src/foo.ts",
        kind: "read",
        toolCallId: "call_1",
      }),
    ).toEqual({ toolCallId: "call_1", name: "Read src/foo.ts", phase: "start" });
  });

  it("refreshes the indicator on a tool_call_update", () => {
    expect(
      resolveAcpToolCallProgress({
        tag: "tool_call_update",
        status: "running",
        title: "Bash npm test",
        kind: "execute",
        toolCallId: "call_2",
      }),
    ).toEqual({ toolCallId: "call_2", name: "Bash npm test", phase: "update" });
  });

  it("treats untagged tool events as starts", () => {
    expect(
      resolveAcpToolCallProgress({ title: "Search", status: "in_progress" }),
    ).toEqual({ name: "Search", phase: "start" });
  });

  it("treats a missing status as a start", () => {
    expect(resolveAcpToolCallProgress({ title: "Read" })).toEqual({
      name: "Read",
      phase: "start",
    });
  });

  it.each(["completed", "complete", "failed", "failure", "error", "errors", "cancelled"])(
    "keeps terminal status %s on the result path",
    (status) => {
      expect(
        resolveAcpToolCallProgress({ tag: "tool_call", status, title: "Read" }),
      ).toBeUndefined();
    },
  );

  it("matches terminal statuses case-insensitively with surrounding whitespace", () => {
    expect(
      resolveAcpToolCallProgress({ status: "  FAILED ", title: "Bash" }),
    ).toBeUndefined();
  });

  it("falls back to kind then to a generic name", () => {
    expect(resolveAcpToolCallProgress({ kind: "execute" })).toEqual({
      name: "execute",
      phase: "start",
    });
    expect(resolveAcpToolCallProgress({})).toEqual({ name: "tool", phase: "start" });
  });
});
