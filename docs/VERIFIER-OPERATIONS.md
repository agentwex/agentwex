# Verifier operations

The public preview runs in **signed-route-only automatic verification** mode.
This is deliberately narrower than accepting every submitted claim.

## Automatic path

`POST /api/exchange/working-route-comps` may accept a minimized v0.2 or v0.3
working-route receipt after the hosted exchange validates:

- the registered Ed25519 key and signature;
- the canonical receipt bytes and schema;
- bounded field vocabularies and timestamps;
- the receipt hash and idempotency key;
- per-node collapse and duplicate suppression.

Acceptance means that the registered node signed a structurally valid report.
It does **not** prove execution truth, controller independence, human identity,
or authority to act. Returned routes remain unverified network evidence and
must pass through the caller's policy Gate.

## Held path

Generic `POST /api/exchange/contributions` records remain `pending`. They are
not published as supported evidence and earn no credits until an external
verification process exists. The `/api/exchange/internal/accept` endpoint is a
break-glass operator path, not the normal passive-node flow.

## Operator checklist

1. Keep `AWE_RATE_LIMIT_SALT`, `AWE_VERIFIER_TOKEN`, and `AWE_ADMIN_TOKEN` in
   hosted secret storage; never put them in source, logs, or support messages.
2. Review pending generic contributions without exposing provenance roots or
   private payloads.
3. Confirm coverage suppresses test-labelled agents and cells with fewer than
   two distinct signed nodes.
4. Run the production smoke test after every deployment.
5. Rotate credentials immediately after suspected exposure.
6. Preserve the invariant that evidence returned by Agent WEX grants no
   authority and still requires the caller's Gate.

The invite-only pilot should use signed working-route receipts. Broader
automatic verification is out of scope until it has its own explicit evidence
contract, tests, and operating controls.

Use `npm run smoke:production` for the read-only domain/configuration check.
Use `npm run smoke:lifecycle` only against an authorized deployment; it creates
uniquely labelled disposable nodes, exercises the full exchange loop, and
deactivates those nodes on exit. Coverage excludes these labelled test nodes.
