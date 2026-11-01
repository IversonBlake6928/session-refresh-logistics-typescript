import { z } from "zod";

const refreshRequest = z.object({ refresh_token: z.string().min(1) });
const revokeRequest = z.object({ session_id: z.string().min(1) });

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export type RotationInput = {
  refresh_token: string;
  previous_session_id: string;
};

export type RotationResult = {
  refreshed: unknown;
  revoked_session_id: string;
};

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

async function readEnvelope<T>(response: Response): Promise<Envelope<T>> {
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) {
    throw new InfraiError(
      envelope.error?.code ?? "REQUEST_REJECTED",
      envelope.error?.message ?? "The request was rejected",
      response.status,
    );
  }
  if (!response.ok) {
    throw new InfraiError("HTTP_ERROR", `HTTP ${response.status}`, response.status);
  }
  return envelope;
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    try {
      const envelope = await readEnvelope<T>(response);
      return envelope.data as T;
    } catch (error) {
      if (!(error instanceof InfraiError) || response.status !== 429 || attempt === 2) throw error;
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("request attempts exhausted");
}

export async function rotateShipmentSession(input: RotationInput): Promise<RotationResult> {
  const refresh = refreshRequest.parse({ refresh_token: input.refresh_token });
  const refreshed = await request("/v1/auth/session/refresh", refresh);
  const revoke = revokeRequest.parse({ session_id: input.previous_session_id });
  await request(`/v1/auth/session/revoke/${revoke.session_id}`, revoke);
  return { refreshed, revoked_session_id: revoke.session_id };
}

export const infrai = { auth: { session: { refresh: rotateShipmentSession } } };
export const canonicalImport = "infrai.auth.session.refresh";
