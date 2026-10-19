# AgentWEX Distribution-First Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an honestly distributed AgentWEX macOS preview that gives a first user private local recall, keeps network evidence independent, exposes useful credit utility, and measures activation through route outcome.

**Architecture:** Add a bounded privacy-minimized local-outcome index to the existing node state, then compose it additively with the hosted preflight response without changing server trust counts. Centralize release metadata validation so every discovery artifact agrees with the npm package, extend the existing attributed lifecycle ledger through activation, and update public/agent surfaces to distinguish prepared packages from verified marketplace listings.

**Tech Stack:** Node.js 22.13+ ESM, `node:test`, Cloudflare D1, Vinext/Next.js 16, React 19, npm package distribution, Sites hosting.

**Spec:** `docs/superpowers/specs/2026-10-15-agentwex-distribution-launch-design.md`

## Global Constraints

- Public preview remains macOS-only with Node.js `>=22.13.0`.
- Existing telemetry destinations must never be overwritten; conflicts fail closed.
- Local recall stores no prompts, raw arguments, results, credentials, source code, customer content, URLs, raw spans, or raw trace identifiers.
- Local outcomes grant zero credits and never change signed-node, participant, or controller-group counts.
- Network support still requires at least two distinct controller groups; first-party machines remain one controller group.
- Aggregate preflight and local recall cost zero credits; a sealed route unlock costs one earned credit.
- Discovery does not authorize installation; installation and preflight do not authorize route execution.
- No surface may claim directory or marketplace listing without verified external acceptance.
- Credits remain non-transferable access units with no cash or USDC claim.
- Use one canonical release version; the next implementation release is `0.7.0` because layered preflight changes CLI output materially.

## Review Focus

- A corrupt or legacy `state.json` must not crash preflight; it should yield empty local recall and preserve the remote assessment.
- A future-dated or invalid local observation must be excluded instead of producing negative freshness.
- An exchange timeout must still return local recall, `exchangeStatus: "unavailable"`, no route details, and `authorityGranted: false`.
- Repeated lifecycle reporting must be idempotent per attributed installation and milestone.
- Stale version/checksum/install-copy drift across any discovery artifact must fail release verification.

---

### Task 1: Canonical Release Metadata and Truthful Publication State

**Files:**
- Create: `scripts/release-metadata.mjs`
- Create: `distribution/publication-status.json`
- Modify: `scripts/build-release.mjs`
- Modify: `package.json`
- Modify: `js/package.json`
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `gemini-extension.json`
- Modify: `openai-plugin/agentwex/.codex-plugin/plugin.json`
- Modify: `openai-plugin/discovery-evals.json`
- Modify: `docs/agent.json`
- Test: `tests/distribution.test.mjs`

**Interfaces:**
- Consumes: canonical version from `js/package.json` and archive digest from the release builder.
- Produces: `readReleaseVersion(root) -> Promise<string>`, `synchronizeReleaseMetadata(root, release?) -> Promise<void>`, and `verifyReleaseMetadata(root) -> Promise<{ version: string, checked: string[] }>`.

- [ ] **Step 1: Write failing release-drift tests**

