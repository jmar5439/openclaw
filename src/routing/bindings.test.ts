import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import {
  buildChannelAccountBindings,
  listBoundAccountIds,
  resolveDefaultAgentBoundAccountId,
} from "./bindings.js";
import { resolveFirstBoundAccountId } from "./bound-account-read.js";
import { resolveChannelRouteAgentId } from "./route-binding-index.js";

describe("route binding account helpers", () => {
  it.each([undefined, "", "  "])("includes implicit account %j in diagnostics", (accountId) => {
    const cfg: OpenClawConfig = {
      agents: { entries: { main: {} } },
      bindings: [{ agentId: "main", match: { channel: "telegram", accountId } }],
    };
    expect(listBoundAccountIds(cfg, "telegram")).toEqual(["default"]);
    expect(buildChannelAccountBindings(cfg)).toEqual(
      new Map([["telegram", new Map([["main", ["default"]]])]]),
    );
  });

  it.each([false, true])(
    "keeps implicit bindings out of outbound account selection (explicit sole: %s)",
    (explicitOwnership) => {
      const cfg: OpenClawConfig = {
        agents: { ...(explicitOwnership ? { ownership: "explicit" } : {}), entries: { main: {} } },
        channels: { telegram: { defaultAccount: "work" } },
        bindings: [{ agentId: "main", match: { channel: "telegram" } }],
      };
      expect(resolveDefaultAgentBoundAccountId(cfg, "telegram")).toBeNull();
      expect(
        resolveFirstBoundAccountId({ cfg, channelId: "telegram", agentId: "main" }),
      ).toBeUndefined();

      cfg.bindings = [
        { agentId: "main", match: { channel: "telegram" } },
        { agentId: "main", match: { channel: "telegram", accountId: "alerts" } },
      ];
      expect(resolveDefaultAgentBoundAccountId(cfg, "telegram")).toBe("alerts");
      expect(resolveFirstBoundAccountId({ cfg, channelId: "telegram", agentId: "main" })).toBe(
        "alerts",
      );
    },
  );

  it("preserves account order and agent scope while deduplicating implicit defaults", () => {
    const cfg: OpenClawConfig = {
      agents: { entries: { main: {}, support: {} } },
      bindings: [
        { agentId: "main", match: { channel: "telegram", accountId: "work" } },
        { agentId: "main", match: { channel: "telegram" } },
        { agentId: "main", match: { channel: "telegram", accountId: "default" } },
        {
          agentId: "support",
          match: { channel: "telegram", peer: { kind: "group", id: "group-a" } },
        },
        { agentId: "support", match: { channel: "telegram", accountId: "*" } },
        { agentId: "support", match: { channel: "slack", accountId: "alerts" } },
      ],
    };
    expect(listBoundAccountIds(cfg, "telegram")).toEqual(["default", "work"]);
    expect(buildChannelAccountBindings(cfg).get("telegram")).toEqual(
      new Map([
        ["main", ["work", "default"]],
        ["support", ["default"]],
      ]),
    );
    expect(resolveDefaultAgentBoundAccountId(cfg, "telegram")).toBeNull();
  });

  it.each([undefined, "explicit"] as const)(
    "uses the designated binding owner only with explicit ownership (%s)",
    (ownership) => {
      const cfg: OpenClawConfig = {
        agents: {
          ownership,
          defaults: { systemAgent: { agentId: "research" } },
          entries: { ops: { default: true }, research: {} },
        },
        bindings: [
          { agentId: "ops", match: { channel: "telegram", accountId: "legacy" } },
          { agentId: "research", match: { channel: "telegram", accountId: "designated" } },
        ],
      };
      expect(resolveDefaultAgentBoundAccountId(cfg, "telegram")).toBe(
        ownership === "explicit" ? "designated" : "legacy",
      );
    },
  );
});

describe("resolveChannelRouteAgentId", () => {
  const cfg: OpenClawConfig = {
    agents: { entries: { main: {}, developer: {} } },
    bindings: [
      { agentId: "main", match: { channel: "telegram", accountId: "main" } },
      { agentId: "developer", match: { channel: "telegram", accountId: "dev" } },
    ],
  };

  it("resolves the configured agent for an exact channel account", async () => {
    expect(resolveChannelRouteAgentId(cfg, "telegram", "dev")).toBe("developer");
    expect(resolveChannelRouteAgentId(cfg, "telegram", "main")).toBe("main");
  });

  it("returns undefined without a channel or matching binding", async () => {
    expect(resolveChannelRouteAgentId(cfg, undefined, "dev")).toBeUndefined();
    expect(resolveChannelRouteAgentId(cfg, "slack", "dev")).toBeUndefined();
    expect(resolveChannelRouteAgentId(cfg, "telegram", "nope")).toBeUndefined();
  });

  it("skips bindings whose agent is not configured", async () => {
    const stale: OpenClawConfig = {
      agents: { entries: { main: {} } },
      bindings: [{ agentId: "ghost", match: { channel: "telegram", accountId: "dev" } }],
    };
    expect(resolveChannelRouteAgentId(stale, "telegram", "dev")).toBeUndefined();
  });
});
