// Thin QStash wrapper — the serverless-native substitute for a persistent
// BullMQ/Celery worker (immich, Paperless-ngx) on Vercel, where no process stays
// alive to host a queue consumer. Each "worker tick" is instead a fresh, short
// Vercel invocation that QStash schedules and re-invokes, per docs/2026-07-06-
// repo-research-findings.md's adapted-immich-pattern recommendation.
//
// Feature-detected: every caller must check isQstashConfigured() first and fall
// back to the pre-existing client-polling behavior when it's false, so this is
// a pure addition with zero risk to the current (working) flow for any
// environment that hasn't set the three QSTASH_* env vars.
import { Client, Receiver } from "@upstash/qstash";

export function isQstashConfigured(): boolean {
  return !!process.env.QSTASH_TOKEN;
}

let _client: Client | null = null;
function getClient(): Client {
  if (!_client) _client = new Client({ token: process.env.QSTASH_TOKEN! });
  return _client;
}

/**
 * Schedule a delayed callback to `url` carrying `body` as JSON. Used to move a
 * poll-the-external-job step off the client (which may close its tab) and onto
 * a QStash-scheduled server invocation instead.
 */
export async function scheduleCallback(params: {
  url: string;
  body: Record<string, unknown>;
  delaySeconds?: number;
}): Promise<{ messageId: string } | null> {
  if (!isQstashConfigured()) return null;
  const res = await getClient().publishJSON({
    url: params.url,
    body: params.body,
    delay: params.delaySeconds ?? 15,
  });
  return { messageId: res.messageId };
}

/**
 * Verify an incoming QStash webhook request's signature. Returns the parsed
 * JSON body on success, throws on an invalid/missing signature. Callers must
 * reject the request (401/403) on a thrown error rather than proceeding — an
 * unverified body must never be trusted as "QStash told us to do this."
 */
export async function verifyQstashRequest(req: Request): Promise<any> {
  const signature = req.headers.get("upstash-signature");
  if (!signature) throw new Error("Missing Upstash-Signature header");
  const bodyText = await req.text();
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });
  const isValid = await receiver.verify({ signature, body: bodyText });
  if (!isValid) throw new Error("Invalid Upstash-Signature");
  return JSON.parse(bodyText);
}