Add tests asserting every listed manifest equals `js/package.json.version`, every pinned install command uses that version, `distribution/publication-status.json` accepts only `prepared|validated|submitted|listed`, and no `listed` status lacks both `verifiedAt` and `verificationUrl`. Add a temporary-directory test showing `verifyReleaseMetadata()` rejects one stale manifest.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/distribution.test.mjs`

Expected: FAIL because `release-metadata.mjs` and publication state do not exist and Claude still reports `0.6.2`.

- [ ] **Step 3: Implement canonical synchronization and verification**

Implement the three exported functions in `scripts/release-metadata.mjs`. The synchronizer updates structured JSON only; human-authored prose remains checked by exact version/install-command assertions. `build-release.mjs` must call synchronization after it creates release metadata, then verification before success. Add `npm run verify:release`.

- [ ] **Step 4: Bump the implementation release and mark external channels truthfully**

Set all package and discovery versions to `0.7.0`. Initialize Codex/OpenAI, Claude, and Gemini publication statuses to the highest state supported by repository evidence—never `listed` without an acceptance URL and timestamp.

- [ ] **Step 5: Verify and commit**

Run: `npm run verify:release && node --test tests/distribution.test.mjs`

Expected: both commands PASS and print version `0.7.0`.

Commit: `feat: centralize AgentWEX release metadata`

### Task 2: Bounded Private Local Recall

**Files:**
- Create: `js/lib/local-recall.mjs`
- Modify: `js/lib/daemon.mjs`
- Modify: `js/lib/config.mjs`
- Test: `tests/local-recall.test.mjs`
- Test: `tests/awe-node.test.mjs`

**Interfaces:**
- Consumes: minimized signed receipt shape emitted by `adaptOtelSpanToRouteOutcome()`.
- Produces: `localOutcomeFromReceipt(receipt) -> LocalOutcome`, `rememberLocalOutcome(outcomes, receipt, limit = 250) -> LocalOutcome[]`, and `assessLocalRecall(outcomes, query, evaluatedAt?) -> LocalRecallAssessment`.

- [ ] **Step 1: Write failing local-recall unit tests**

Cover exact compatibility matching across all eight required cell fields, newest-first ordering, `maxAgeDays`, 250-record retention, corrupt/missing arrays, future/invalid dates, and explicit absence of `routeFingerprint`, `provenanceRootId`, attestation, prompt, arguments, result, URL, and trace ID. Assert the assessment includes `source: "private-local-history"`, counts, success rate, last observation, freshness, and `establishesNetworkSupport: false`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/local-recall.test.mjs`

Expected: FAIL because `js/lib/local-recall.mjs` does not exist.

- [ ] **Step 3: Implement the bounded index**

Store only public compatibility fields, `outcome`, bounded `errorClass`, `resolutionKind`, and `observedAt`. Deduplicate byte-identical local outcomes, sort newest first, and retain at most 250. Matching must require tool registry/id/version, client id/version, environment, auth mode, and operation; capability/effect additionally match when the query supplies them.

- [ ] **Step 4: Persist local outcomes before exchange delivery**

In `createNodeRuntime()`, initialize `state.localOutcomes` for legacy state, call `rememberLocalOutcome()` after a receipt is minimized and before any network exporter runs, and persist even when exchange export fails. Do not add local outcomes to credits, queries, controller counts, or hosted submissions beyond the existing contribution flow.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/local-recall.test.mjs tests/awe-node.test.mjs`

Expected: PASS, including an exchange-failure case whose local recall survives and contains no prohibited fields.

Commit: `feat: add private bounded local outcome recall`

### Task 3: Layered Local-First Preflight and Credit Utility

**Files:**
- Create: `js/lib/layered-preflight.mjs`
- Modify: `js/bin/agentwex.js`
- Modify: `js/README.md`
- Modify: `README.md`
- Test: `tests/layered-preflight.test.mjs`
- Test: `tests/awe-node.test.mjs`

**Interfaces:**
- Consumes: `assessLocalRecall(outcomes, query, evaluatedAt)`, `preflight(config, query)`, `getAccount(config)`, and cached `state.creditBalance`.
- Produces: `runLayeredPreflight({ configPath, config, query, remotePreflight?, remoteAccount?, evaluatedAt? }) -> Promise<LayeredPreflightAssessment>` using schema `agentwex.layered-preflight-assessment.v0.1`.

- [ ] **Step 1: Write failing composition tests**

Assert one returned object contains `localRecall`, `labEvidence`, `networkEvidence`, `creditUtility`, `recommendation`, `exchangeStatus`, and `authorityGranted: false`. Test remote success, remote no-evidence, timeout with local hit, timeout with no local data, a lab-only route, a network-supported route, sufficient/insufficient credits, and corrupt legacy state.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/layered-preflight.test.mjs`

Expected: FAIL because the layered composer does not exist.

- [ ] **Step 3: Implement local-first composition**

Read state before network calls. `labEvidence` may only reflect exchange fields explicitly marked lab-observed; `networkEvidence` may only reflect a supported route/controller count from the exchange. On exchange failure return no sealed route or unlock capability. `creditUtility` must include current/cached balance, unlock cost, route availability, support level, and `canUnlock`, without implying monetary value.

- [ ] **Step 4: Route the CLI through layered preflight**

