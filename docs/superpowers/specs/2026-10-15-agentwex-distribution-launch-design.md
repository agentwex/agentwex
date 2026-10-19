# AgentWEX Distribution-First Launch Design

**Date:** 2026-10-15  
**Status:** Approved architecture; implementation pending  
**Scope:** AgentWEX Waze/reliability network, not the research-bounty product

## Problem

AgentWEX is publicly reachable, machine-readable, and installable, but those facts do not make it discoverable by most agents. Agents generally learn about capabilities through an installed skill or extension, a marketplace or directory they already consult, a repository already in context, or a direct recommendation. The repository currently contains Codex/OpenAI, Claude, Gemini, npm, crawler, and agent-facing artifacts, but it does not establish that the plugin or extension has been accepted into an official discovery channel. Some distribution metadata has also drifted from the current release.

At the same time, the network has a cold-start problem. A first user can install and contribute, but cannot expect independent community evidence to exist for the exact compatibility cell they need. AgentWEX must give that user honest immediate value without representing one user's history—or multiple first-party machines—as independent network consensus.

## Goals

1. Make AgentWEX installable from the places Codex/OpenAI, Claude, Gemini, and command-line agents already look.
2. Give the first user useful local recall before the public network has coverage.
3. Preserve the existing controller-group independence rule for all public support claims.
4. Make credits visibly useful without implying cash value or weakening evidence quality.
5. Measure the acquisition and activation funnel from discovery through a successfully unlocked route.
6. Keep all installation, route execution, spending, and configuration changes behind the existing user or local-policy approval boundary.

## Non-goals

- AgentWEX will not autonomously execute a recovered route.
- The launch will not intercept every tool call or replace a runtime's policy gate.
- Local history will not earn credits, unlock a route, or count toward public network support.
- The initial launch will not promise transferable value, USDC redemption, or paid bounties.
- The initial launch will not claim full Linux or Windows background-service support.
- The bounty product is not part of this release except that its install metadata must not contradict the canonical AgentWEX release.

## Product Model

AgentWEX will present one reliability journey with three evidence layers:

1. **Local recall** — private outcomes previously observed by this installation. This is useful to the owner but is not independent evidence.
2. **First-party laboratory reproduction** — multiple signed participants controlled by AgentWEX. This may reproduce a condition but remains one controller group.
3. **Network-supported evidence** — current accepted outcomes from at least two independent controller groups for the exact compatibility cell.

The preflight response must label these layers separately. The strongest available layer may inform a recommendation, but only network-supported evidence may be described as community or network support.

## Distribution Architecture

### Canonical release metadata

One version source must drive npm package metadata, release JSON, Codex/OpenAI plugin metadata, Claude plugin and marketplace metadata, Gemini extension metadata, skill text, installation commands, checksums, and public download links. Release verification must fail on version or integrity drift.

The existing local Codex/OpenAI marketplace manifest is a repository-development entry point, not proof of directory publication. Public copy and internal release status must distinguish:

- package prepared;
- package validated;
- package submitted;
- package accepted/listed.

No surface may say AgentWEX is listed until that external status is verified.

### Agent-native entry points

The canonical AgentWEX skill should trigger only for repeated, fragile, high-cost, or known-public-tool compatibility work. It should instruct the agent to:

1. explain the local changes and privacy boundary;
2. request explicit approval before installation;
3. install the canonical pinned release;
4. verify node readiness;
5. run free preflight before another costly retry;
6. require local approval or policy authorization before route execution or credit spending.

The repository and website will expose consistent agent-readable instructions for each supported runtime. Installation remains a separate, explicit user decision even when discovery occurs through a plugin or extension.

## Local Recall

The node will maintain a bounded local index derived only from the minimized route-outcome records it already creates. It must not retain prompts, raw arguments, tool results, credentials, source code, customer content, or additional telemetry.

For an exact compatibility query, `agentwex preflight` will:

1. evaluate matching local outcomes offline;
2. query the exchange when available;
3. return one assessment containing clearly separated `localRecall`, `labEvidence`, and `networkEvidence` sections;
4. describe the source, freshness, sample count, and limitations of each layer;
5. preserve the existing gate-required and authority-not-granted fields.

Local recall must work when the exchange is unreachable. It must never alter controller-group counts, mint credits, or convert an unsupported route into a network-supported route.

## Credits

The launch retains the current evidence-quality schedule:

- a fresh independently additive accepted contribution earns two credits;
- an established independently additive accepted contribution earns one credit;
- duplicate, rejected, or non-additive outcomes earn zero;
- unlocking a sealed supported route costs one credit;
- aggregate preflight and local recall remain free.

CLI and web surfaces should show the balance together with concrete utility: whether a matching route is available, whether it is lab-observed or network-supported, and what an unlock would cost. Credits remain non-transferable access units and never influence trust weight.

## Public Proof and Funnel Measurement

The public coverage page will continue separating network-supported cells from first-party lab cells. It should additionally explain the local-recall layer without publishing local data. The owner console and acquisition telemetry should measure, without storing private workload content:

1. discovery/instruction view;
2. install instruction copied;
3. node registration;
4. installation completed;
5. node ready;
6. first preflight;
7. first local-recall hit;
8. first accepted contribution;
9. first credit earned;
10. first route unlocked;
11. bounded outcome feedback after the attempted route.

Public claims must be derived from accepted evidence and rounded/privacy-safe aggregates. Install counts are adoption metrics, not evidence of independent support.

## Safety and Privacy Invariants

- Existing telemetry destinations are never overwritten; conflicts fail closed.
- Discovery does not authorize installation.
- Installation does not authorize a tool action.
- Preflight does not authorize a route.
- A returned route remains subject to the caller's own policy gate.
- Local recall stays on the installation unless it independently qualifies for the existing minimized contribution flow.
- First-party devices remain collapsed into the first-party controller group.
- Sparse public evidence remains withheld under the current privacy policy.
- Secrets, private workload content, and raw tool payloads are not added to analytics or local recall.

## Platform Scope

The launch remains an explicit macOS public preview with Node.js 22.13 or newer. Linux service installation is the next platform target after this release is stable. Existing schema support for other environments must not be described as installer support.

## Launch Criteria

The release is launchable when:

1. all checked-in and generated distribution artifacts agree on version and integrity;
2. the canonical install path succeeds from a clean supported macOS environment;
3. Codex/OpenAI, Claude, and Gemini packages pass their local validation and have truthful external publication status;
4. local-first preflight works offline and cannot inflate network evidence or credits;
5. acquisition events cover the funnel through first route outcome without private payloads;
6. coverage and account surfaces clearly distinguish local, lab, and network evidence;
7. lint, unit/integration tests, production build, release verification, and an end-to-end lifecycle smoke test pass;
8. the live site and published npm tarball match the committed release metadata;
9. at least one controlled external pilot installation completes the full install-to-preflight journey before paid acquisition begins.

## Deferred Work

- automatic interception of arbitrary tool calls;
- Linux and Windows background-service installers;
- transferable or monetary credits;
- route replication requests as an additional credit sink;
- automatic paid acquisition scaling before activation and retention data exists.

