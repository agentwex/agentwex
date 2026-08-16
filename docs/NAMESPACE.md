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
| npm package | `agentwex` | `0.0.1` namespace release published; `0.6.0` preview proposed |
| PyPI project | `agentwex` | Release prepared; account 2FA pending |
| Primary shell command | `agentwex` | Canonical |
| Convenience shell aliases | `awe`, `awe-node` | Included in the `0.6.0` preview |

`agentwex` is always the canonical machine-facing identifier. `awe` is a
convenience command and secondary brand monogram; it must not be used as the
package name or the only identifier in automation.

## Release trust

The repository contains manual GitHub Actions workflows for npm and PyPI.
They use OpenID Connect trusted publishing and do not require long-lived
registry tokens. Registry-side trusted-publisher configuration must match the
repository, workflow filename, and GitHub environment before a workflow is run.
