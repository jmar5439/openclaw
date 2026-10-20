import { afterEach, describe, expect, it, vi } from "vitest";

const spawnAcpDirect = vi.hoisted(() => vi.fn());
vi.mock("../agents/subagents/spawn/acp-spawn.js", () => ({ spawnAcpDirect }));

import { withGatewayToolCallerIdentity } from "../agents/tools/gateway-caller-context.js";
import { withPluginRuntimeGatewayRequestScope } from "../plugins/runtime/gateway-request-scope.js";
import { createGatewaySubagentRuntime } from "./server-plugin-subagent-runtime.js";

const pluginId = "acp-plugin-test";

afterEach(() => spawnAcpDirect.mockReset());

describe("plugin subagent ACP spawn", () => {
  it("reuses the ACP spawn owner with the current agent session and request identity", async () => {
    const result = {
      status: "accepted",
      runId: "run-1",
      childSessionKey: "agent:codex:acp:1",
      mode: "run",
    };
    spawnAcpDirect.mockResolvedValue(result);
    const runtime = createGatewaySubagentRuntime();
    const controller = new AbortController();
    const actual = await withPluginRuntimeGatewayRequestScope(
      { pluginId, signal: controller.signal, isWebchatConnect: () => false },
      () =>
        withGatewayToolCallerIdentity(
          {
            agentId: "main",
            sessionKey: "agent:main:telegram:direct:42",
            turnSourceChannel: "telegram",
            turnSourceTo: "42",
          },
          () => runtime.spawnAcp({ task: "inspect change", agentId: "codex", mode: "run" }),
        ),
    );
    expect(actual).toEqual(result);
    expect(spawnAcpDirect).toHaveBeenCalledOnce();
    expect(spawnAcpDirect).toHaveBeenCalledWith(
      { task: "inspect change", agentId: "codex", mode: "run" },
      expect.objectContaining({
        agentSessionKey: "agent:main:telegram:direct:42",
        requesterAgentIdOverride: "main",
        agentChannel: "telegram",
        agentTo: "42",
        assertActive: expect.any(Function),
      }),
    );
    const context = spawnAcpDirect.mock.calls[0][1];
    expect(() => context.assertActive()).not.toThrow();
    controller.abort();
    expect(() => context.assertActive()).toThrow();
  });

  it("rejects calls without an active Gateway agent-turn identity", async () => {
    const runtime = createGatewaySubagentRuntime();
    await withPluginRuntimeGatewayRequestScope(
      { pluginId, isWebchatConnect: () => false },
      async () =>
        await expect(runtime.spawnAcp({ task: "no caller" })).rejects.toThrow(
          "ACP plugin spawning requires an active Gateway agent-turn context.",
        ),
    );
    expect(spawnAcpDirect).not.toHaveBeenCalled();
  });
});
