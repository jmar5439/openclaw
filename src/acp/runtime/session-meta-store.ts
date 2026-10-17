/** Store binding for ACP session metadata: resolves which session-store row owns a key. */
import {
  AgentSelectionRequiredError,
  listAgentIds,
  tryResolveAgentOperationAgentId,
} from "../../agents/agent-scope-config.js";
import { getRuntimeConfig } from "../../config/config.js";
import { canonicalizeMainSessionAlias } from "../../config/sessions/main-session.js";
import { resolveSessionStorePathCore } from "../../config/sessions/paths.js";
import { loadSessionEntryReadOnly } from "../../config/sessions/session-accessor.js";
import { resolvePersistedSessionStoreOwnerForKey } from "../../config/sessions/session-store-owner.js";
import { normalizeStoreSessionKey } from "../../config/sessions/store-entry.js";
import type { SessionAcpMeta, SessionEntry } from "../../config/sessions/types.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";

export type AcpSessionStoreEntry = {
  cfg: OpenClawConfig;
  agentId?: string;
  /** Physical store owner; differs from agentId for free harness sessions. */
  storeAgentId?: string;
  storePath: string;
  sessionKey: string;
  storeSessionKey: string;
  entry?: SessionEntry;
  acp?: SessionAcpMeta;
  storeReadFailed?: boolean;
};

/** Join the logical ACP key to its canonical SQLite entry without renaming ACP metadata. */
function resolveStoreEntryForSessionKey(params: {
  agentId?: string;
  storePath: string;
  sessionKey: string;
  clone?: boolean;
}): { storeSessionKey: string; entry?: SessionEntry } {
  const storeSessionKey = normalizeStoreSessionKey(params.sessionKey);
  if (!storeSessionKey) {
    return { storeSessionKey };
  }
  return {
    storeSessionKey,
    entry: loadSessionEntryReadOnly({ ...params, sessionKey: storeSessionKey }),
  };
}

