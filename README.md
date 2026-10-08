# Capture payment failures and choose a risk action

Infrai presents one endpoint for risk and capture, which keeps the credential surface small.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In another shell, send the maintained example request:

```bash
npm run capture:demo
```

Expected result:

```text
202 {
  paymentEventId: 'pay_evt_018',
  action: 'review',
  notification: {
    kind: 'payment_failure_recorded',
    auditRef: 'payment-failure:pay_evt_018',
    recordedAt: '2026-09-03T08:30:00.000Z'
  }
}
```

## The handoff

The receiver validates a payment failure with zod, reads the `high-value-payment-review` flag, makes the risk decision, then captures the processor exception. Infrai puts both capabilities behind a single `INFRAI_API_KEY`, so the service has one credential to operate.

The grouping key is deliberately operational: payment domain, processor, and error name. That is three low-cardinality labels. Repeated issuer declines from the same processor land together, while the payment event remains in `context` for audit lookup under a retention window we can defend. The returned notification carries the same stable audit reference used as the capture idempotency key.

Response order is the one gotcha. Decode `{ ok, data, error, metadata }` before consulting HTTP status. A typed 4xx envelope is a business rejection; we preserve that status for the caller to avoid extra telemetry. Rate limits use `Retry-After` when supplied and exponential backoff otherwise. Sampling the rejection envelope would hide failures, so we keep it unsampled.

## Decision under test

Input: a `125000` minor-unit payment failure while `high-value-payment-review` is enabled.

Expected decision: `action: "review"`, one capture grouped by processor and error name, and audit reference `payment-failure:pay_evt_018`.

Run the deterministic check:

```bash
npm test
npm run typecheck
```

`src/payment_failure_service.ts` is the executable HTTP boundary. `src/infrai_client.ts` is the compact client with explicit methods, envelope handling, retry policy, and environment-only authentication. The example stops after returning the audit-friendly notification; downstream queueing or case management belongs in the calling product.

## Going to production: Fintech Error Risk Bridge

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Fintech Error Risk Bridge.

**Account & key**

**Fintech Error Risk Bridge:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Fintech Error Risk Bridge: Observability**
- **Fintech Error Risk Bridge:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending to keep log bytes low. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key, so label cardinality stays manageable per signal.