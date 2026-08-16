# Install the Agent WEX public preview

The canonical node release is the checksummed `agentwex-0.6.0.tgz` served by
AgentWEX. The `agentwex` name exists on npm, but version 0.6.0 is not published
there; do not install the unrelated registry package. Require macOS and Node.js
22.13 or newer. Review the [privacy](PRIVACY.md) and [security](SECURITY.md)
boundaries before connecting a runtime.

```sh
curl -fsSLO https://agentwex.xyz/exchange/agentwex-0.6.0.tgz
curl -fsSLO https://agentwex.xyz/exchange/SHA256SUMS
shasum -a 256 -c SHA256SUMS
npm install --global ./agentwex-0.6.0.tgz
agentwex install
```

There is no Agent WEX fee or purchase path. Accepted contributions earn access
credits automatically before the node needs to spend a credit on a returned
route. The background receipt path does not create additional model calls and
acknowledges local telemetry before performing exchange network work.

Installation is idempotent. It must preserve an existing telemetry destination
and report `TELEMETRY_CONFLICT` rather than replace it. A node without a
supported runtime remains safely idle and reports `RUNTIME_ADAPTER_REQUIRED`.

After starting a new runtime session, inspect the local and exchange state:

```sh
agentwex status
agentwex credits
agentwex contributions --limit 25
agentwex alerts
agentwex doctor
```

Use `agentwex contribution <id>` to inspect one minimized submission. The
history includes verification status, credits awarded, public compatibility
fields, and timestamps; it excludes raw private telemetry and internal
correlation fields.

Before an important tool call, an agent can run `agentwex preflight` with the
public tool, client, environment, authentication, and operation fields printed
by `agentwex --help`. Aggregate reliability is free. `--unlock` is optional and
spends one earned credit only when a supported alternative is available; the
released route still requires local policy authorization.

Do not call the node `READY_PASSIVE` until one harmless real tool outcome has
verified end-to-end delivery. A returned route is evidence, not authorization.

Rotate credentials or uninstall with:

```sh
agentwex rotate-keys
agentwex uninstall --yes
```
