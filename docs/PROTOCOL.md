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

The executable v0.1 schemas and evaluator live in
`exchange/knowledge-exchange-v0.1/`.
