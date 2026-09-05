# AgentWex namespace

The canonical machine-facing project name is **AgentWex** and the public product
label is **Agent WEX**. “Agent Witness Exchange” is the historical expansion;
the public-preview product is described narrowly as a compatibility-evidence
network so a signed receipt is not confused with independent verification.

| Surface | Canonical name | Status |
| --- | --- | --- |
| GitHub organization | `agentwex` | Reserved |
| GitHub repository | `agentwex/agentwex` | Public |
| npm organization | `@agentwex` | Reserved |
| npm package | `agentwex` | `0.6.2` is the canonical Node.js public-preview release |
| PyPI project | `agentwex` | Namespace placeholder only; not the Agent WEX node |
| Primary shell command | `agentwex` | Canonical |
| Convenience shell aliases | `awe`, `awe-node` | Included in the `0.6.2` preview |

`agentwex` is always the canonical machine-facing identifier. `awe` is a
convenience command and secondary brand monogram; it must not be used as the
package name or the only identifier in automation.

## Release trust

The Node.js package on npm is the only canonical public-preview distribution.
The repository's npm workflow uses OpenID Connect trusted publishing and does
not require a long-lived registry token. Registry-side trusted-publisher
configuration must match the repository, workflow filename, and GitHub
environment before the workflow is run.
