export {};

const response = await fetch("http://localhost:3000/payment-failures", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    paymentEventId: "pay_evt_018",
    accountId: "acct_1042",
    amountMinor: 125000,
    currency: "usd",
    processor: "card-processor",
    errorName: "AuthorizationDeclined",
    errorMessage: "issuer declined authorization",
    occurredAt: "2026-09-03T08:30:00.000Z"
  }),
});

console.log(response.status, await response.json());
