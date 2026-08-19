# The split: format first, exchange second

The public object is the **envelope**: the field names, their meanings, and the
collapse rule. `agentwex.xyz` is one listener for that envelope, not the
protocol. **A runtime can emit a valid receipt without an Agent WEX account, and
without contacting agentwex.xyz at all.**

This document records what that split is, what we took from OpenTelemetry, what
we refuse to take, and where we currently fall short.

Agent WEX is not "OpenTelemetry for agents." It emits one signal, on purpose,
and carries a counting rule OpenTelemetry does not have.

## Why the split

OpenTelemetry succeeded because the ticket format is public and the backend is
optional. Applications emit. A local collector batches off the hot path. Many
backends can listen. Nobody installs a vendor in order to speak OTLP.

If Agent WEX is the only thing that can hear a receipt, then Agent WEX is a
product with a wire format, and a reasonable engineer routes around it. The
format has to survive us.

## The map

| OpenTelemetry | Agent WEX | Where it lives |
| --- | --- | --- |
| API (`start_span`) | the receipt constructor — one call, one completed tool outcome | `js/lib/receipt.mjs` |
| SDK | local minimizer, Ed25519 signing, batching, retry | `js/lib/`, `agentwex install` |
| OTLP + semantic conventions | the v0.1 schemas and the frozen public cell names | `exchange/knowledge-exchange-v0.1/*.schema.json`, [SEMCONV.md](SEMCONV.md) |
| Resource (`service.name`) | signed node, participant, **controller group** | receipt + exchange |
| Span | one minimized tool outcome, success or failure, in one cell | receipt |
| Collector agent | localhost collector, after the call completes, off the execution path | `js/lib/daemon.mjs` |
| Collector gateway | the hosted exchange — **optional**, fan-out permitted | `agentwex.xyz` |
| Backend | WEX exchange, a JSONL file, a GitHub check, a Pipelock verifier | pluggable |
| Sampling | we do not sample, we minimize: see the never-send list in [PRIVACY.md](PRIVACY.md) | node |
| `traceparent` | provenance fingerprint on the receipt | receipt |

`Resource` is the load-bearing row. In OpenTelemetry, `service.name` describes
what emitted a span and nothing more. Here the equivalent field is
**controller group**, and it is the difference between evidence and noise.

## What we take

1. **Spec split.** API, SDK, envelope, collector and backend are separate
   objects with separate lifetimes. The exchange is not the protocol.
2. **Locked names.** The public cell is frozen in [SEMCONV.md](SEMCONV.md). A
   field that must change is a new schema version, never a silent rename.
3. **Off the hot path.** Delivery happens after the tool call completes.
   Preflight is optional weather, never a gate that blocks a call by default.
4. **Fan-out.** One emit, many listeners. The destination is an interface, and
   the hosted exchange is one implementation of it.
5. **Who versus what.** Rates and support are computed over the latest accepted
   outcome **per controller group**, while signed-node and participant counts
   are still reported separately. Repeats from one node refresh recency and add
   no support.
6. **Credits are access units.** They are earned and spent for route access and
   never affect evidence weight.

## What we refuse

- **The signal zoo.** No traces, metrics, logs, profiles or baggage. One signal:
  a completed tool outcome.
- **Auto-instrument everything.** A runtime declares what it emits.
- **Ten receipts as ten votes.** See below; this is the whole point.
- **A foundation before a second emitter.** No org, no committee, no governance
  ceremony until something outside this repository actually emits.
- **Authority.** No route, label, alert or assessment is permission to act.
  Every returned route keeps `evidenceStatus: unverified-network-evidence`,
  `controllerIndependenceVerified: false`, `executionTruthVerified: false`,
  `gateRequired: true`, `authorityGranted: false`.
- **Vendoring the proofs.** The counting proofs live in Minority Prophet, which
  is public and Apache-2.0. Cite it. Do not copy Lean into this repository.

## The rule that has to travel

OpenTelemetry will happily count ten identical spans as ten. That is correct for
telemetry and wrong for evidence.

> **Ten photocopies are not ten cooks.** Extra keys, runtimes, devices, bots or
> VMs under one controller do not manufacture independent support.

This is the one part of the envelope that is **not** a field. It is a
requirement on whoever counts:

> A conformant listener MUST collapse observations to at most one per controller
> group before computing support, coverage, ranking or preflight. Signed-node
> and participant counts MAY be reported, and MUST NOT be substituted for the
> controller-group count.

Publishing the field names without this rule would publish a convenient,
standard way to make exactly the mistake this project exists to prevent. So the
rule is normative, and it is testable: see
`conformance/collapse/` for frozen vectors with expected outputs. A listener
that passes them counts controllers. A listener that does not, does not — and
can find out without asking us.

The rule is cheap to obey because the reference implementation is already
public: see [Minority Prophet](https://github.com/Silentpartnercoding/minority-prophet)
for the aggregation and its proofs. Requiring collapse is not an unfunded
mandate.

## Gaps

Honest inventory. No fake emitters.

**Already true**

- Localhost collector, after completion, off the execution path.
- Bounded request bodies and local token authentication (see SECURITY.md).
- Duplicate collapse by controller group in coverage, reliability and preflight.
- Minimizer with an explicit never-send list, verifiable offline via
  `agentwex inspect`.
- Controller groups distinct from signed nodes and participants, reported
  separately.
- Destination is an interface; a JSONL file exporter ships in this repository.

**Not yet true**

- **No second emitter.** Nothing outside this repository emits a receipt. Until
  that exists, the split is a design, not a demonstrated property.
- **No Linux collector.** macOS only in the public preview.
- **No Sybil resistance.** Controller grouping is declared and heuristic. A
  determined operator can present as several controllers. `controllerIndependenceVerified`
  is `false` for this reason and must stay false.
- **No independent security review.**
- **Version labelling is inconsistent.** The node emits
  `minority-prophet.working-route-comp.v0.1` while including fields the schema
  files introduce at v0.3. Recorded in [SEMCONV.md](SEMCONV.md), not silently
  resolved.
- **Conformance vectors cover collapse only.** Minimization and freshness have
  no frozen vectors yet.
