# Task Dispatcher

Optional OpenClaw plugin exposing `task_dispatch` for automatic or explicit task delegation. It uses the public `api.runtime.subagent.run` and `waitForRun` contracts; OpenClaw remains responsible for session creation, authorization, sandboxing, and execution.

Automatic selection ranks configured native agents by exact task-word overlap with their configured `name`, `description`, and `skills`. Add useful specializations to an agent's existing `description` or `skills` in `agents.list`; no duplicate agent catalog is maintained. ACP agents are not selected because the stable public plugin runtime does not provide a general ACP launch contract.

Enable with `plugins.entries.task-dispatcher.enabled: true`. The tool accepts `action: "dispatch"` with `task`, optional `agentId`, context, optional `mode: "run"`, and optional `wait: true`; it returns the selected agent, rationale, run/session IDs, and the runtime-provided status. Use `action: "status"` with the returned `runId` to observe an asynchronous run. `waitForRun` timeouts are observations and do not cancel the run. Reuse `taskId` to make dispatch retries idempotent. A persistent interactive conversation is not offered: each dispatch uses OpenClaw's native one-shot subagent run.
