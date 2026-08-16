# Agent WEX production-readiness boundary

## What the first node stores

The launch architecture does **not** need a massive trace database.

The local node receives an OTLP span, immediately reduces it to a bounded compatibility receipt, and keeps only private local state needed for retries and returned routes. The exchange stores ordinary relational metadata:

- agent identity and a hash of its API key;
- minimized contribution and route-compatibility fields;
- a provenance-root hash;
- immutable credit entries;
- verification receipts and decisions;
- failed-route queries and their status.

It does not intentionally store prompts, tool arguments, tool results, credentials, URLs, raw trace IDs, raw spans, or arbitrary executable routes.

For one node and an early design-partner pilot, the existing D1 schema is sufficient. Actual bytes per accepted receipt, writes per node, retention, verification load, and query latency must be measured before choosing the next storage tier. At high event volume, move ingestion behind a queue and partition durable analytics storage; do not turn the exchange database into a raw-telemetry lake.

## Automatic path

After one explicit install and runtime connection:

```text
tool completes
  -> localhost collector
  -> privacy minimizer
  -> idempotent contribution
  -> signed-node verification
  -> credits update
  -> failure opens a route query
  -> enough independent successes produce a bounded route
  -> one credit unlocks it
  -> route returns to Gate
```

The exchange never grants execution authority. A returned route is configuration-shaped evidence and is marked `gateRequired: true`.

## Already enforced

- API keys are stored as hashes and written locally with mode `0600`.
- Exact contribution retries are idempotent.
- Signed route receipts are verified against a registered Ed25519 public key and create an audit record.
- One signed node can claim additive support only once for a bounded route candidate; additional roots collapse without credits.
- Credits and balances exist only in the central append-only ledger; local state cannot mint or spend them.
- Credits are created only by an accepted first support claim from a distinct signed node.
- API JSON bodies are capped at 64 KiB; signup fingerprints and authenticated nodes are rate limited.
- API keys rotate, signing keys revoke, and account deactivation invalidates credentials and pseudonymizes registration fields.
- The versioned dependency-free package includes Apache-2.0 license/notice files and a published SHA-256 manifest.
- `awe-node uninstall --yes` removes exact Agent WEX runtime settings, stops the macOS service, and deactivates the remote account while retaining local backups.
- A node can unlock only a result for its own failed-route query.
- The collector binds to localhost and accepts OTLP/HTTP JSON only.
- Uploads are size bounded.
- Raw private telemetry fields are omitted from the receipt and covered by tests.

## Required before a public production launch

1. Apply and verify all D1 migrations in a staging environment.
2. Add stronger participant identity and Sybil resistance beyond distinct signed-node verification.
3. Add adaptive abuse detection and operator controls beyond fixed request limits.
4. Add registry provenance or a cryptographically signed release in addition to the current checksum manifest.
5. Complete independent privacy/legal review and red-team malformed OTLP payloads.
6. Add Linux service installation and named adapters for runtimes that do not already emit compatible OTLP spans.
7. Automate retention purges, operational alerts, backup/restore drills, and measured capacity targets.
8. Run a closed pilot before calling the service production-ready.

## Honest installation claim

`awe-node install` is the one explicit consent step. It can make subsequent participation passive, but it cannot observe a runtime that emits no events. The installer or an agent must connect that runtime to the localhost OTLP endpoint once.
