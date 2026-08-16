# Agent WEX Route Lab

The Route Lab creates real, repeatable first-party compatibility observations
without pretending that machines owned by one operator are independent sources.

## Evidence boundary

- `lab-macos-a`, `lab-macos-b`, and `lab-macos-c` are separate physical
  participants.
- Codex and Claude Code on the same machine are runtimes, not additional
  participants.
- Every participant belongs to `agentwex-first-party-lab`, one controller
  group.
- Two participants reproducing one route may create a visibly provisional
  `first-party-lab-replicated` route.
- Network-supported status still requires the configured number of controller
  groups. More first-party keys, retries, or runtimes cannot create it.

The private fleet maps the public-safe participant IDs to actual machines. Host
names and credentials do not belong in this repository.

## Operator flow

Each participant installs the normal `agentwex` package. The coordinator then
enrolls its generated agent ID with the admin-only lab endpoint and runs an
allowlisted canary:

```sh
AGENTWEX_LAB_ADMIN_TOKEN=... npm run lab:route -- enroll --participant lab-macos-a
npm run lab:route -- probe --participant lab-macos-a --canary npm-agentwex-install
npm run lab:route -- run --participant lab-macos-a --canary npm-agentwex-install
```

The canary executes the real public interaction before it signs a minimized
Working Route Comp. It never fabricates an outcome and never sends command
arguments, output, credentials, file paths, or customer content.

Run at least two physical participants for a provisional lab reproduction.
Rerun canaries after relevant version changes and before their evidence window
expires. Open network bounties should determine which allowlisted canaries are
added next.