/** Resolves the session store path that owns an ACP session key. */
export function resolveSessionStorePathForAcp(params: {
  sessionKey: string;
  agentId?: string;
  cfg?: OpenClawConfig;
  env?: NodeJS.ProcessEnv;
}): {
  cfg: OpenClawConfig;
  agentId: string;
  storeAgentId: string;
  storePath: string;
  storeSessionKey: string;
} {
  const cfg = params.cfg ?? getRuntimeConfig();
  const parsed = parseAgentSessionKey(params.sessionKey);
  const requestedAgentId = params.agentId?.trim() ? normalizeAgentId(params.agentId) : undefined;
  const parsedAgentId = parsed?.agentId ? normalizeAgentId(parsed.agentId) : undefined;
  const parsedRest = parsed?.rest?.toLowerCase() ?? "";
  // Free ACP harness keys name an execution target, not a configured owner
  // (#146365). A configured requested agent is admitted as owner while storage
  // keeps resolving from the harness id below, so existing harness transcripts
  // stay targeted and no content migrates stores.
  const freeHarnessOwner =
    requestedAgentId &&
    parsedAgentId &&
    requestedAgentId !== parsedAgentId &&
    parsedRest.startsWith("acp:") &&
    !parsedRest.startsWith("acp:binding:") &&
    !listAgentIds(cfg).includes(parsedAgentId) &&
    listAgentIds(cfg).includes(requestedAgentId)
      ? requestedAgentId
      : undefined;
  if (
    requestedAgentId &&
    parsedAgentId &&
    requestedAgentId !== parsedAgentId &&
    !freeHarnessOwner
  ) {
    throw new AgentSelectionRequiredError(listAgentIds(cfg), {
      surface: `ACP session key "${params.sessionKey}"`,
      hint: `Agent "${requestedAgentId}" does not own agent-scoped session key "${params.sessionKey}".`,
    });
  }
  const persistedStoreOwner = resolvePersistedSessionStoreOwnerForKey(cfg, params.sessionKey);
  const agentId = requestedAgentId ?? parsedAgentId;
  if (
    requestedAgentId &&
    persistedStoreOwner.kind === "configured" &&
    requestedAgentId !== persistedStoreOwner.agentId
  ) {
    throw new AgentSelectionRequiredError(listAgentIds(cfg), {
      surface: `ACP session key "${params.sessionKey}"`,
      hint: `The shared fixed-store row belongs to agent "${persistedStoreOwner.agentId}", not agent "${requestedAgentId}".`,
    });
  }
  if (persistedStoreOwner.kind === "retired") {
    throw new AgentSelectionRequiredError(listAgentIds(cfg), {
      surface: `ACP session key "${params.sessionKey}"`,
      hint: `The shared fixed-store row belongs to retired agent "${persistedStoreOwner.agentId}".`,
    });
  }
  const resolvedAgentId =
    agentId ??
    (persistedStoreOwner.kind === "configured" ? persistedStoreOwner.agentId : undefined) ??
    tryResolveAgentOperationAgentId(cfg);
  if (!resolvedAgentId) {
    throw new AgentSelectionRequiredError(listAgentIds(cfg), {
      surface: `ACP session key "${params.sessionKey}"`,
      hint: "Pass an explicit agent owner for this ACP session.",
    });
  }
  const storeSessionKey = canonicalizeMainSessionAlias({
    cfg,
    sessionKey: params.sessionKey,
    agentId: resolvedAgentId,
  });
  const canonicalOwner = resolvePersistedSessionStoreOwnerForKey(cfg, storeSessionKey);
  if (
    canonicalOwner.kind === "retired" ||
    (canonicalOwner.kind === "configured" && canonicalOwner.agentId !== resolvedAgentId)
  ) {
    throw new AgentSelectionRequiredError(listAgentIds(cfg), {
      surface: `ACP session key "${storeSessionKey}"`,
      hint: "The canonical fixed-store session has a different or retired owner. Select its recorded owner.",
    });
  }
  // Storage follows the harness namespace even when a configured owner is
  // admitted above; existing harness transcripts stay targeted and no content
  // migrates stores. Identity (agentId) carries the owner for config-gated
  // downstream use.
  const storeAgentId = freeHarnessOwner && parsedAgentId ? parsedAgentId : resolvedAgentId;
  return {
    cfg,
    storeSessionKey,
    agentId: resolvedAgentId,
    storeAgentId,
    storePath: resolveSessionStorePathCore(cfg.session?.store, {
      agentId: storeAgentId,
      env: params.env,
    }),
  };
}

/** Reads the canonical session binding while retaining ACP's logical key. */
export function readSessionEntryFromStore(params: {
  sessionKey: string;
  agentId?: string;
  cfg?: OpenClawConfig;
  env?: NodeJS.ProcessEnv;
  clone?: boolean;
}): {
  cfg: OpenClawConfig;
  agentId?: string;
  storeAgentId?: string;
  storePath?: string;
  storeSessionKey: string;
  entry?: SessionEntry;
  storeReadFailed?: boolean;
} {
  const {
    cfg,
    agentId,
    storeAgentId,
    storePath,
    storeSessionKey: canonicalKey,
  } = resolveSessionStorePathForAcp({
    sessionKey: params.sessionKey,
    agentId: params.agentId,
    cfg: params.cfg,
    env: params.env,
  });
  try {
    const { storeSessionKey, entry } = resolveStoreEntryForSessionKey({
      ...(storeAgentId ? { agentId: storeAgentId } : {}),
      storePath,
      sessionKey: canonicalKey,
      ...(params.clone === false ? { clone: false } : {}),
    });
    return { cfg, agentId, storeAgentId, storePath, storeSessionKey, entry };
  } catch {
    return {
      cfg,
      agentId,
      storeAgentId,
      storePath,
      storeSessionKey: canonicalKey,
      storeReadFailed: true,
    };
  }
}
