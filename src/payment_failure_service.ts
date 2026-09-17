import { createServer } from "node:http";
import { ZodError } from "zod";
import { createInfraiClient, InfraiError } from "./infrai_client.js";
import { paymentFailureSchema, recordPaymentFailure } from "./payment_failure_workflow.js";

const port = Number(process.env.PORT ?? 3000);
const infrai = createInfraiClient();

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/payment-failures") {
    response.writeHead(404).end(JSON.stringify({ error: "route_not_found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = paymentFailureSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const decision = await recordPaymentFailure(input, infrai);
    response.writeHead(202).end(JSON.stringify(decision));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "invalid_payment_failure" }));
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      response.writeHead(error.status).end(JSON.stringify({ error: error.code }));
      return;
    }
    console.error(error);
    response.writeHead(502).end(JSON.stringify({ error: "dependency_error" }));
  }
});

server.listen(port, () => console.log(`payment failure receiver listening on :${port}`));
