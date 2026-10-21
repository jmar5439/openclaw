import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-runtime";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import { Type } from "typebox";

const TaskDispatchSchema = Type.Object(
  {
    action: Type.Union([Type.Literal("dispatch"), Type.Literal("status")]),
    taskId: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
    task: Type.Optional(Type.String({ minLength: 1, maxLength: 20_000 })),
    mode: Type.Optional(Type.Union([Type.Literal("run"), Type.Literal("session")])),
    agentId: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
    context: Type.Optional(
      Type.Object(
        {
          repository: Type.Optional(Type.String({ maxLength: 2_000 })),
          workingDirectory: Type.Optional(Type.String({ maxLength: 2_000 })),
          constraints: Type.Optional(
            Type.Array(Type.String({ maxLength: 2_000 }), { maxItems: 30 }),
          ),
          additional: Type.Optional(Type.String({ maxLength: 10_000 })),
        },
        { additionalProperties: false },
      ),
    ),
    wait: Type.Optional(Type.Boolean()),
    timeoutMs: Type.Optional(Type.Integer({ minimum: 1, maximum: 600_000 })),
    runId: Type.Optional(Type.String({ minLength: 1, maxLength: 256 })),
  },
  { additionalProperties: false },
);

type Agent = NonNullable<
  NonNullable<NonNullable<OpenClawPluginApi["config"]>["agents"]>["list"]
>[number];

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]*/gu) ?? []);
}

export function selectAgent(
  agents: Agent[],
  task: string,
  explicitId?: string,
): { agent?: Agent; reason: string } {
  const candidates = agents.filter((agent) => agent.runtime?.type !== "acp");
  if (explicitId) {
    const requested = agents.find((agent) => agent.id === explicitId);
    if (!requested) return { reason: `Agent '${explicitId}' is not configured.` };
    if (requested.runtime?.type === "acp")
      return {
        reason: `Agent '${explicitId}' uses ACP; this dispatcher currently supports native embedded agents only.`,
      };
    return {
      agent: requested,
      reason: `Explicitly selected configured native agent '${requested.id}'.`,
    };
  }
  const taskWords = words(task);
  let best: { agent: Agent; score: number; hits: string[] } | undefined;
  for (const agent of candidates) {
    const metadata = words(
      `${agent.name ?? ""} ${agent.description ?? ""} ${(agent.skills ?? []).join(" ")}`,
    );
    const hits = [...taskWords].filter((word) => metadata.has(word));
    const score = hits.length;
    if (score > (best?.score ?? 0)) best = { agent, score, hits };
  }
  if (!best) {
    const acpCount = agents.length - candidates.length;
    return {
      reason: candidates.length
        ? "No configured native agent has matching name, description, or skills metadata; specify agentId or enrich agent metadata."
        : acpCount
          ? "Configured agents use ACP, but this plugin only dispatches through the public native subagent runtime."
          : "No configured native embedded agents are available.",
    };
  }
  const tied = candidates.filter(
    (agent) =>
      agent.id !== best.agent.id &&
      [...taskWords].filter((word) =>
        words(
          `${agent.name ?? ""} ${agent.description ?? ""} ${(agent.skills ?? []).join(" ")}`,
        ).has(word),
      ).length === best.score,
  );
  if (tied.length > 0) {
    return {
      reason: `Automatic selection is ambiguous between ${[best.agent.id, ...tied.map((agent) => agent.id)].join(", ")}; specify agentId.`,
    };
  }
  return {
    agent: best.agent,
    reason: `Selected '${best.agent.id}' by matching task terms: ${best.hits.slice(0, 8).join(", ")}.`,
  };
}

export function createTaskDispatcherTool(api: OpenClawPluginApi) {
  return {
    name: "task_dispatch",
    label: "Task Dispatcher",
    description:
      "Dispatch a task to a configured OpenClaw agent, or inspect a native subagent run. Automatic matching uses each agent's configured name, description, and skills.",
    parameters: TaskDispatchSchema,
    execute: async (_id: string, raw: Record<string, unknown>, signal?: AbortSignal) => {
      const action = raw.action;
      if (action === "status") {
        if (typeof raw.runId !== "string" || !raw.runId.trim())
          throw new Error("status requires runId.");
        const result = await api.runtime.subagent.waitForRun({
          runId: raw.runId,
          timeoutMs: raw.timeoutMs as number | undefined,
        });
        return jsonResult({
          runId: raw.runId,
          status: result.status,
          result: result.terminalReply,
          error: result.error,
          stopReason: result.stopReason,
          timeoutPhase: result.timeoutPhase,
        });
      }
      if (action !== "dispatch") throw new Error("action must be dispatch or status.");
      if (typeof raw.task !== "string" || !raw.task.trim())
        throw new Error("dispatch requires a non-empty task description.");
      signal?.throwIfAborted();
      if (raw.mode === "session") {
        return jsonResult({
          status: "unsupported",
          reason:
            "Persistent interactive sessions are not exposed by the public plugin subagent runtime; use mode=run.",
        });
      }
      const task = raw.task.trim();
      const selected = selectAgent(
        api.config?.agents?.list ?? [],
        task,
        typeof raw.agentId === "string" ? raw.agentId : undefined,
      );
      if (!selected.agent) return jsonResult({ status: "unassigned", reason: selected.reason });
      const ctx =
        raw.context && typeof raw.context === "object"
          ? (raw.context as Record<string, unknown>)
          : {};
      const contextText = [
        typeof ctx.repository === "string" ? `Repository: ${ctx.repository}` : "",
        typeof ctx.workingDirectory === "string"
          ? `Working directory: ${ctx.workingDirectory}`
          : "",
        Array.isArray(ctx.constraints)
          ? `Constraints:\n${ctx.constraints
              .map(String)
              .map((s) => `- ${s}`)
              .join("\n")}`
          : "",
        typeof ctx.additional === "string" ? `Additional context:\n${ctx.additional}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const taskId =
        typeof raw.taskId === "string" && raw.taskId.trim()
          ? raw.taskId.trim()
          : crypto.randomUUID();
      const sessionKey = `agent:${selected.agent.id}:subagent:task-dispatch-${taskId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 72)}`;
      try {
        const started = await api.runtime.subagent.run({
          sessionKey,
          message: `${task}${contextText ? `\n\n${contextText}` : ""}`,
          deliver: false,
          idempotencyKey: `task-dispatch:${selected.agent.id}:${taskId}`,
          ...(typeof ctx.workingDirectory === "string" ? { cwd: ctx.workingDirectory } : {}),
        });
        if (raw.wait === true) {
          const outcome = await api.runtime.subagent.waitForRun({
            runId: started.runId,
            timeoutMs: raw.timeoutMs as number | undefined,
          });
          return jsonResult({
            taskId,
            agentId: selected.agent.id,
            reason: selected.reason,
            runId: started.runId,
            sessionKey: started.sessionKey ?? sessionKey,
            status: outcome.status,
            result: outcome.terminalReply,
            error: outcome.error,
            stopReason: outcome.stopReason,
            timeoutPhase: outcome.timeoutPhase,
          });
        }
        return jsonResult({
          taskId,
          agentId: selected.agent.id,
          reason: selected.reason,
          runId: started.runId,
          sessionKey: started.sessionKey ?? sessionKey,
          status: "accepted",
        });
      } catch (error) {
        return jsonResult({
          taskId,
          agentId: selected.agent.id,
          reason: selected.reason,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}
