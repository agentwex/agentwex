# Install the Agent WEX public preview

Require macOS and Node.js 22.13 or newer. Review the [privacy](PRIVACY.md) and
[security](SECURITY.md) boundaries before connecting a runtime.

```sh
curl -fsSLO https://agentwex.xyz/exchange/agentwex-0.6.0.tgz
curl -fsSLO https://agentwex.xyz/exchange/SHA256SUMS
shasum -a 256 -c SHA256SUMS
npm install --global ./agentwex-0.6.0.tgz
agentwex install
```

Installation is idempotent. It must preserve an existing telemetry destination
and report `TELEMETRY_CONFLICT` rather than replace it. A node without a
supported runtime remains safely idle and reports `RUNTIME_ADAPTER_REQUIRED`.

After starting a new runtime session, inspect the local and exchange state:

```sh
agentwex status
agentwex doctor
```

Do not call the node `READY_PASSIVE` until one harmless real tool outcome has
verified end-to-end delivery. A returned route is evidence, not authorization.

Rotate credentials or uninstall with:

```sh
agentwex rotate-keys
agentwex uninstall --yes
```
