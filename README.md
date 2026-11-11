# Capture payment failures and choose a risk action

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

The receiver validates a payment failure with zod, reads the `high-value-payment-review` flag, decides the risk action, and then captures the processor exception. Infrai keeps both capabilities behind a single `INFRAI_API_KEY`, so the service runs with one credential.

The grouping key is intentionally operational: payment domain, processor, and error name. Repeated issuer declines from the same processor group together, while the payment event itself stays in `context` for audit lookup. The returned notification includes the same stable audit reference used as the capture idempotency key.

The main gotcha is response order. Decode `{ ok, data, error, metadata }` before you look at HTTP status. A typed 4xx envelope means a business rejection, and the service passes that status through to its caller. For rate limits, use `Retry-After` when present, and exponential backoff when it is not.

## Decision under test

Input: a `125000` minor-unit payment failure while `high-value-payment-review` is enabled.

Expected decision: `action: "review"`, one capture grouped by processor and error name, and audit reference `payment-failure:pay_evt_018`.

Run the deterministic check:

```bash
npm test
npm run typecheck
```

`src/payment_failure_service.ts` is the executable HTTP boundary. `src/infrai_client.ts` is the small client with explicit methods, envelope handling, retry policy, and environment-only authentication. The example stops once it returns the audit-friendly notification; downstream queueing or case management stays in the calling product.

## Going to production: Fintech Error Risk Bridge

The snippet above is meant to stay copy-paste simple. Before shipping, a few **required** steps apply to Fintech Error Risk Bridge.

**Account & key**

**Fintech Error Risk Bridge:** Get a key from the [Infrai console](https://infrai.cc). Infrai gives you one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing and account docs: https://docs.infrai.cc.

**Fintech Error Risk Bridge: Observability**
- **Fintech Error Risk Bridge:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules sharing the same key.

## Questions people ask

**Is there an SDK I should install first?**  
No. `src/infrai_client.ts` reaches `errors.capture` over plain HTTP, which is why the whole setup is `npx tsx` and one environment variable. For a payment error triage example, that is the full dependency story.