# Semantic conventions

The human freeze of the public field names. **The schema files are the
executable source**; this document exists so a stranger can implement an emitter
without reading our application code, and so a rename is visible as a change to
a frozen table rather than a silent edit.

Scope: the public **compatibility cell** and the receipt that carries it. Query
and assessment shapes are listed only where their names differ.

Reference schema: `exchange/knowledge-exchange-v0.1/working-route-comp-v0.3.schema.json`.
See [Version labelling](#version-labelling-is-currently-inconsistent) — this is
not the version the node currently declares.

## The compatibility cell

These eight fields identify a cell. Two receipts describe the same cell if and
only if all eight match. **A change to any name here is a new schema version.**

| field | type | required | values |
| --- | --- | --- | --- |
| `toolRegistry` | string | yes | `mcp`, `npm`, `pypi`, `github`, `public-api`, `runtime` |
| `toolId` | string | yes | ≤200 chars, `^[A-Za-z0-9@][A-Za-z0-9._@/+~-]*$` |
| `toolVersion` | string | yes | ≤80 chars |
| `clientId` | string | yes | ≤120 chars |
| `clientVersion` | string | yes | ≤80 chars |
| `environment` | string | yes | `macos-arm64`, `macos-x64`, `linux-arm64`, `linux-x64`, `windows-x64`, `container`, `other` |
| `authMode` | string | yes | `none`, `api-key`, `oauth-pkce`, `oauth-client`, `mtls`, `signed-request`, `other` |
| `operation` | string | yes | ≤120 chars |

`environment` and `authMode` are deliberately coarse classes, not free text: they
describe a situation, never a host or a credential.

## The rest of the receipt

| field | type | required | values |
| --- | --- | --- | --- |
| `schema` | string | yes | schema identifier — see version note below |
| `outcome` | string | yes | `success`, `failure` |
| `errorClass` | string \| null | no | ≤120 chars, low-cardinality category only |
| `resolutionKind` | string | yes | `none`, `upgrade-client`, `upgrade-tool`, `upgrade-client-and-tool`, `change-auth-flow`, `change-transport`, `change-runtime`, `retry-later`, `alternate-tool` |
| `routeFingerprint` | string | yes | `^sha256:[a-fA-F0-9-]{8,128}$` |
| `observedAt` | string | yes | RFC 3339 timestamp |
| `provenanceRootId` | string | yes | ≤240 chars, opaque |
| `independenceBasis` | string | yes | `attested`, `declared`, `inferred`, `unknown` |
| `attestation` | object | yes (v0.2+) | signature over the canonical receipt |
| `capabilityId` | string | v0.3 | ≤160 chars, `^[A-Za-z0-9][A-Za-z0-9._+~-]*$` |
| `effectClass` | string | v0.3 | `read`, `write`, `execute`, `communicate`, `observe`, `other` |
| `queryId` | string | no | present when the receipt answers a query |

`capabilityId` and `effectClass` travel together or not at all. They exist so a
read route is never compared against a write or execute route.

## Never send

Copied from [PRIVACY.md](PRIVACY.md). A conformant emitter MUST NOT place any of
these in a receipt, in any field:

prompts and messages · tool arguments · tool results · credentials and API keys ·
source code · customer content · private URLs · exception text · raw spans ·
raw trace IDs · local collector tokens · private signing material

One addition enforced by the node and not derivable from the schema:

> A tool name from an MCP server that cannot be resolved to a published package
> is not transmitted. `toolId` for a public server is the cell identity and must
> travel in the clear; for a private or internal server it is a proprietary
> string, and the cell is unusable to anyone else regardless, since they cannot
> reach that server.

An emitter that implements only the schema will violate this. It is a rule about
values, not shapes, which is why it is stated here.

## The collapse rule

Not a field. A requirement on whoever counts, and the reason this envelope is
worth adopting rather than inventing:

> A conformant listener **MUST** collapse observations to at most one per
> controller group before computing support, coverage, ranking or preflight.
> Signed-node and participant counts **MAY** be reported and **MUST NOT** be
> substituted for the controller-group count.

Frozen vectors with expected outputs: `conformance/collapse/`. Reference
implementation and proofs:
[Minority Prophet](https://github.com/Silentpartnercoding/minority-prophet).

## The independence bar

`minimumIndependentRoots` — integer, 2–10, default 2. The number of **distinct
controller groups** that must support a route.

Formerly `minimumSignedNodes`. That name was never accurate: the value has
always been compared against a list collapsed one-per-controller. The old name
is not accepted.

## Disagreements

Recorded rather than resolved. Each is a decision, not an editing error.

### Version labelling is currently inconsistent

`js/lib/receipt.mjs` emits `schema: "minority-prophet.working-route-comp.v0.1"`,
then conditionally includes `capabilityId` and `effectClass`, which the schema
files introduce at **v0.3**. Signing adds `attestation`, introduced at **v0.2**.

So a receipt can declare v0.1 and carry v0.3 fields. The exchange accepts v0.1,
v0.2 and v0.3, so nothing breaks today — but a stranger validating against the
declared version would reject a receipt we consider valid.

Three schema files coexist: `working-route-comp.schema.json` (v0.1),
`-v0.2`, `-v0.3`. The v0.3 file is referenced by no other file in the
repository.

**Resolved.** The node now declares the version each receipt actually satisfies:
`agentwex.working-route-comp.v0.3` when capability fields are present,
`agentwex.working-route-comp.v0.2` otherwise. A fixed v0.3 was rejected because
v0.3 makes `capabilityId` and `effectClass` **required**, and they are present
only when an operator mapping supplies a capability — stamping it
unconditionally would have produced receipts invalid against the schema they
name. v0.1 remains accepted and is no longer emitted.

### Coverage documentation understates its own guarantee

[PRIVACY.md](PRIVACY.md) states that public coverage exposes cells "with support
from at least two distinct signed nodes." The query enforces:

```sql
HAVING COUNT(DISTINCT COALESCE(g.controller_group_id, c.agent_id)) >= 2
```

That is two distinct **controller groups**, a strictly stronger bar. The
documentation is wrong in the safe direction, and in the same direction as the
old `minimumSignedNodes` name — a reader could implement the weaker rule and
believe they matched us.

**Resolved.** PRIVACY.md now says controller groups, and states that signed
nodes under one controller cannot reach the threshold however many there are.

### Query vocabulary differs from receipt vocabulary

The working-route query uses `attemptedToolVersion` and `attemptedClientVersion`
where the receipt and preflight query use `toolVersion` and `clientVersion`.

This may be deliberate: a query states the version a caller *attempted*, which
is not the same claim as the version a receipt reports having *used*. It is
recorded here so an implementer is not surprised, and so the distinction is
either affirmed or removed on purpose.

**Resolved: affirmed, not unified.** The distinction is real — a query states
what was *attempted*, a receipt states what was *used* — and is now written into
the `description` of both fields on the query schemas and of `toolVersion` on
the receipt schemas, so an implementer meets it from either end.
