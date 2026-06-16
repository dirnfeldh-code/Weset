const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type QuoteEmailPayload = {
  quoteId?: string;
  to?: string;
  subject?: string;
  text?: string;
  reference?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("QUOTE_FROM_EMAIL") || "WeSet <quotes@weset.co.uk>";
  if (!resendApiKey) return json({ error: "RESEND_API_KEY is not configured in Supabase Edge Function secrets." }, 500);

  const payload = await request.json().catch(() => ({})) as QuoteEmailPayload;
  if (!payload.to) return json({ error: "Client email address is missing." }, 400);
  if (!payload.subject) return json({ error: "Email subject is missing." }, 400);
  if (!payload.text) return json({ error: "Email body is missing." }, 400);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: data.message || "Email provider rejected the message.", details: data }, 502);
  return json({ ok: true, providerId: data.id || null, quoteId: payload.quoteId || null, reference: payload.reference || null });
});
