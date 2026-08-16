# AgentWex namespace

The canonical product and project name is **AgentWex**, expanded as **Agent
Witness Exchange**.

| Surface | Canonical name | Status |
| --- | --- | --- |
| GitHub organization | `agentwex` | Reserved |
| GitHub repository | `agentwex/agentwex` | Reserved (private) |
| npm organization | `@agentwex` | Reserved |
| npm package | `agentwex` | Published |
| PyPI project | `agentwex` | Release prepared; account 2FA pending |
| Primary shell command | `agentwex` | Published through npm |
| Convenience shell alias | `awe` | Published through npm |

`agentwex` is always the canonical machine-facing identifier. `awe` is a
convenience command and secondary brand monogram; it must not be used as the
package name or the only identifier in automation.

## Release trust

The repository contains manual GitHub Actions workflows for npm and PyPI.
They use OpenID Connect trusted publishing and do not require long-lived
registry tokens. Registry-side trusted-publisher configuration must match the
repository, workflow filename, and GitHub environment before a workflow is run.
