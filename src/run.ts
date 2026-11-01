import { rotateShipmentSession } from "./refresh_session.ts";
import { z } from "zod";

const shipmentEvent = z.object({
  shipment_id: z.string().min(1),
  event: z.enum(["handoff", "delivered", "exception"]),
  proof_of_delivery: z.string().optional(),
});

const input = shipmentEvent.parse({
  shipment_id: process.env.SHIPMENT_ID ?? "shipment-demo-001",
  event: "handoff",
  proof_of_delivery: "pod-awaiting-upload",
});

if (!process.env.REFRESH_TOKEN || !process.env.PREVIOUS_SESSION_ID) {
  console.error("Set INFRAI_API_KEY, REFRESH_TOKEN, and PREVIOUS_SESSION_ID to run the cutover example.");
  process.exitCode = 1;
} else {
  const result = await rotateShipmentSession({
    refresh_token: process.env.REFRESH_TOKEN,
    previous_session_id: process.env.PREVIOUS_SESSION_ID,
  });
  console.log(JSON.stringify({ shipment: input, session: result }, null, 2));
}
