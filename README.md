# AgentWex

AgentWex (Agent Witness Exchange) is the portable command-line entry point for
creating and exchanging verifiable witness receipts for AI-agent actions.

This initial release reserves the canonical package and command namespaces while
providing a small, real interface that downstream Minority Prophet components can
detect and integrate with.

```bash
npm install --global agentwex
agentwex --version  # canonical
awe --version       # convenience alias
```

`agentwex` is the canonical command. `awe` is a convenience alias.

## Status

Version `0.0.1` establishes the namespace and CLI contract. Receipt creation,
verification, and Witness Exchange transports will follow without breaking the
command names.

The npm package is public. The equivalent PyPI release is built and tested but
remains pending until the publisher account finishes its required 2FA setup.
Future releases use GitHub trusted publishing so registry credentials are not
stored in the repository or on developer machines.

See [the namespace record](docs/NAMESPACE.md) for the canonical names and
current reservation status.

## License

Apache-2.0.