Keep the existing required arguments and `--unlock` behavior. Print only the layered assessment. Add help and docs explaining that local recall is private memory, not network consensus; route details remain sealed unless a hosted result is deliberately unlocked.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/layered-preflight.test.mjs tests/awe-node.test.mjs`

Expected: PASS; an offline CLI fixture exits successfully with local evidence and `exchangeStatus: "unavailable"`.

Commit: `feat: compose local and network preflight evidence`

### Task 4: Activation and Credit-Utility Measurement

**Files:**
- Modify: `db/exchange-store.mjs`
- Modify: `js/lib/daemon.mjs`
- Modify: `js/bin/agentwex.js`
- Modify: `app/owner/owner-console.tsx`
- Test: `tests/exchange-api.test.mjs`
- Test: `tests/awe-node.test.mjs`
- Test: `tests/site-surface.test.mjs`

**Interfaces:**
- Consumes: existing authenticated `recordLifecycleEvent(config, eventName, eventData)` and acquisition mapping.
- Produces: idempotent attributed milestones `preflight_run`, `local_recall_hit`, `contribution_accepted`, `credit_earned`, `route_unlocked`, and `route_outcome_reported`.

- [ ] **Step 1: Write failing milestone tests**

Extend exchange API tests so the six events are accepted, unknown names and private/free-text event data are rejected, and duplicate milestone submissions for the same acquisition/agent/event are counted once. Extend owner snapshot assertions with `preflights`, `localRecallHits`, `contributors`, `creditEarners`, `routeUnlockers`, and `routeOutcomes`.

- [ ] **Step 2: Run the focused server test and verify failure**

Run: `node --test tests/exchange-api.test.mjs`

Expected: FAIL with `invalid_lifecycle_event` or missing funnel counters.

- [ ] **Step 3: Extend the bounded lifecycle ledger**

Add the six event names, restrict event data to low-cardinality booleans/numbers/enums, and make acquisition milestones idempotent by acquisition, agent, and event name. Update aggregate and campaign queries without changing evidence or credit tables.

- [ ] **Step 4: Emit milestones from owning workflows**

Layered preflight emits `preflight_run` and, only on a hit, `local_recall_hit`. Daemon reconciliation emits `contribution_accepted` and `credit_earned` only on first observed transition. A successful unlock emits `route_unlocked`; successful feedback submission emits `route_outcome_reported`. Store local sent-milestone keys to prevent repeated network calls.

- [ ] **Step 5: Update the owner funnel and verify**

Add the new stages after ready node while keeping the console read-only and content-free.

Run: `node --test tests/exchange-api.test.mjs tests/awe-node.test.mjs tests/site-surface.test.mjs`

Expected: PASS with no prompt, argument, result, credential, or free-text fields stored.

Commit: `feat: measure AgentWEX activation through route outcome`

### Task 5: Agent-Native Discovery and Honest Public Surfaces

**Files:**
- Modify: `skills/agentwex/SKILL.md`
- Modify: `openai-plugin/agentwex/skills/agentwex/SKILL.md`
- Modify: `openai-plugin/SUBMISSION.md`
- Modify: `openai-plugin/discovery-evals.json`
- Modify: `GEMINI.md`
- Modify: `public/exchange/skill.md`
- Modify: `public/llms.txt`
- Modify: `public/llms-full.txt`
- Modify: `public/exchange/agent.json`
- Modify: `app/for-agents/page.tsx`
- Modify: `app/coverage/page.tsx`
- Modify: `app/coverage/coverage-grid.tsx`
- Modify: `app/globals.css`
- Test: `tests/distribution.test.mjs`
- Test: `tests/site-surface.test.mjs`

**Interfaces:**
- Consumes: release version/status from Task 1 and the three-layer semantics from Tasks 2–3.
- Produces: synchronized discovery instructions and public copy with no unsupported listing or independence claims.

- [ ] **Step 1: Write failing copy/manifest tests**

Assert all agent skills trigger for repeated, fragile, high-cost, or public-tool compatibility calls; require approval before install and spend; explain local/lab/network evidence; never equate installs with support; and expose publication status without claiming acceptance. Add discovery evals for expensive-first-call preflight, offline local recall, ordinary private debugging, and unauthorized execution.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --test tests/distribution.test.mjs tests/site-surface.test.mjs`

