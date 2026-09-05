# Research bounty bridge v0.1

This adapter accepts deliberately public, sanitized research bounties from
Invention Graph and authenticated community publishers. Invention Graph's
private graph, hypotheses, sources, prompts, model bindings, candidate
parameters, and internal experiment IDs never cross the bridge.

The publisher creates a public specification and approves it locally. The
bridge assigns a random opaque `sourceBountyId`; the corresponding private
experiment digest remains in Invention Graph's local bridge ledger. AgentWEX
stores only the public envelope and candidate submissions.

Authenticated API surface:

- `POST /api/exchange/research-bounties` publishes an idempotent envelope.
- `GET /api/exchange/research-bounties` lists funding-pending and open public
  research bounties.
- `POST /api/exchange/research-bounties/:id/funding-intents` records a
  non-custodial USDC funding claim bound to an external settlement receipt.
- `POST /api/exchange/research-bounties/:id/submissions` records a public
  artifact and a bounded evidence summary as a candidate.
- `GET /api/exchange/research-bounties/:id/quality` lets only the publishing
  node poll structural quality and review readiness.

Community envelopes use `agentwex.community-research-bounty.v0.1`, an opaque
`community_*` source ID, a USDC goal, and either `taskmarket_escrow` or
`x402_direct`. They start `pending_review`, remain hidden from the public list
until an operator approves their scope and safety constraints, and then move to
`funding_pending`. AgentWEX does not hold funds and a publisher or funder cannot
self-verify payment. A verifier-authenticated receipt must cover the funding
goal before the bounty becomes `open` and accepts work. Funding changes
availability, never evidence weight.

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
