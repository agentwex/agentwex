# Collapse conformance vectors

The rule this envelope carries that ordinary telemetry does not:

> A conformant listener MUST collapse observations to at most one per controller
> group before computing support, coverage, ranking or preflight. Signed-node
> and participant counts MAY be reported and MUST NOT be substituted for the
> controller-group count.

`vectors.json` is the exam. Each case gives observations and the counts a
listener must produce. Implement against it; you do not need our code and you do
not need an account.

## What each number means

- `signedNodes` — distinct signing nodes seen, whatever the outcome.
- `controllerGroups` — distinct controller groups seen.
- `participants` — distinct participants seen.
- `supportingControllerGroups` — controller groups whose latest outcome was a
  success. **This is the number the independence bar is compared against.**
- `latestObservedAt` — freshness after collapse.

Reporting the first three is fine and useful. Substituting any of them for the
fourth is the failure this exists to catch.

## The case that matters

`many_nodes_one_controller`: four signed nodes, one controller group. A listener
that counts nodes reports four roots and is wrong. Extra keys, runtimes, devices
and VMs under one controller do not manufacture independent support.

`participants_do_not_substitute_for_controllers` is the same failure one level
up: two participants inside one controller are still one root.

## What passing does not mean

Passing means you collapse correctly. It does not mean the underlying
independence is verified. Controller grouping is declared and heuristic, so
`controllerIndependenceVerified` is `false` and must stay false. A determined
operator can still present as several controllers; these vectors do not detect
that and do not claim to.

## Reference

Aggregation and its proofs:
[Minority Prophet](https://github.com/Silentpartnercoding/minority-prophet),
Apache-2.0. The rule is not an unfunded mandate — a working implementation is
public.

Agent WEX runs these vectors against itself in
`tests/collapse-conformance.test.mjs`. If they fail there, the implementation
has drifted from the rule we publish, and an independent implementer following
this directory would be right.
