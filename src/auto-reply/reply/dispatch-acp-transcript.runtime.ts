// Bridges ACP transcript events into persisted OpenClaw session transcripts.
import { resolveAcpSessionCwd } from "@openclaw/acp-core/runtime/session-identifiers";
import { resolveSessionStorePathForAcp } from "../../acp/runtime/session-meta-store.js";
import type { AgentRunTerminalOutcome } from "../../agents/agent-run-terminal-outcome.js";
import { persistAcpTurnTranscript } from "../../agents/command/transcript-persistence.js";
import { loadSessionEntryReadOnly } from "../../config/sessions/session-accessor.js";
import type { PrepareAssistantTranscriptMessage } from "../../config/sessions/transcript-assistant-delivery.js";
import type { SessionAcpMeta } from "../../config/sessions/types.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import type { UserTurnTranscriptRecorder } from "../../sessions/user-turn-transcript.js";
import type { ReplyDispatchAssistantTranscript } from "../get-reply-options.types.js";

export async function persistAcpDispatchTranscript(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  agentId: string;
  expectedSessionId?: string;
  promptText: string;
  finalText: string;
  terminalOutcome: AgentRunTerminalOutcome;
  meta?: SessionAcpMeta;
  threadId?: string | number;
  userTurnTranscriptRecorder?: UserTurnTranscriptRecorder;
  prepareAssistantTranscriptMessage?: PrepareAssistantTranscriptMessage;
  assistantIdempotencyKey?: string;
}): Promise<ReplyDispatchAssistantTranscript | undefined> {
  const promptText = params.promptText.trim();
  const finalText = params.finalText.trim();
  if (!promptText && !finalText) {
    return undefined;
  }

  // Transcript rows live in the harness store on free ACP keys while the
  // admitted configured owner stays on policy and delivery (#146365).
  const store = resolveSessionStorePathForAcp({
    cfg: params.cfg,
    sessionKey: params.sessionKey,
    agentId: params.agentId,
  });
  const sessionAgentId = store.storeAgentId;
  const storePath = store.storePath;
  const sessionEntry = loadSessionEntryReadOnly({
    agentId: sessionAgentId,
    sessionKey: store.storeSessionKey,
    storePath,
  });
  const sessionId = sessionEntry?.sessionId;
  if (!sessionId) {
    throw new Error(`unknown ACP session key: ${params.sessionKey}`);
  }
  if (params.expectedSessionId && sessionId !== params.expectedSessionId) {
    throw new Error("ACP transcript session changed before the turn could be persisted.");
  }

  const result = await persistAcpTurnTranscript({
    body: promptText,
    transcriptBody: promptText,
    finalText,
    terminalOutcome: params.terminalOutcome,
    sessionId,
    expectedSessionId: params.expectedSessionId,
    sessionKey: params.sessionKey,
    sessionEntry,
    storePath,
    sessionAgentId,
    threadId: params.threadId,
    sessionCwd: resolveAcpSessionCwd(params.meta) ?? process.cwd(),
    config: params.cfg,
    userTurnTranscriptRecorder: params.userTurnTranscriptRecorder,
    prepareAssistantTranscriptMessage: params.prepareAssistantTranscriptMessage,
    assistantIdempotencyKey: params.assistantIdempotencyKey,
  });
  if (result.kind === "session-rebound") {
    throw new Error("ACP transcript session changed before the turn could be persisted.");
  }
  return result.assistantTranscript && params.assistantIdempotencyKey
    ? {
        agentId: sessionAgentId,
        sessionId,
        sessionKey: params.sessionKey,
        storePath,
        messageId: result.assistantTranscript.messageId,
        anchor: result.assistantTranscript.anchor,
        idempotencyKey: params.assistantIdempotencyKey,
      }
    : undefined;
}
