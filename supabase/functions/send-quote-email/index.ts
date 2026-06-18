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
  return (reference || "weset-document").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "weset-document";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripHtml(value = "") {
  return String(value)
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
    .replace(/\s+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function removeRemoteImages(html = "") {
  return String(html).replace(/<img\b[^>]*>/gi, `<div style="display:inline-block;background:#ffffff;color:#145c58;border-radius:6px;padding:8px 12px;font-size:24px;font-weight:800;line-height:1;">WeSet</div>`);
}

function designedEmail(payload: QuoteEmailPayload) {
  if (payload.html) return removeRemoteImages(payload.html);
  const title = escapeHtml(payload.reference || "WeSet document");
  const text = escapeHtml(payload.text || "Please see the attached WeSet PDF.").replaceAll("\n", "<br>");
  return `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d9e0e1;border-radius:8px;overflow:hidden;">
      <div style="background:#145c58;color:#ffffff;padding:24px 28px;">
        <div style="display:inline-block;background:#ffffff;color:#145c58;border-radius:6px;padding:8px 12px;font-size:24px;font-weight:800;line-height:1;">WeSet</div>
        <h1 style="font-size:26px;line-height:1.2;margin:18px 0 0;">${title}</h1>
        <p style="margin:8px 0 0;color:#dce8ea;">Office setup, quoted clearly.</p>
      </div>
      <div style="padding:24px 28px;font-size:15px;line-height:1.6;">
        <p style="margin-top:0;">${text}</p>
        <div style="background:#e8f3f1;border-radius:8px;margin-top:22px;padding:14px 16px;"><strong>The PDF is attached to this email.</strong></div>
        <p style="margin-bottom:0;">Kind regards,<br><strong>WeSet</strong></p>
      </div>
    </div>
  </div>`;
}

function pdfEscape(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/[\\()]/g, "\\$&");
}

function cleanPdfText(value = "") {
  return stripHtml(value).replace(/[^\x20-\x7E\n]/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function wrapLine(line: string, max = 82) {
  const words = line.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
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

function matchLine(text: string, label: string) {
  const re = new RegExp(`${label}\\s*:?\\s*([^\\n]+)`, "i");
  return text.match(re)?.[1]?.trim() || "";
}

function buildPdf(payload: QuoteEmailPayload) {
  const source = cleanPdfText(payload.invoiceHtml || payload.html || payload.text || "WeSet document");
  const summary = cleanPdfText(payload.text || "");
  const reference = payload.reference || "WeSet document";
  const today = new Date().toISOString().slice(0, 10);
  const setupAddress = matchLine(summary, "Setup address") || matchLine(source, "Setup address") || "See document details";
  const quoteRef = matchLine(summary, "Quote") || reference;
  const subtotal = matchLine(summary, "Subtotal") || matchLine(source, "Subtotal") || "";
  const vat = matchLine(summary, "VAT") || matchLine(source, "VAT") || "";
  const total = matchLine(summary, "Total due") || matchLine(summary, "Total") || matchLine(source, "Total due") || matchLine(source, "Total") || "";
  const detailLines = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^WeSet$|^Quote$|^Invoice$|^Date:|^Reference:/i.test(line))
    .flatMap((line) => wrapLine(line))
    .slice(0, 18);

  const ops: string[] = [];
  const rect = (x: number, y: number, w: number, h: number, color: string) => ops.push("q", `${color} rg`, `${x} ${y} ${w} ${h} re f`, "Q");
  const strokeRect = (x: number, y: number, w: number, h: number, color: string) => ops.push("q", `${color} RG`, `${x} ${y} ${w} ${h} re S`, "Q");
  const text = (x: number, y: number, value: string, size = 10, font = "F1", color = "0.114 0.145 0.157") => {
    ops.push("BT", `${color} rg`, `/${font} ${size} Tf`, `${x} ${y} Td`, `(${pdfEscape(value)}) Tj`, "ET");
  };
  const rightText = (x: number, y: number, value: string, size = 10, font = "F1", color = "0.114 0.145 0.157") => text(Math.max(40, x - value.length * size * 0.52), y, value, size, font, color);

  rect(0, 742, 595, 100, "0.078 0.361 0.345");
  rect(38, 766, 118, 42, "1 1 1");
  text(55, 783, "WeSet", 22, "F2", "0.078 0.361 0.345");
  text(360, 790, reference.toUpperCase().startsWith("INV") ? "INVOICE" : "QUOTE", 27, "F2", "1 1 1");
  text(360, 770, `Reference: ${reference}`, 11, "F1", "0.862 0.910 0.918");

  text(40, 708, "Client / setup address", 12, "F2");
  rect(40, 620, 250, 76, "0.973 0.980 0.984");
  strokeRect(40, 620, 250, 76, "0.851 0.878 0.882");
  wrapLine(setupAddress, 42).slice(0, 4).forEach((line, index) => text(56, 672 - index * 15, line, 10));

  text(330, 708, "Document details", 12, "F2");
  rect(330, 620, 225, 76, "0.910 0.953 0.945");
  strokeRect(330, 620, 225, 76, "0.851 0.878 0.882");
  text(346, 672, `Reference: ${reference}`, 10, "F2");
  text(346, 656, `Quote: ${quoteRef}`, 10);
  text(346, 640, `Date: ${today}`, 10);

  rect(40, 560, 515, 30, "0.078 0.361 0.345");
  text(56, 570, "Description", 10, "F2", "1 1 1");
  rightText(535, 570, "Amount", 10, "F2", "1 1 1");
  rect(40, 410, 515, 150, "1 1 1");
  strokeRect(40, 410, 515, 150, "0.851 0.878 0.882");

  let y = 538;
  const rows = detailLines.length ? detailLines : ["Office setup document", "Please see the email body for the full details."];
  for (const line of rows.slice(0, 9)) {
    text(56, y, line.slice(0, 92), 9);
    y -= 14;
  }

  rect(330, 286, 225, 96, "0.973 0.980 0.984");
  strokeRect(330, 286, 225, 96, "0.851 0.878 0.882");
  text(346, 358, "Summary", 12, "F2");
  if (subtotal) { text(346, 336, "Subtotal", 10); rightText(535, 336, subtotal, 10, "F2"); }
  if (vat) { text(346, 318, "VAT", 10); rightText(535, 318, vat, 10, "F2"); }
  rect(330, 286, 225, 24, "0.078 0.361 0.345");
  text(346, 294, "Total", 11, "F2", "1 1 1");
  rightText(535, 294, total || "See document", 11, "F2", "1 1 1");

  rect(40, 286, 250, 96, "0.910 0.953 0.945");
  strokeRect(40, 286, 250, 96, "0.851 0.878 0.882");
  text(56, 358, "Notes", 12, "F2");
  text(56, 336, "Thank you for choosing WeSet.", 10);
  text(56, 320, "Please contact us with any questions.", 10);

  text(40, 70, "WeSet | Office setup, quoted clearly", 9, "F2", "0.078 0.361 0.345");
  text(40, 55, "Generated from the WeSet app.", 8, "F1", "0.408 0.455 0.471");

  const stream = ops.join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n"
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

  const filename = `${safeName(payload.reference)}.pdf`;
  const attachments = [{ filename, content: buildPdf(payload), contentType: "application/pdf" }];

  const body: Record<string, unknown> = {
    from: fromEmail,
    to: [payload.to],
    subject: payload.subject,
    text: payload.text || stripHtml(payload.html) || "Please see the attached WeSet PDF.",
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
  return json({ ok: true, providerId: data.id || null, quoteId: payload.quoteId || null, reference: payload.reference || null, attachment: filename });
});
