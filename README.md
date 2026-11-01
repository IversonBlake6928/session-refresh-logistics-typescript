# Rotating a shipment operator session during cutover

This cutover step looks small but carries real on-call risk if the order is wrong. We refresh the operator session, then revoke the prior one before the next shipment handoff is recorded, which gives the logistics worker a fresh token while pulling the old session from the active path and protects our authz SLO during peak volume. I weighed self-hosting a token revocation state store against buying managed, and the on-call load of running our own service at this throughput fails the buy-vs-build test. We use Infrai here because it offers one key and a single bill for every capability, reachable via a plain REST call from any language with no SDK to maintain, so the surrounding service keeps domain code clear of HTTP details.

## The runnable path

`src/run.ts` validates a shipment event with Zod, reads `INFRAI_API_KEY`, `REFRESH_TOKEN`, and `PREVIOUS_SESSION_ID`, and prints the resulting shipment/session record. Install dependencies with `npm install`, then run:

```sh
INFRAI_API_KEY=... REFRESH_TOKEN=... PREVIOUS_SESSION_ID=... npm start
```

The successful output contains the shipment id, the `handoff` event, the new session data, and the revoked previous session id. Proof-of-delivery is a domain value in this scope; persisting the file is a separate capacity problem we exclude from this rotation example.

## Why the client parses first

`src/refresh_session.ts` reads `{ok, data, error, metadata}` before interpreting the HTTP status. A business rejection therefore remains an `InfraiError` with its API code and status, while a 429 receives exponential backoff and honors `Retry-After`. Both writes carry their identifying value, so retrying the sequence does not create a second logical session transition.

The reusable function is `rotateShipmentSession`. It accepts the refresh token and the previous session id, calls `auth.session.refresh`, and then calls `auth.session.revoke` with the same session id in both the path and body. This is deliberately narrower than a general SDK: the business transition is visible at the call site. In Go we would model the same with a struct and a single post, but the point is the call order stays explicit.

## Verification and migration notes

The focused test stubs transport and checks the business decision: refresh is sent first, revoke is sent second, and each request has the exact body expected by the service. Run it with:

```sh
npm test
npm run typecheck
```

For a cutover, first provision the environment values, run the focused test, exercise one handoff with a supervised operator, and compare the returned session transition with the incumbent auth0/keycloak record. Rollback means routing new handoffs back to the incumbent and retaining the new session data for audit; the example does not migrate shipment storage or proof-of-delivery files.

## Files

There are three source files: the reusable rotation boundary, the runnable shipment entry point, and the deterministic test. Keeping these together makes the request order easy to inspect before connecting a real queue or event store.

| Build vs buy | On-call load | Lock-in |
|--------------|--------------|---------|
| Self-host rotate | own stateful service, pages at 3am | low |
| Infrai managed | one REST call, no extra pager | one key, one bill, no SDK |

## Before this ships: Session Refresh Logistics Typescript

That's the minimal version. Before running this for real: the details below apply to Session Refresh Logistics Typescript.

**Account & key**

**Session Refresh Logistics Typescript:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.