Expected: FAIL on missing local-recall and publication-status copy.

- [ ] **Step 3: Update machine-facing instructions**

Keep every skill's behavioral trigger and approval boundary equivalent. Describe the plugin/extension as a discovery package until its verified publication status says otherwise. Explain the canonical one-command node install and macOS/Node requirement.

- [ ] **Step 4: Update human-facing pages**

On `/for-agents`, lead with where agents actually discover AgentWEX and distinguish available install paths from verified listings. On `/coverage`, add a three-layer explainer: private local recall, first-party lab reproduction, and network-supported evidence. Preserve the black moving-grid AgentWEX style and readable contrast.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/distribution.test.mjs tests/site-surface.test.mjs && npm run build`

Expected: PASS; generated pages contain no marketplace listing claim unless status evidence permits it.

Commit: `feat: clarify AgentWEX discovery and evidence layers`

### Task 6: Release, External Validation, and Controlled Pilot

**Files:**
- Modify: `scripts/smoke-production.mjs`
- Modify: `scripts/smoke-live-lifecycle.mjs`
- Modify: `exchange/knowledge-exchange-v0.1/PRODUCTION-READINESS.md`
- Modify after verified external action only: `distribution/publication-status.json`
- Generated: `release/agentwex-0.7.0.tgz`
- Generated: `release/release.json`
- Generated: `release/SHA256SUMS`
- Generated: `public/exchange/agentwex-0.7.0.tgz`
- Generated: `public/exchange/release.json`
- Generated: `public/exchange/SHA256SUMS`

**Interfaces:**
- Consumes: all prior tasks and the existing Sites project in `.openai/hosting.json`.
- Produces: immutable `0.7.0` artifacts, a deployed site, a published npm package when authenticated, truthful marketplace submission state, and a recorded external pilot result.

- [ ] **Step 1: Extend smoke checks before release**

Production smoke must verify live version/install metadata, three-layer copy, distribution status, and zero unsupported listing claims. Lifecycle smoke must cover install → ready → local outcome → layered preflight → contribution accepted → credit earned → route unlock → outcome feedback.

- [ ] **Step 2: Run the full local verification suite**

Run: `npm run verify && npm run verify:release`

Expected: lint, all tests, build, and release metadata verification PASS.

- [ ] **Step 3: Build and inspect the immutable package**

Run: `npm run release && npm pack --dry-run ./js`

Expected: dependency-free `agentwex-0.7.0.tgz`, no lifecycle scripts, Node `>=22.13.0`, and matching SHA-256 values across release JSON, discovery manifest, and hosted archive.

- [ ] **Step 4: Publish authenticated surfaces without overstating status**

Use the `sites:sites` skill to deploy the verified website. Publish `agentwex@0.7.0` to npm only if the authenticated npm identity and package ownership are verified. Submit Codex/OpenAI, Claude, and Gemini packages only through the intended authenticated owner identity; update each publication status to `submitted` or `listed` only after retaining its external receipt/URL.

- [ ] **Step 5: Run live smoke and one controlled external pilot**

Run: `npm run smoke:production` and the live lifecycle smoke against a clean, non-first-party pilot installation. Confirm the external node remains a provisional community controller until evidence justifies any stronger mapping; do not manufacture network support.

- [ ] **Step 6: Record readiness and commit**

Update production readiness with commands, immutable digests, live URLs, publication receipts/status, and the pilot's content-free milestone result.

Commit: `release: ship AgentWEX 0.7.0 distribution launch`

## Self-Review Result

- Spec coverage: distribution, local recall, independence, credit utility, funnel measurement, public proof, safety, macOS scope, and launch verification are each owned by a task.
- Step scan: every step has one checkable output; external publication is isolated from code changes and cannot silently overstate status.
- Type consistency: Tasks 2–3 share `LocalOutcome`/`LocalRecallAssessment`; Task 3 owns the single layered response; Task 4 consumes only milestone facts.
- Review-focus coverage: corrupt state and invalid time are tested in Task 2, exchange timeout in Task 3, lifecycle idempotency in Task 4, and release drift in Task 1.
- Proportion: the plan specifies interfaces and assertions without transcribing implementation bodies.

