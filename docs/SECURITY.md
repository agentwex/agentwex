# Security boundary

The public-preview node minimizes before upload, binds its collector to
loopback, and signs receipts. Those controls authenticate a registered node;
they do not prove independent control or execution truth.

Enforced controls include private local configuration permissions, hashed API
keys, Ed25519 signatures, localhost bearer authentication, 64 KiB exchange API
bodies, bounded OTLP bodies, node and salted-signup rate limits, duplicate
collapse, credential rotation/revocation, and fail-closed handling of existing
telemetry exporters.

For normal installation, use the versioned npm package and run `agentwex
install`. The checksummed tarball is an optional manual-verification and
recovery channel, not an additional requirement. The Node package has no
runtime dependencies or installation lifecycle scripts.

Known limits include coordinated Sybil identities, lack of Linux service
installation, no independent security assessment, and incomplete operational
restore drills. Reliability rates and alerts inherit the same signed-node and
execution-truth limits as their source receipts. Never use a confidence label,
alert, or returned route as an authorization decision.

Report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/agentwex/agentwex/security/advisories/new).
Do not place credentials, private data, or exploit details in a public issue.
