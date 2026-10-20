# Launching ACP agents from plugins (OpenClaw 2026.9.8)

## Finding

The limitation is not ACP backend initialization or permission to register plugin tools. The Gateway already supports ACP spawning. The missing piece is a plugin-facing operation that owns the complete spawn request.

- `src/agents/tools/sessions-spawn-tool.ts` parses `runtime: "acp"` and routes to `spawnAcpDirect`; its schema and validation are in the same module.
- `src/agents/subagents/spawn/acp-spawn.ts` owns ACP policy, target `agentId` resolution, `mode`/`thread`, `cwd`, sandbox compatibility, session admission, and result/error construction. It returns `SpawnAcpResult` (including accepted child-session identity and ACP execution metadata where available).
- `src/agents/subagents/spawn/acp-spawn-gateway.ts` launches the accepted child through the Gateway `agent` method with the inherited execution identity and spawn lineage. ACP process lifecycle and session metadata remain with the configured runtime backend.
- `/acp spawn` and `sessions_spawn({ runtime: "acp" })` are separate front doors to ACP control/spawn logic; neither is an exported SDK function.
- `src/plugin-sdk/acp-runtime.ts` exports backend registration, availability checks, ACP session manager and turn-stream helpers. These are runtime/control primitives, not a session-creation API. Calling them does not reproduce the admission, identity, session lifecycle, or result contracts of `spawnAcpDirect`.
- `src/plugins/runtime/types.ts` exposes `api.runtime.subagent.run`, `waitForRun`, and session operations. `src/gateway/server-plugin-subagent-runtime.ts` implements `run` by dispatching the `agent` method for a supplied `sessionKey`; it does not create an ACP session or accept a runtime selector. It is suitable for running a turn in a plugin-owned session, not for starting an arbitrary ACP child.

Therefore the exact gap is **(1) no supported public SDK operation to create an ACP child session**, with the related usability issue (2). Backend availability/configuration remains a runtime precondition, but is not the root cause. Tool registration alone does not grant ACP execution.

## Alternatives

| Option                                                | 2026.9.8 assessment                                                                                                                                                                                                             | Cost / limitation                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| A. Existing public API                                | `api.runtime.subagent.run` supports a Gateway-owned run only for a caller-provided session; ACP runtime helpers expose backend internals, not spawn admission.                                                                  | Cannot reliably create a session; manually manufacturing an ACP key or calling ACP primitives skips the owner.           |
| B. Typed SDK operation backed by existing spawn owner | Recommended. Add a narrow request-bound `api.runtime.subagent.spawnAcp` contract, implemented in the Gateway by reusing `spawnAcpDirect` with the authenticated plugin request's session/execution identity and policy context. | Small SDK/Gateway seam and contract tests; keeps future policy changes in one owner.                                     |
| C. Plugin adapter / direct ACP process                | The official `acpx` plugin registers the backend and Gateway owns its lifecycle.                                                                                                                                                | A plugin-side process or direct `AcpRuntime.ensure` flow duplicates lifecycle/admission and can orphan sessions; reject. |
| D. Call `sessions_spawn`                              | Works when `sessions_spawn` is available as an agent tool, as in the ACP harness; it is not a general callable SDK method for plugin code.                                                                                      | Depends on model/tool availability and adds a model round trip; not a deterministic automation API.                      |

## Recommended API and flow

Expose a typed, request-bound `api.runtime.subagent.spawnAcp({ task, agentId?, cwd?, mode?, thread?, sandbox?, ... })`. It should return the existing accepted/error discriminated result from `SpawnAcpResult` without claiming execution completed. Plugins can then call `waitForRun({ runId })` for the terminal result and use the returned child session key for session messages. `mode: "run"` is supported by the current spawn owner; persistent `mode: "session"` requires `thread: true`. Do not promise unsupported `fork`, `lightContext`, or arbitrary external ACP process management.

The runtime binding must derive requester identity and sandbox/tool policy from the current Gateway agent turn; plugin input must not supply or override those facts. `api.runtime.subagent.spawnAcp` is implemented as a narrow typed wrapper around `spawnAcpDirect`, forwards only the supported spawn parameters, and carries the admitted execution-identity token and request cancellation into spawn admission. Validate the ACP backend, policy, agent ID, and session mode using the existing spawn implementation. Return its explicit `forbidden`/`error` outcomes for disabled/unavailable backends, invalid agents, unsupported sandbox/tool policy, and initialization/execution failures. This leaves host process execution, cancellation, session IDs, and cleanup owned by the existing Gateway/runtime lifecycle.

```ts
const accepted = await api.runtime.subagent.spawnAcp({
  agentId: "codex",
  task: "Review the change and report issues",
  mode: "run",
});
if (accepted.status === "accepted") {
  const result = await api.runtime.subagent.waitForRun({ runId: accepted.runId });
  // `accepted.childSessionKey` identifies the ACP child; wait result distinguishes
  // accepted work from completed work.
}
```

This is a proposed SDK contract, not an API present in 2026.9.8. The minimal implementation should add the method to `PluginRuntime` and the Gateway-bound subagent runtime, route it through a request-scoped ACP-spawn owner (not a process adapter), then add runtime contract coverage proving backend-unavailable/invalid-agent outcomes and an accepted spawn followed by a completed result. Add a real Gateway integration proof with a configured fixture ACP backend; keep sandbox denial proof at the spawn admission boundary.

## Documentation drift

The checked-out `2026.9.8` source and SDK declarations are authoritative. Newer documentation describes `sessions_spawn` and ACP runtime management, but these do not imply a plugin can invoke the model tool or `spawnAcpDirect` directly. `plugin-sdk/acp-runtime` remains an ACP runtime-management surface, not the plugin child-spawn contract. The direct evidence above is the compatibility boundary; do not infer an API from current docs or invent `api.runtime.tasks`.

## Decision

Recommend a narrow SDK/Gateway extension (option B), with `spawnAcpDirect` as the sole spawn owner. The current public plugin API does not meet the task's deterministic plugin/automation use case. The prototype now exposes `api.runtime.subagent.spawnAcp` to trusted in-process plugins and delegates spawn admission, ACP launch, session creation, and result handling to `spawnAcpDirect`. It is only callable during an active Gateway agent turn, returns the existing accepted/error result, and works with `waitForRun` for terminal completion. Contract tests cover requester identity/cancellation and rejection outside an agent turn. A configured-backend integration proof remains environment-dependent; the lower-level ACP owner already has its own backend/runtime integration coverage.
