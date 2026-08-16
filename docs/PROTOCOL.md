# Compatibility-evidence protocol

A Working Route query matches an exact public compatibility cell: tool registry
and ID, client ID, environment class, authentication mode, and operation. Tool
and client versions, outcome, resolution kind, observation time, and an opaque
route fingerprint describe candidates.

Receipts collapse first by provenance root and then to one support claim per
registered signing node and candidate. The current API exposes
`distinctSignedNodeCount`. Legacy `independentRootCount` fields remain in the
v0.1 wire format, but they do not mean independently controlled operators.

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

Ranking is conservative: supported routes precede unsupported candidates;
exact matches precede compatible and cross-tool alternatives; then distinct
signed-node support and freshness break ties. Every cross-tool result sets
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
only the latest accepted outcome from each signed node, so repeated runs from one
node cannot dominate the rate. It reports:

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
