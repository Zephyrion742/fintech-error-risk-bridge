import assert from "node:assert/strict";
import test from "node:test";
import type { InfraiClient } from "../src/infrai_client.js";
import { recordPaymentFailure } from "../src/payment_failure_workflow.js";

test("routes a high-value failure to review and captures an audit reference", async () => {
  const captures: Array<{ payload: unknown; key: string }> = [];
  const infrai: InfraiClient = {
    getFlagValue: async () => ({ value: true }),
    captureException: async (payload, key) => {
      captures.push({ payload, key });
      return { event_id: "evt_401" };
    },
  };

  const result = await recordPaymentFailure(
    {
      paymentEventId: "pay_evt_018",
      accountId: "acct_1042",
      amountMinor: 125000,
      currency: "USD",
      processor: "card-processor",
      errorName: "AuthorizationDeclined",
      errorMessage: "issuer declined authorization",
      occurredAt: "2026-09-03T08:30:00.000Z",
    },
    infrai,
  );

  assert.equal(result.action, "review");
  assert.equal(result.notification.auditRef, "payment-failure:pay_evt_018");
  assert.equal(captures[0]?.key, "payment-failure:pay_evt_018");
  assert.deepEqual(
    (captures[0]?.payload as { fingerprint: string[] }).fingerprint,
    ["payment", "card-processor", "AuthorizationDeclined"],
  );
});
