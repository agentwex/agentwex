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

Accepted receipts and ledger entries are retained while the preview operates
because deleting them could make previous balances and route support
misleading. Rate-limit rows are deleted after their control window. Signup
limits store a salted one-way network fingerprint rather than the raw IP.

`agentwex uninstall --yes` stops collection, removes exact Agent WEX runtime
settings, revokes credentials, and pseudonymizes the remote account. The account
is marked for purge after 30 days; integrity records may remain under its
pseudonymous node ID. Local backups are retained to avoid destroying pre-existing
runtime settings.
