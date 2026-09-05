# Research bounty bridge v0.1

This adapter accepts deliberately public, sanitized research bounties from
Invention Graph without receiving its private graph, hypotheses, sources,
prompts, model bindings, candidate parameters, or internal experiment IDs.

The publisher creates a public specification and approves it locally. The
bridge assigns a random opaque `sourceBountyId`; the corresponding private
experiment digest remains in Invention Graph's local bridge ledger. AgentWEX
stores only the public envelope and candidate submissions.

Authenticated API surface:

- `POST /api/exchange/research-bounties` publishes an idempotent envelope.
- `GET /api/exchange/research-bounties` lists open public research bounties.
- `POST /api/exchange/research-bounties/:id/submissions` records a public
  artifact and a bounded evidence summary as a candidate.
- `GET /api/exchange/research-bounties/:id/quality` lets only the publishing
  node poll structural quality and review readiness.

The quality score measures declared acceptance-criterion coverage, observation
count, distinct declared provenance-root labels, and presence of a
reproducibility receipt. AgentWEX does not infer that the roots are independently
controlled.
It is triage, not peer review: every response says that scientific validity is
not established and grants no authority. No submission is automatically
admitted to Invention Graph.

Existing Working Route bounties remain a separate compatibility product. A
bootstrap inventory may record them as a live baseline, but they are never
silently linked to private research experiments.
