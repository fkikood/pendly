import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://fkikood.github.io",
  "Access-Control-Allow-Headers": "content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function decodeBase64(value: string): Uint8Array {
  const raw = atob(value);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function validSignature(secret: string, id: string, timestamp: string, body: string, header: string): Promise<boolean> {
  const keyText = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey("raw", decodeBase64(keyText), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`)));
  const expected = btoa(String.fromCharCode(...mac));
  return header.split(" ").some(part => {
    const token = part.split(",");
    return token.length === 2 && token[0] === "v1" && constantTimeEqual(token[1], expected);
  });
}
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !url || !serviceKey) return reply({ error: "webhook_not_configured" }, 503);
  const id = req.headers.get("svix-id") || "";
  const timestamp = req.headers.get("svix-timestamp") || "";
  const signature = req.headers.get("svix-signature") || "";
  const ts = Number(timestamp);
  if (!id || !timestamp || !signature || !Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return reply({ error: "invalid_webhook_headers" }, 401);
  }
  const raw = await req.text();
  try {
    if (!await validSignature(secret, id, timestamp, raw, signature)) return reply({ error: "invalid_signature" }, 401);
  } catch {
    return reply({ error: "invalid_signature" }, 401);
  }
  let event: any;
  try { event = JSON.parse(raw); } catch { return reply({ error: "invalid_json" }, 400); }
  const type = String(event.type || "");
  const data = event.data || {};
  const supported = new Set(["email.sent", "email.delivered", "email.delivery_delayed", "email.bounced", "email.complained", "email.failed"]);
  if (!supported.has(type)) return reply({ received: true, ignored: true });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await admin.from("feedback_email_events").upsert({
    provider: "resend",
    provider_event_id: id,
    provider_email_id: typeof data.email_id === "string" ? data.email_id : null,
    event_type: type,
    recipient: Array.isArray(data.to) && typeof data.to[0] === "string" ? data.to[0].slice(0, 320) : null,
    occurred_at: event.created_at && !Number.isNaN(Date.parse(event.created_at)) ? new Date(event.created_at).toISOString() : null,
  }, { onConflict: "provider_event_id", ignoreDuplicates: true });
  if (error) return reply({ error: "persistence_failed" }, 500);
  return reply({ received: true });
});