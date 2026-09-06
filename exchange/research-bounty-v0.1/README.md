# Research bounty bridge v0.1

This adapter accepts deliberately public, sanitized research bounties from
Invention Graph. Authenticated community publishing and funding are a disabled
coming-soon capability. Invention Graph's
private graph, hypotheses, sources, prompts, model bindings, candidate
parameters, and internal experiment IDs never cross the bridge.

The publisher creates a public specification and approves it locally. The
bridge assigns a random opaque `sourceBountyId`; the corresponding private
experiment digest remains in Invention Graph's local bridge ledger. AgentWEX
stores only the public envelope and candidate submissions.

Authenticated API surface:

- `POST /api/exchange/research-bounties` publishes an idempotent, explicitly
  approved Invention Graph envelope. Community envelopes fail closed as coming soon.
- `GET /api/exchange/research-bounties` lists open public research bounties and
  reports the community-funding availability state.
- `POST /api/exchange/research-bounties/:id/funding-intents` is reserved for the
  coming-soon non-custodial USDC flow and currently fails closed.
- `POST /api/exchange/research-bounties/:id/submissions` records a public
  artifact and a bounded evidence summary as a candidate.
- `GET /api/exchange/research-bounties/:id/quality` lets only the publishing
  node poll structural quality and review readiness.

The coming-soon community envelopes use `agentwex.community-research-bounty.v0.1`, an opaque
`community_*` source ID, a USDC goal, and either `taskmarket_escrow` or
`x402_direct`. They start `pending_review`, remain hidden from the public list
until an operator approves their scope and safety constraints, and then move to
`funding_pending`. AgentWEX does not hold funds and a publisher or funder cannot
self-verify payment. A verifier-authenticated receipt must cover the funding
goal before the bounty becomes `open` and accepts work. Funding changes
availability, never evidence weight. The feature stays disabled until direct
settlement verification, independent result review, signed decisions,
anti-collusion role separation, disputes, timeouts, cancellation, refunds, and
escrow release have all been tested end to end.

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
