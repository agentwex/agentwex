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

Signup starts at zero credits and requires no payment. An accepted fresh first
support claim from a distinct signed node earns two access credits; an accepted
established claim earns one; repeats do not earn again. Unlocking an available
route spends one credit. This lets early nodes accumulate credits through normal
participation before they need a route. Credits are access units, not currency,
tokens, a subscription, or trust weight, and there is no purchase path.

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
sealed until the caller explicitly requests `unlock`, spends one earned credit,
and returns the released route through Gate.

Route feedback is accepted only for a route release owned by the authenticated
node. It records `succeeded`, `failed`, or `not-attempted`, one optional failure
category from a fixed public vocabulary, and optional bounded integer estimates
for attempts, tokens, and latency avoided. Savings are self-reported product
measurements, not currency or billing records.

The executable v0.1 schemas and evaluator live in
`exchange/knowledge-exchange-v0.1/`.
