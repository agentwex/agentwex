# Agent WEX

![Conceptual Agent WEX receipt flow](docs/assets/agent-wex-social.png)

The image is a conceptual social-preview graphic: distinct tool/runtime nodes
emit many bounded receipts, repeated signals collapse through the center, and a
single compatibility route returns to the caller. It is not an architecture
diagram and does not claim that the pictured nodes are independently controlled.

Agent WEX is a compatibility-evidence network for agent tools. A participating
runtime reduces permitted tool outcomes to minimized signed receipts. The
exchange collapses repeated claims from the same registered node and can return
a recent configuration-shaped route when another agent encounters the same
compatibility failure.

Agent WEX does **not** build, host, execute, or orchestrate agents. A registered
signature identifies a pseudonymous node; it does not prove that a distinct
person or organization controls that node, or that the reported execution
genuinely happened. Returned routes are unverified network evidence and grant
no authority.

## Public-preview install

The Node.js public preview supports macOS and Node.js 22.13 or newer. Verify the
versioned package checksum before installation:

```bash
curl -fsSLO https://agentwex.xyz/exchange/agentwex-0.6.0.tgz
curl -fsSLO https://agentwex.xyz/exchange/SHA256SUMS
shasum -a 256 -c SHA256SUMS
npm install --global ./agentwex-0.6.0.tgz
agentwex install
```

The installer creates a pseudonymous Ed25519 signing identity, detects supported
runtimes, refuses to overwrite an existing telemetry exporter, starts a
localhost collector on macOS, and verifies readiness. It does not submit prompts,
tool arguments, tool results, credentials, private URLs, source code, or raw
traces.

```bash
agentwex status
agentwex doctor
agentwex rotate-keys
agentwex uninstall --yes
```

`agentwex` is canonical. `awe` and `awe-node` are compatibility aliases.

## Repository map

- `js/` — dependency-free Node.js node and CLI
- `exchange/knowledge-exchange-v0.1/` — bounded protocol and schemas
- `db/` and `migrations/` — exchange API, ledger, and D1 schema
- `docs/` — privacy, security, protocol, and release boundaries
- `tests/` — installer, minimization, exchange, lifecycle, and adapter tests

The Python namespace remains reserved for a future portable receipt client. It
does not yet provide the Node exchange runtime.

## Public-preview limits

Stronger participant identity and Sybil resistance, Linux background-service
installation, automated deletion operations, operational restore drills, and an
independent security assessment remain production-readiness work. See
[Security](docs/SECURITY.md), [Privacy](docs/PRIVACY.md), and
[Protocol](docs/PROTOCOL.md).

Apache-2.0.
