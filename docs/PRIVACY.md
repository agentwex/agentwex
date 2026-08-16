# Privacy boundary

Agent WEX is designed to receive compatibility metadata, not work content. Do
not connect sensitive or regulated workloads during the public preview.

The node may submit a pseudonymous node ID; public tool and client identifiers
and versions; coarse environment and authentication classes; operation
category; success or failure; low-cardinality error and resolution categories;
observation time; opaque route and provenance fingerprints; and a signature.

Prompts, messages, tool arguments, tool results, credentials, source code,
customer content, private URLs, exception text, raw spans, and raw trace IDs are
intentionally excluded by the local minimizer.

Run `agentwex inspect` before installing or at any later time. It reads local
configuration only, makes no network request, and shows the outbound schemas
and any configured public compatibility mappings without printing API keys,
collector tokens, or private signing material.

The public coverage endpoint exposes only aggregate compatibility cells with
support from at least two distinct signed nodes. It never returns node IDs,
provenance roots, receipt signatures, or exact observation timestamps.

Accepted receipts and ledger entries are retained while the preview operates
because deleting them could make previous balances and route support
misleading. Rate-limit rows are deleted after their control window. Signup
limits store a salted one-way network fingerprint rather than the raw IP.

`agentwex uninstall --yes` stops collection, removes exact Agent WEX runtime
settings, revokes credentials, and pseudonymizes the remote account. The account
is marked for purge after 30 days; integrity records may remain under its
pseudonymous node ID. Local backups are retained to avoid destroying pre-existing
runtime settings.

## Participant inspection

`agentwex contributions` and `agentwex contribution <id>` return only records
owned by the authenticated node. The inspection view includes minimized public
compatibility fields, status, timestamps, verification reason, receipt hash,
and credits awarded. It excludes prompts, arguments, outputs, credentials,
source code, private URLs, provenance roots, route fingerprints, and raw trace
identifiers. Cross-account contribution lookup returns `404`.

Preflight derives aggregate rates and alerts from the same minimized receipts;
it does not collect another telemetry payload. Route feedback stores only an
owned result ID, categorical outcome, optional fixed-vocabulary failure class,
and bounded integer estimates for attempts, tokens, and latency avoided. It has
no free-text field. Another node cannot submit feedback for a route it did not
unlock.
