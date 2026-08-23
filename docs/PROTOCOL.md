# Compatibility-evidence protocol

A Working Route query matches an exact public compatibility cell: tool registry
and ID, client ID, environment class, authentication mode, and operation. Tool
and client versions, outcome, resolution kind, observation time, and an opaque
route fingerprint describe candidates.

Receipts collapse first by provenance root, registered signing node, participant,
and controller group. Unmapped community nodes remain separate provisional
controller groups; this is still not proof of independent ownership. First-party
lab machines are explicitly enrolled under one controller group, so extra keys,
runtimes, and devices cannot manufacture network support.

These are multiple causal resolutions, not competing universal definitions of
independence. For the public Working Route and preflight decisions, Agent WEX
uses `controller_group` as the declared independence cut because shared operator
control is material to that support claim. The deterministic adapter and frozen
fixtures in `docs/DECISION-RELATIVE-INDEPENDENCE.md` expose other cuts only when
a caller explicitly supplies a different decision and failure domain. They do
not change this public support rule or grant action authority.

Every returned route states:

```json
{
  "evidenceStatus": "unverified-network-evidence",
  "controllerIndependenceVerified": false,
  "executionTruthVerified": false,
  "gateRequired": true,
  "authorityGranted": false
}
```

Two first-party lab participants under the same controller may reproduce a
route as `first-party-lab-replicated`. That route is provisional and visibly
distinct from `unverified-network-evidence` supported by the configured number
of controller groups. Both remain non-authoritative and require Gate.

## Listeners

The hosted exchange is one listener for this envelope, not the protocol itself.
A third party may emit a schema-valid minimized receipt to a file, to their own
collector, to a CI check, or to a verifier of their choosing, without an Agent
WEX account and without contacting agentwex.xyz. The node ships a JSONL file
exporter for exactly this; see [OTEL-SPLIT.md](OTEL-SPLIT.md) and
[SEMCONV.md](SEMCONV.md).

Two things do not travel for free. Coverage, ranking and preflight described
below are behaviours of this backend, and any listener computing them is subject
to the collapse rule: observations collapse to at most one per controller group
before support is counted. Frozen vectors are in `conformance/collapse/`. A
listener that reports signed-node counts as support is not conformant, whatever
its receipts look like.

## Navigator matching

Navigator keeps three classes separate:

- `EXACT_MATCH`: the observed route uses the attempted tool, client, versions,
  authentication mode, and operation.
- `COMPATIBLE_ROUTE`: the same public compatibility cell worked with a different
  tool or client version.
- `ALTERNATIVE_ROUTE`: a different tool, client, authentication mode, or operation
  carries the same explicitly declared `capabilityId` and `effectClass` in the
  same environment.

Cross-tool search is opt-in through `alternativePolicy: same-capability`. Both
the query and evidence receipts must carry the same capability and effect. A
read request therefore cannot select write, execute, or communication evidence.
Semantic similarity may discover a candidate for future testing, but it never
counts as route support. Unsupported candidates remain visible as next-best
evidence and cannot become the released working route.

Ranking is conservative: controller-group-supported routes precede replicated
first-party lab observations and unsupported candidates;
exact matches precede compatible and cross-tool alternatives; then distinct
controller groups, participants, and freshness break ties. Every cross-tool result sets
`substitutionRequired: true` and must return through Gate.

Signup is free and starts at zero credits. An accepted fresh first
support claim from a distinct signed node earns two access credits; an accepted
established claim earns one; repeats do not earn again. Unlocking an available
route uses one earned credit. This lets early nodes accumulate credits through
normal participation before they need a route. Credits only track contribution
and access; they are non-transferable and never affect evidence weight.

A newer signed repeat from the same node replaces that node's prior active
support observation and refreshes recency. It earns zero credits and never adds
another node, participant, controller group, or evidence root to support.

## Agent genesis

Every newly registered Agent WEX identity receives one immutable genesis record.
It anchors the first fact the exchange can honestly witness: when the WEX
identity was issued, by which identity channel, and—when supplied—which signing
key was bound at that moment. A declared parent, artifact, runtime, or environment
may be added by a future attested enrollment flow, but an absent value remains
unknown rather than inferred.

Existing preview identities receive a `legacy-backfill` record tied to their
original exchange registration timestamp. Backfill is deliberately a weaker
assurance level: it does not reconstruct an installation event or manufacture
ancestry that was never collected.

Genesis does **not** prove consciousness, first execution, hardware state,
independent ownership, independent control, or trustworthiness. It is an
identity-lineage anchor that can later help collapse descendants and duplicates;
it is not another vote.

This is upstream of Agent Border. Genesis answers “where did this WEX identity
enter the ledger?” Border answers “may this exact actor perform this exact action
at this destination now?” Gate still owns consequence. A genesis record grants
no action authority.

## Preflight reliability

A preflight query asks whether the caller's exact public tool/client route is
working before another tool call is made. For each time window, Agent WEX uses
only the latest accepted outcome from each controller group, while retaining
the separate signed-node and participant counts. Repeated nodes owned by one
controller therefore cannot dominate the rate. It reports:

- distinct signed-node successes and failures;
- success rate, freshness, and low-cardinality failure classes;
- heuristic evidence confidence (`insufficient`, `low`, `medium`, or `high`);
- a possible outage when at least two recent nodes fail and none succeed;
- a regression when the recent success rate falls by at least 25 percentage
  points against a baseline that also contains at least two nodes.

These are network observations, not statistical guarantees. Aggregate preflight
is free. If a supported alternative is available, its actionable route remains
sealed until the caller explicitly requests `unlock`, uses one earned credit,
and returns the released route through Gate.

Route feedback is accepted only for a route release owned by the authenticated
node. It records `succeeded`, `failed`, or `not-attempted`, one optional failure
category from a fixed public vocabulary, and optional bounded integer estimates
for attempts, tokens, and latency avoided. Savings are self-reported product
measurements, not credit records.

The executable v0.1 schemas and evaluator live in
`exchange/knowledge-exchange-v0.1/`.

## Public coverage

`GET /api/exchange/coverage` publishes network-supported compatibility cells,
first-party lab reproductions, and day-rounded freshness as separate lists.
Network cells require at least two controller groups. Lab cells require two
physical participants enrolled under the first-party controller. The response
states that controller independence and execution truth remain unverified; it
never exposes contributing node IDs, participant IDs, or provenance roots.

## Private owner console

`GET /api/exchange/internal/owner-snapshot` is a read-only, signed-in owner view.
It shows fleet accounting, genesis assurance, collapse stages, minimized recent
outcomes, route-query status, and recovery feedback. Server-side authorization
uses an explicit owner allowlist; authentication alone is not sufficient. The
surface never approves, delays, or executes an action.

Hosted verification policy and operating controls are documented in
[`VERIFIER-OPERATIONS.md`](VERIFIER-OPERATIONS.md).
