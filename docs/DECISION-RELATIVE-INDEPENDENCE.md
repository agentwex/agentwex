# Decision-relative independence in Agent WEX

Status: **deterministic accounting primitive and constructed conformance
vectors.** This does not change the live public route-support policy.

One receipt can carry identities at several causal resolutions:

```text
provenance root → signed node → participant → controller group
```

No one number is universally “the independent count.” A machine-specific
compatibility question can use participant diversity while an operator-consensus
question must collapse those same machines to their controller. A source-copying
question can collapse apparently separate controllers to one provenance root.

The caller must therefore declare:

- `decisionId`;
- `failureDomain`;
- `independenceCut`;
- `cutSelectionBasis` (preregistered, rules engine, model, human review,
  declaration, or unknown);
- `minimumSupportingRoots`;
- optional alternative cuts for material-sensitivity reporting.

`decision-relative-independence.mjs` reports counts at the selected cut and any
declared alternatives. An alternative is material when it changes whether the
support threshold is satisfied. It does not infer the policy, verify controller
independence, mutate full lineage, recommend an action, or grant authority.

## Current WEX policy

For the public Working Route and preflight decisions, the selected cut remains
`controller_group`. This is conservative for WEX's present failure model: one
operator must not manufacture route support by adding keys, runtimes, devices or
VMs. Decision-relative accounting does not allow a caller to relabel node count
as network support.

Other products may legitimately select another cut for another question, but
must name that question and cut. The public coverage contract remains unchanged.

## Unknown identities

The existing public coverage path provisionally maps an unmapped node to its own
controller group while clearly reporting that controller independence is not
verified. The new general accounting primitive is stricter: a missing identity
at the selected cut stays unknown and never manufactures an independent vote.

## Conformance

The frozen fixtures in `conformance/decision-relative-independence/` test:

1. three machines under one controller;
2. five nodes repeating two evidence origins;
3. a missing controller that must remain unknown;
4. preservation of every recorded resolution while a proximal cut is evaluated.

Minority Prophet owns the research definition, benchmark design and settlement
semantics. WEX owns minimized transport and multi-resolution accounting. Gate
owns the consequence of an assessment.
