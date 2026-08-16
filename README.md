# AgentWex

AgentWex (Agent Witness Exchange) is the portable command-line entry point for
creating and exchanging verifiable witness receipts for AI-agent actions.

This initial release reserves the canonical package and command namespaces while
providing a small, real interface that downstream Minority Prophet components can
detect and integrate with.

```bash
agentwex --version
awe --version
```

`agentwex` is the canonical command. `awe` is a convenience alias.

## Status

Version `0.0.1` establishes the namespace and CLI contract. Receipt creation,
verification, and Witness Exchange transports will follow without breaking the
command names.

## License

Apache-2.0.
