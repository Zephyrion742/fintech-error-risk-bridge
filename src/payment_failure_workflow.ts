import { z } from "zod";
import type { InfraiClient } from "./infrai_client.js";

export const paymentFailureSchema = z.object({
  paymentEventId: z.string().min(1),
  accountId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  processor: z.string().min(1),
  errorName: z.string().min(1),
  errorMessage: z.string().min(1),
  occurredAt: z.string().datetime(),
});

export type PaymentFailure = z.infer<typeof paymentFailureSchema>;

export type FailureDecision = {
  paymentEventId: string;
  action: "review" | "retry";
  notification: {
    kind: "payment_failure_recorded";
    auditRef: string;
    recordedAt: string;
  };
};

function flagEnabled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "value" in value) {
    return (value as { value: unknown }).value === true;
  }
  return false;
}

export async function recordPaymentFailure(
  input: PaymentFailure,
  infrai: InfraiClient,
): Promise<FailureDecision> {
  const highValueReview = flagEnabled(
    await infrai.getFlagValue("high-value-payment-review", false),
  );
  const action = highValueReview && input.amountMinor >= 100_000 ? "review" : "retry";

  await infrai.captureException(
    {
      title: `Payment processor failure: ${input.processor}`,
      message: input.errorMessage,
      level: "error",
      fingerprint: ["payment", input.processor, input.errorName],
      exception: `${input.errorName}: ${input.errorMessage}`,
      context: {
        payment_event_id: input.paymentEventId,
        account_id: input.accountId,
        amount_minor: input.amountMinor,
        currency: input.currency,
        processor: input.processor,
        occurred_at: input.occurredAt,
        risk_action: action,
      },
    },
    `payment-failure:${input.paymentEventId}`,
  );

  return {
    paymentEventId: input.paymentEventId,
    action,
    notification: {
      kind: "payment_failure_recorded",
      auditRef: `payment-failure:${input.paymentEventId}`,
      recordedAt: input.occurredAt,
    },
  };
}
