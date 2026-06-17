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
  html?: string;
  invoiceHtml?: string;
  reference?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function safeName(reference?: string) {
  return (reference || "weset-invoice").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "weset-invoice";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripHtml(value = "") {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&pound;/g, "GBP ")
    .replace(/£/g, "GBP ")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function designedEmail(payload: QuoteEmailPayload) {
  if (payload.html) return payload.html;
  const text = escapeHtml(payload.text || "Please see the attached WeSet invoice.").replaceAll("\n", "<br>");
  const title = escapeHtml(payload.reference || "WeSet invoice");
  return `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d9e0e1;border-radius:8px;overflow:hidden;">
      <div style="background:#145c58;color:#ffffff;padding:24px 28px;">
        <img src="https://dirnfeldh-code.github.io/Weset/assets/weset-logo-live.jpg" alt="WeSet" style="display:block;max-width:190px;background:#ffffff;border-radius:6px;padding:4px;margin-bottom:16px;">
        <h1 style="font-size:26px;line-height:1.2;margin:0;">${title}</h1>
        <p style="margin:8px 0 0;color:#dce8ea;">Office setup, quoted clearly.</p>
      </div>
      <div style="padding:24px 28px;font-size:15px;line-height:1.6;">
        <p style="margin-top:0;">${text}</p>
        <div style="background:#e8f3f1;border-radius:8px;margin-top:22px;padding:14px 16px;">
          <strong>The invoice PDF is attached to this email.</strong>
        </div>
        <p style="margin-bottom:0;">Kind regards,<br><strong>WeSet</strong></p>
      </div>
    </div>
  </div>`;
}

function pdfEscape(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/[\\()]/g, "\\$&");
}

function wrapLine(line: string, max = 84) {
  const words = line.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > max) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildPdf(payload: QuoteEmailPayload) {
  const source = stripHtml(payload.invoiceHtml || payload.html || payload.text || "WeSet invoice").replace(/[^\x20-\x7E\n]/g, " ");
  const rawLines = [
    "WeSet Invoice",
    payload.reference ? `Reference: ${payload.reference}` : "",
    "",
    ...source.split("\n")
  ].filter((line, index) => index < 2 || line.trim() !== "");

  const lines = rawLines.flatMap((line) => wrapLine(line)).slice(0, 42);
  const textOps = ["BT", "/F1 18 Tf", "50 790 Td", "(WeSet Invoice) Tj", "/F1 10 Tf", "0 -26 Td"];
  for (const line of lines.slice(1)) textOps.push(`(${pdfEscape(line)}) Tj`, "0 -15 Td");
  textOps.push("ET");
  const stream = textOps.join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return btoa(pdf);
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
  if (!payload.text && !payload.html) return json({ error: "Email body is missing." }, 400);

  const attachments = payload.invoiceHtml || payload.text || payload.html
    ? [{ filename: `${safeName(payload.reference)}.pdf`, content: buildPdf(payload) }]
    : [];

  const body: Record<string, unknown> = {
    from: fromEmail,
    to: [payload.to],
    subject: payload.subject,
    text: payload.text || stripHtml(payload.html) || "Please see the attached WeSet invoice.",
    html: designedEmail(payload),
    attachments
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: data.message || "Email provider rejected the message.", details: data }, 502);
  return json({ ok: true, providerId: data.id || null, quoteId: payload.quoteId || null, reference: payload.reference || null, attachment: attachments[0]?.filename || null });
});
