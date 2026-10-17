import { expect, it } from "vitest";
import { SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";
import type { markMcpLoopbackToolCallStarted } from "../gateway/mcp-http.loopback-runtime.js";
<<<<<<< HEAD
=======
import type { getProcessSupervisor } from "../process/supervisor/index.js";
>>>>>>> test/all-fixes-2026.9.8
import type { RunExit } from "../process/supervisor/types.js";
import { supervisorSpawnMock, type createManagedRun } from "./cli-runner.test-support.js";
import type { PreparedCliRunContext, RunCliAgentParams } from "./cli-runner/types.js";
import type { EmbeddedAgentRunResult } from "./embedded-agent-runner/types.js";
<<<<<<< HEAD
import { hasModelFallbackStop } from "./failover-error.js";

/** Register required-reply cases inside the reliability suite's existing process fixture. */
export function registerCliReplyCompletionTests({
  createContext,
  completeToolCall,
  makeManagedRun,
  run,
}: {
=======

export function registerCliReplyCompletionTests(params: {
>>>>>>> test/all-fixes-2026.9.8
  createContext: (params: Partial<RunCliAgentParams>) => PreparedCliRunContext;
  completeToolCall: (
    call: Parameters<typeof markMcpLoopbackToolCallStarted>[0],
    result: unknown,
  ) => void;
  makeManagedRun: (overrides?: Partial<RunExit>) => ReturnType<typeof createManagedRun>;
  run: (context: PreparedCliRunContext) => Promise<EmbeddedAgentRunResult>;
}) {
  it.each([
    { name: "final source reply", target: "chat123", final: true, expected: "success" },
    { name: "source progress", target: "chat123", final: false, expected: "error" },
    { name: "another conversation", target: "elsewhere", final: true, expected: "error" },
  ] as const)(
    "settles NO_REPLY after $name without replaying a send",
    async ({ target, final, expected }) => {
<<<<<<< HEAD
      supervisorSpawnMock.mockImplementationOnce(async (input) => {
        completeToolCall(
=======
      supervisorSpawnMock.mockImplementationOnce(async (...args: unknown[]) => {
        // SAFETY: the mocked method receives the process supervisor spawn arguments.
        const input = args[0] as Parameters<ReturnType<typeof getProcessSupervisor>["spawn"]>[0];
        params.completeToolCall(
>>>>>>> test/all-fixes-2026.9.8
          {
            captureKey: input.env?.OPENCLAW_MCP_CLI_CAPTURE_KEY ?? "",
            toolName: "message",
            args: {
              action: "send",
              channel: "telegram",
              target,
              message: "sent without a terminal reply",
              final,
            },
          },
          { status: "sent" },
        );
        input.onStdout?.(
          `${JSON.stringify({ type: "result", session_id: "claude-session", result: SILENT_REPLY_TOKEN })}\n`,
        );
<<<<<<< HEAD
        return makeManagedRun();
      });
      const context = createContext({
=======
        return params.makeManagedRun();
      });
      const context = params.createContext({
>>>>>>> test/all-fixes-2026.9.8
        sessionKey: "agent:main:telegram:direct:chat123",
        runId: "run-required-source-delivery",
        sourceReplyDeliveryMode: "message_tool_only",
        messageChannel: "telegram",
        currentChannelId: "chat123",
        terminalReplyExpectation: "required",
      });
      context.backendResolved.config.output = "jsonl";

<<<<<<< HEAD
      const result = await run(context);
=======
      const result = await params.run(context);
>>>>>>> test/all-fixes-2026.9.8

      expect(result.didSendViaMessagingTool).toBe(true);
      expect(result.meta.executionTrace?.attempts?.[0]?.result).toBe(expected);
      expect(result.payloads).toEqual(
        target === "chat123" && !final
          ? [{ text: "The reply stopped after sending progress. Please try again.", isError: true }]
          : undefined,
      );
      expect(supervisorSpawnMock).toHaveBeenCalledOnce();
    },
  );
<<<<<<< HEAD

  it.each([false, true])(
    "requires child continuation custody before accepting NO_REPLY (completion=%s)",
    async (expectsCompletionMessage) => {
      const child = {
        runId: "spawned-cli-child",
        childSessionKey: "agent:main:subagent:spawned-cli-child",
        expectsCompletionMessage,
      };
      supervisorSpawnMock.mockImplementationOnce(async (input) => {
        completeToolCall(
          {
            captureKey: input.env?.OPENCLAW_MCP_CLI_CAPTURE_KEY,
            toolName: "sessions_spawn",
            args: { task: "review", expectsCompletionMessage },
          },
          { details: { status: "accepted", ...child } },
        );
        return makeManagedRun({ stdout: SILENT_REPLY_TOKEN });
      });
      const context = createContext({
        sessionKey: "agent:main:subagent:cli-parent",
        lane: "subagent",
        terminalReplyExpectation: "required",
      });

      const operation = run(context);

      if (expectsCompletionMessage) {
        await expect(operation).resolves.toMatchObject({ acceptedSessionSpawns: [child] });
      } else {
        const error = await operation.catch((caught: unknown) => caught);
        expect(error).toMatchObject({ name: "FailoverError", reason: "empty_response" });
        expect(hasModelFallbackStop(error)).toBe(true);
      }
      expect(supervisorSpawnMock).toHaveBeenCalledOnce();
    },
  );

  it.each([SILENT_REPLY_TOKEN, JSON.stringify({ action: SILENT_REPLY_TOKEN })])(
    "rejects silent CLI output %j when a final reply is required",
    async (text) => {
      supervisorSpawnMock.mockResolvedValueOnce(makeManagedRun({ stdout: text }));
      const context = createContext({
        sessionKey: "agent:main:subagent:required-cli-reply",
        lane: "subagent",
        terminalReplyExpectation: "required",
        inputProvenance: { kind: "inter_session", sourceTool: "sessions_spawn" },
      });

      await expect(run(context)).rejects.toMatchObject({
        name: "FailoverError",
        reason: "empty_response",
      });
      expect(supervisorSpawnMock).toHaveBeenCalledOnce();
    },
  );
=======
>>>>>>> test/all-fixes-2026.9.8
}
