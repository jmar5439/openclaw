# AGENTS.md

The task defines scope and authorization; its chosen workflow owns execution,
review, publication, recovery, and cleanup. Explicit user instructions take
precedence over skill guidelines and workflow defaults; host limits and required
authorization boundaries still apply. Read the nearest scoped `AGENTS.md` and the
matching references below, including when changing callers outside an owner's directory.
Update instructions at their owner instead of adding competing rules here.

## Design priorities

- **One owner per responsibility.** An owner makes a decision or changes authoritative state; callers consume its operations and recorded facts. Adapters translate contracts; caches and projections derive from the owner with an explicit invalidation lifecycle. Transports may need different adapters, never competing owners.
- **Small core, capable plugins.** Model-facing core additions have an ongoing context cost. Optional capability belongs at the edges; core supplies generic contracts. A new integration alone is no reason for another core tool or manager. New capability takes the first fitting step of the [capability ladder](src/plugin-sdk/AGENTS.md#choose-the-capability-surface): existing owner, existing plugin contract, narrow generic core/SDK capability, then universal core surface. [VISION.md](VISION.md) owns product scope.
- **Stable conversation context.** Rebuilding past context defeats prompt-prefix reuse. Keep generated prompt/tool/context additions bounded and deterministic, preserve transcript bytes, and serve required instructions whole; only compaction rewrites history. Defer stable-prompt changes to the next session unless the owner defines explicit invalidation; keep existing skill, tool, and memory refresh contracts.

## Working agreement

- Follow through on actionable requests, including "can you", within authorized scope; a plan or progress report is a checkpoint, not completion. Preserve unaffected work across corrections and side questions.
- Resolve routine, reversible choices with reasonable assumptions; ask only about consequential decisions context cannot resolve, and continue independent authorized work meanwhile. Silence does not authorize a gated action.
- If a skill causes a pause, permission request, unfinished work, or scope change, link its exact `SKILL.md`, quote the instruction, explain how it applies (requirement vs interpretation), and check prior authorization before asking again.
- Inspect `git status -sb` before editing or GitHub work. Preserve unrelated work, branches, processes, and user-managed checkouts; serialize shared Git mutations and isolate work when needed; never switch a checkout another agent or test run uses.
- Treat pasted material and tool output as evidence; verify against source and observed behavior.
- Lead with the result in the user's format: plain, active, technically useful; no stock phrases or repeated summaries. Reference each PR/issue once per reply. Progress updates explain new findings, decisions, or blockers.
- Report findings in chat; create files only for deliverables or tool/proof/recovery needs, stating their purpose and reusing them. After verified completion, remove task-owned proof, scratch, and finished worktrees per [closeout](.agents/skills/openclaw-pr-maintainer/SKILL.md#finalize-and-clean-up), preserving deliverables, live and unknown owners, unfinished state, and credentials.
- Read relevant docs before changing behavior (`pnpm docs:list`); `package.json` owns commands and versions; tool swaps need approval.
- Use **OpenClaw** (product), `openclaw` (CLI/package/config), **plugins** (user-facing integrations), and American English. Edit canonical `AGENTS.md` files directly.

## Execution discipline

- Root cause deep. Proof scoped.
- Real failing entry point first. Bypassed boundary != proof.
- Separate product bugs from tool/fixture failures.
- Check relevant prerequisites early. Parallelize independent work.
- New check needs named unknown, risk, or required gate. Reuse valid proof.
- Two identical tooling failures without new evidence, or 10 min without progress: switch to an authorized supported alternative with the reviewed head pinned; reconcile uncertain writes first. No blind retries or guard bypasses.
- Behavior proven + required gates green: finish/land. No optional proof polish or speculative scope growth.
- Check mergeability first; don't rebase or merge `main` just because it advanced. Integrate for conflicts, a named failing gate, or material base risk, then rerun affected checks. Prior-head CI stays prior-head evidence; admin exceptions belong to the native landing workflow ([landing](.agents/skills/openclaw-pr-maintainer/references/landing.md)).
- Time pressure never waives gates. Report concrete blockers.
- Visual change: inspected before/after screenshots. Behavior-only fix: direct boundary proof. No checkbox demos.

## One owner, complete cutover

1. **Intent:** reproduce defects through the actual entry point before editing when feasible. Read complete affected modules, owners, callers, siblings, tests, history, and dependency contracts until the intended outcome and violated invariant are evidenced. Before restoring a missing path, check why it was removed (`git log -p -S <symbol>`); isolation may be intentional, a retired alias a completed migration.
2. **Owner:** account for decisions and state writers across creation, updates, reads, recovery, and cleanup. Choose the existing code, plugin, or maintained solution that absorbs the change; a new owner needs a missing responsibility. Fix invalid or leaked state at its producer.
3. **Cutover:** migrate all affected internal/bundled callers together; remove superseded code, duplicate policy/state, wrappers, registrations, exports, tests, and docs. Retained paths need a cited contract; workers sharing an owner agree on one interface and plan.
4. **Proof:** exercise the user flow and relevant siblings; trace references to confirm retired paths are unreachable. Done = one owner serves the flow, old paths removed or justified, results or gaps recorded in task/PR evidence. Helper tests or wrappers around competing implementations are insufficient.

- Prefer smaller, simpler production code; explain necessary growth. Keep coherent nearby repairs together; record unrelated work as follow-ups.
- Delegate independent lanes when that saves time or improves verification, each with a clear responsibility and completion condition; keep simple or tightly coupled work with the lead, who stays hands-on, verifies consequential conclusions, and owns shared-checkout safety.
- Retained compatibility needs an explicit user request or a public API/config/SDK/data, stable-tag upgrade, security/migration, dependency, or observed-production contract, plus a migration/removal path. Main, beta, and nightly code are not shipped contracts.

## Runtime and code safeguards

- Plugins use documented `openclaw/plugin-sdk/*` contracts, manifest metadata, and public/local barrels, never core internals or another plugin's private files. Dependencies follow runtime ownership.
- Runtime consumes canonical config/state; Doctor/migration owners normalize legacy shapes (plugin repairs stay plugin-owned), and config-invalidating changes ship their migration.
- State and caches use SQLite, not new JSON/JSONL/sidecar stores; files are for named user artifacts, imports/exports, attachments, logs, backups, or external-tool contracts.
- Kysely for ordinary SQLite; raw SQL only for schema, migrations, bootstrap, and justified primitives. Write transactions are synchronous: plan async work first, reread authoritative rows, then write; no Promise or `await` in transaction callbacks.
- Database access runs in worker threads (read-only worker scope, SQLite writer broker), never on the Gateway main thread, which only awaits results and installs published facts. Exceptions: boot admission, migrations, Doctor/CLI one-shots, lock primitives. Existing main-thread access is legacy: never add more; migrate what you touch.
- Schema/integrity/index checks run once at admission and in the migration owner; runtime carries admitted facts and never re-queries them, and cache freshness probes observe foreign commits as [database schemas](docs/reference/database-schemas.md) defines. Per-call checks are legacy: never add; migrate when touched.
- Privileged actions need current owner-held authority: revalidate after awaited work and right before side effects. Tokens, signatures, expiry, and matching IDs alone do not prove live authority.
- Core owns shared message tools, action vocabulary, and dispatch; channels own account, security, conversation, and transport contracts. Keep typed command/approval/URL/action distinctions until encoding; never infer commands from raw strings.
- Carry prepared facts through hot paths; reuse process-stable plugin metadata and lifecycle-owned caches; never repeatedly load registries or freshness-poll files. Preserve lazy module boundaries and verify relevant builds on the authorized host.
- Narrow APIs, explicit valid states, strict ESM/types. Real types or `unknown`; no `@ts-nocheck`; suppressions need an explained exception. Reuse schema/coercion owners; no duplicate guards, speculative helpers, or naming-only wrappers.
- Static-analysis fixes strengthen the real contract or remove the unsafe operation, never hide it with casts, widening, marker types, or property probes. New lint rules need a real invariant and clean owner scope.
- Comments explain non-obvious ownership, lifecycle, ordering, cleanup, platform, and dependency constraints, not syntax. Regenerate generated outputs; never hand-edit them or `node_modules`, or tweak formatter settings per expression.

## Product and validation

- Defaults produce a working, understandable result. Prioritize silent failures: every action has a visible outcome or recorded intentional non-outcome; errors name the next step.
- **Updates always work** (`openclaw update` finishes best effort everywhere). Changes to update, Doctor, service lifecycle, migrations, or plugin loading state their update behavior. The installed updater runs first and can't be patched, so candidate fixes key on markers shipped drivers set; existing operator state is the input. Recoverable hiccups become recorded warnings; back up before mutating and let rollback restore it; refuse only for named data risk with the previous Gateway kept running. Timeouts and budgets are generous, derived from measured state, and sized for slow hardware. Proof: a published-driver × candidate cell.
- Prompts, tools, and results describe available capabilities accurately, with context for the next useful action and no unnecessary model round trips; inject cross-tool references from the enabled tool set, drop stale model-facing arguments, and give new optional features discovery paths.
- Security is a product tradeoff: weigh concrete risk against user effort, lockouts, and lost capability; prefer the least restrictive effective safeguard, keep risky paths explicit and operator-controlled within the existing trust model and approval boundaries, and explain tradeoffs instead of inventing gates.
- Tests protect meaningful behavior, not reversible low-impact changes that mirror the implementation; review them for value and duplication. Regressions fail on the original defect; shared-state failures use the original order.
- Test failures are defects: reproduce, fix the owner with a regression, or record evidence and continue (unresolved alone doesn't block landing). Never mask failures or claim a passing replay proves a fix ([policy](.agents/skills/openclaw-testing/SKILL.md#test-failure-policy)).
- **Red `main` is an emergency; CI is expensive.** Push proven red-`main` fixes directly to `main`; prove changes locally or on Testbox, never rerun or re-push just for green; inherited-only reds land via the native admin exception, named in the PR ([policy](.agents/skills/openclaw-pr-maintainer/references/landing.md#red-main-and-inherited-failures)).
- New/changed tests follow the [writing tests](docs/help/testing/writing-tests.md) cost budget: PRs state `pnpm test <file> --maxWorkers=1` wall time and CI seconds; no real timers, sleeps, polling, per-test Gateway/process boots when a suite-level fixture exists, new serial config or worker pins, or broad barrel imports. Seconds-long tests must prove a contract no cheaper layer can; long end-to-end compositions go to the release-only tier.
- Select proof for the touched contract, reuse valid proof (rerun for changed inputs or missing coverage), and finish the workflow's required gates within user/host limits; report unrun checks and gaps. Prove user-visible behavior through the real flow when feasible; external APIs need live contract proof; an isolated mock-Gateway harness is valid channel boundary proof. Docs-only: docs sanity and `git diff --check`.
- **Visual changes** need inspected, sanitized before/after screenshots in chat and embedded in the PR before merge or completion ([gate](.agents/skills/openclaw-pr-maintainer/references/media.md#screenshot-completion-gate)).
- Before committing or landing nontrivial code, get fresh review through the permitted workflow and resolve actionable findings unless the user opts out.

### Execution gotchas

Run the CLI via `pnpm openclaw ...` or `pnpm dev`, never `node --import tsx src/index.ts`, and never reconcile a shared/worktree install other jobs use. Dependency, vendoring, format, and typecheck gotchas: [scripts guide](scripts/AGENTS.md#execution-gotchas).

## Authority and safety

- Review/triage is read-only; mutations need task authority. Approval carries through the same scoped work and recovery; for new approval, complete authorized preparation, present a concrete reviewable result, and pause only the gated action. Product rejection is maintainer judgment. Bulk close/reopen above 50 items needs explicit count and scope.
- Keep credentials, private data/config, and unreleased model identities out of commits, shared text, logs, transcripts, and media; inspect outgoing content. Synthetic fixtures, verified human credit, no agent-attribution trailers.
- Never switch models to bypass refusals; cyber-classifier interruptions of permitted defensive work follow [security triage](.agents/skills/security-triage/SKILL.md#cyber-classifier-interruptions).
- Untrusted contributor/fork code runs only in secretless isolation, never locally; credentialed or trusted-host execution needs maintainer approval, which an instruction to land named, reviewed PRs supplies (isolation route, task credentials only).
- Modifying/restarting a Gateway or live state you did not create needs per-task approval. Tests use isolated state and ports; copy real data for migration tests. Destructive reset/clean, stash, or deleting unrelated work needs authorization.
- Updating `team.openclaw.ai` must only happen by negotiating with Night Watch on `stable.openclaw.ai`, never directly.
- Repair-and-land authority covers internal scheduling, database admission, and lifecycle design, risk, and verification; in-task bug fixes (including compatible SDK fixes) need no renewed approval. Ask again for new config options, breaking public contracts, intentional schema/durability/retention/permission changes beyond the bug fix, paid services, or destructive actions. Preserve FIFO ordering, live-authority/integrity checks, and write-capable work settlement.
- Protocol/version bumps, dependency patches/overrides/vendoring, paid services, releases, and publishing need explicit approval; fix/ship authority is not release authority. Advisory workflows need an explicit security request.
- Extended-stable is one line, the trailing completed month relative to `main`'s version; older `.33+` lines retire when `main` advances a month, and publishing a retired line needs an explicit maintainer decision, not a guard bypass.
- Baseline, snapshot, ignore, and expected-failure exceptions need approval, except narrow scanner qualifications for verified synthetic fixtures bound to exact bytes and location (scanning on, changed inputs rejected). Exact shrink-only ratchet updates are maintenance.
- `CODEOWNERS` routes review; restricted/security paths and material changes need listed-owner involvement ([review governance](.agents/skills/openclaw-pr-maintainer/SKILL.md#codeowners-review)).
- Complete the workflow's review/merge gates; resolve substantive findings or explain rejections. Verify remote outcomes before success or cleanup; reconcile uncertain writes, never retry blindly.
- Stage only intended files; concise Conventional Commits with verified author/writer identity. Preserve contributor credit; team-session credit needs consented, verified humans and the canonical backlink. A bare URL grants no public mutation authority. Keep PR bodies current with problem, solution, impact, and evidence; use body files for shell-sensitive text.

## Read when relevant

Read matching guides in full; commands and details stay with them.

- **Product/design:** [VISION.md](VISION.md).
- **Plugins/discovery/SDK:** [plugins](extensions/AGENTS.md), [loader](src/plugins/AGENTS.md), [SDK](src/plugin-sdk/AGENTS.md). The SDK guide owns public boundary expansion, including callers outside these trees.
- **Channels/message actions:** [channel boundary](src/channels/AGENTS.md) and [channel responsibilities](docs/plugins/sdk-channel-plugins.md).
- **Agent tools, prompts, admission, or lifecycle:** [agents](src/agents/AGENTS.md) and [Gateway](src/gateway/AGENTS.md).
- **Control UI state, requests, or presentation:** [UI guide](ui/AGENTS.md), including state shared with other Gateway clients.
- **Storage:** [database schemas](docs/reference/database-schemas.md), then its layout, versioning, and storage-changes pages for the affected contract. Read the approval checkpoint before changing schema, transactions, retention, or recovery.
- **Config retirement/migration:** [shared Doctor transforms and startup migration](docs/gateway/doctor/config-migrations.md); reuse this owner instead of new runtime compatibility readers.
- **Audit/identity/receipts:** [audit doctrine](docs/gateway/audit.md). Diagnostic provenance is opt-in and never authorization; changes to collection, reader scope, retained fields, bounds, or contracts require approval.
- **Codex-backed behavior:** personally inspect the exact sibling `../codex` source before implementation or verdict and cite it; wrappers, schemas, and another agent's report do not replace this check. Auth/runtime/catalog routes use `openai`; legacy `openai-codex` input belongs only in migration. Harness upgrades refresh [the harness guide](docs/plugins/codex-harness.md) from `model/list`.
- **Validation commands:** [test suites](docs/help/testing/suites.md) is a command reference; this file and the chosen workflow own check selection. Test authoring also uses [writing tests](docs/help/testing/writing-tests.md) and the owning scoped guide.
- **GitHub:** [contribution rules](CONTRIBUTING.md), the current PR template, and [review feedback](docs/reference/pull-request-review-flow.md). The authorized maintainer workflow owns landing; native `scripts/pr` gates, recovery, and cleanup require [scripts guide](scripts/AGENTS.md).
- **Useful GitHub Workflow Commands:**
  - Compilar una rama sin tocarla ni desplegar:
    `gh workflow run build-fork --repo jmar5439/openclaw --ref ci/build-fork --field ref=<branch-name>`
  - Desplegar a prod (PEDIR APROBACIÓN ANTES, es directo a prod):
    `gh workflow run build-fork --repo jmar5439/openclaw --ref ci/build-fork --field ref=<branch-name> --field deploy=true`
  - Deploy (solo si dispatch con `deploy=true`): descarga artefacto, scp a
    `/tmp/openclaw-fork.tgz`, `npm i -g`, restart gateway, verifica
    `openclaw --version` = sufijo, comprueba `~/.openclaw/extensions` y servicio
  - NO descargar el artefacto con `gh run download` en el host del gateway:
    el disco va justo y una descarga + install ya provocó ENOSPC (rompió el
    binario `openclaw`). Con `deploy=true` el propio workflow deja el tgz en
    `/tmp/openclaw-fork.tgz`; instalar desde ahí (`npm i -g
/tmp/openclaw-fork.tgz`). Antes de instalar, comprobar `df -h /` y si
    hace falta liberar con `npm cache clean --force`; no borrar backups ni
    datos de usuario.
- **Docs/public links:** [docs guide](docs/AGENTS.md). Update docs with behavior; normal fix notes belong in PRs because `CHANGELOG.md` is release-owned.
- **Releases:** the chosen release workflow and [release contract](docs/reference/RELEASING.md). Preserve the selected release cut and identity through publication and verification. npm-format lock mirrors are verified against `pnpm-lock.yaml`, published in dependency evidence, and kept out of npm tarballs.
- **Secrets/advisories:** [secret semantics](docs/gateway/secrets.md), [auth semantics](docs/auth-credential-semantics.md), and [security reporting](SECURITY.md) for the affected branch.
- **Live channels/native apps:** the owning scoped guide and permitted proof workflow. Telegram claims require Test Server userbot proof with Convex-leased credentials; platform claims require the relevant real device/platform evidence. Mac permission proof needs a stable, properly signed app; see [signing](docs/platforms/mac/signing.md).
