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

Hosted verification policy and operating controls are documented in
[`VERIFIER-OPERATIONS.md`](VERIFIER-OPERATIONS.md).
