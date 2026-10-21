import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-runtime";
import { describe, expect, it, vi } from "vitest";
import { createTaskDispatcherTool, selectAgent } from "./task-dispatcher-tool.js";

const agents = [
  {
    id: "research",
    name: "Research specialist",
    description: "Web research and source synthesis",
    skills: ["research"],
  },
  {
    id: "builder",
    name: "Software engineer",
    description: "Coding and repository implementation",
    skills: ["coding", "git"],
  },
] as NonNullable<NonNullable<NonNullable<OpenClawPluginApi["config"]>["agents"]>["list"]>;

describe("task dispatcher", () => {
  it("selects an explicitly configured agent", () => {
    expect(selectAgent(agents, "anything", "builder")).toMatchObject({ agent: { id: "builder" } });
  });

  it("selects the configured specialist from metadata", () => {
    expect(selectAgent(agents, "implement coding in repository").agent?.id).toBe("builder");
  });

  it("reports no candidate rather than inventing an agent", () => {
    expect(selectAgent(agents, "translate a poem into latin").agent).toBeUndefined();
    expect(selectAgent(agents, "anything", "missing").reason).toContain("not configured");
  });

  it("rejects configured ACP agents rather than dispatching them through native runtime", () => {
    const acpAgents = [{ id: "codex", runtime: { type: "acp" as const } }];
    expect(selectAgent(acpAgents, "coding", "codex").reason).toContain("uses ACP");
  });

  it("returns runtime failures and timeout states without inventing outcomes", async () => {
    const run = vi.fn().mockRejectedValue(new Error("agent unavailable"));
    const api = {
      config: { agents: { list: agents } },
      runtime: { subagent: { run } },
    } as unknown as OpenClawPluginApi;
    const result = await createTaskDispatcherTool(api).execute("call", {
      action: "dispatch",
      task: "coding",
      agentId: "builder",
      taskId: "retry-1",
    });
    expect(result).toMatchObject({
      details: { status: "failed", error: "agent unavailable" },
    });

    const waitForRun = vi.fn().mockResolvedValue({ status: "timeout", timeoutPhase: "wait" });
    const waitApi = {
      config: { agents: { list: agents } },
      runtime: { subagent: { waitForRun } },
    } as unknown as OpenClawPluginApi;
    const timedOut = await createTaskDispatcherTool(waitApi).execute("call", {
      action: "status",
      runId: "run-timeout",
      timeoutMs: 5,
    });
    expect(timedOut).toMatchObject({ details: { status: "timeout", timeoutPhase: "wait" } });
  });

  it("validates required action inputs", async () => {
    const api = {
      config: { agents: { list: agents } },
      runtime: { subagent: {} },
    } as unknown as OpenClawPluginApi;
    await expect(
      createTaskDispatcherTool(api).execute("call", { action: "dispatch" }),
    ).rejects.toThrow("task");
    await expect(
      createTaskDispatcherTool(api).execute("call", { action: "status" }),
    ).rejects.toThrow("runId");
  });

  it("dispatches through the native runtime and can return the completion", async () => {
    const run = vi
      .fn()
      .mockResolvedValue({ runId: "run-1", sessionKey: "agent:builder:subagent:task" });
    const waitForRun = vi.fn().mockResolvedValue({ status: "ok", terminalReply: { text: "done" } });
    const api = {
      config: { agents: { list: agents } },
      runtime: { subagent: { run, waitForRun } },
    } as unknown as OpenClawPluginApi;
    const tool = createTaskDispatcherTool(api);
    const result = await tool.execute("call", {
      action: "dispatch",
      task: "coding task",
      agentId: "builder",
      taskId: "task",
      wait: true,
    });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:builder:subagent:task-dispatch-task",
        deliver: false,
      }),
    );
    expect(waitForRun).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1" }));
    expect(result).toMatchObject({
      content: [expect.objectContaining({ text: expect.stringContaining('"status": \"ok\"') })],
    });
  });

  it("observes async run status without claiming completion", async () => {
    const waitForRun = vi.fn().mockResolvedValue({ status: "pending" });
    const api = {
      config: { agents: { list: agents } },
      runtime: { subagent: { waitForRun } },
    } as unknown as OpenClawPluginApi;
    const result = await createTaskDispatcherTool(api).execute("call", {
      action: "status",
      runId: "run-1",
    });
    expect(waitForRun).toHaveBeenCalledWith({ runId: "run-1", timeoutMs: undefined });
    expect(result).toMatchObject({
      content: [
        expect.objectContaining({ text: expect.stringContaining('"status": \"pending\"') }),
      ],
    });
  });
});
