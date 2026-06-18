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

type LineItem = { description: string; qty: string; unit: string; amount: string };
type PdfDetails = {
  docType: string;
  reference: string;
  quoteRef: string;
  date: string;
  fromCompany: string;
  fromDetails: string;
  clientCompany: string;
  clientContact: string;
  clientEmail: string;
  setupAddress: string;
  items: LineItem[];
  subtotal: string;
  vatLabel: string;
  vatAmount: string;
  total: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function safeName(reference?: string) {
  return (reference || "weset-document").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "weset-document";
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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
  return `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;"><div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d9e0e1;border-radius:8px;overflow:hidden;"><div style="background:#145c58;color:#ffffff;padding:24px 28px;"><div style="display:inline-block;background:#ffffff;color:#145c58;border-radius:6px;padding:8px 12px;font-size:24px;font-weight:800;line-height:1;">WeSet</div><h1 style="font-size:26px;line-height:1.2;margin:18px 0 0;">${title}</h1><p style="margin:8px 0 0;color:#dce8ea;">Office setup, quoted clearly.</p></div><div style="padding:24px 28px;font-size:15px;line-height:1.6;"><p style="margin-top:0;">${text}</p><div style="background:#e8f3f1;border-radius:8px;margin-top:22px;padding:14px 16px;"><strong>The PDF is attached to this email.</strong></div><p style="margin-bottom:0;">Kind regards,<br><strong>WeSet</strong></p></div></div></div>`;
}

function lineValue(text: string, label: string) {
  const line = text.split("\n").find((entry) => entry.toUpperCase().startsWith(`${label.toUpperCase()}:`));
  return line ? line.slice(label.length + 1).trim() : "";
}

function parseItems(text: string): LineItem[] {
  return text.split("\n").filter((line) => /^ITEM:/i.test(line)).map((line) => {
    const parts = line.replace(/^ITEM:\s*/i, "").split("|").map((part) => part.trim());
    const clean = (value: string, label: string) => value.replace(new RegExp(`^${label}:\\s*`, "i"), "").trim();
    return {
      description: clean(parts[0] || "Office setup services", "ITEM"),
      qty: clean(parts[1] || "1", "QTY"),
      unit: clean(parts[2] || "", "UNIT"),
      amount: clean(parts[3] || "", "AMOUNT")
    };
  });
}

function detailsFromPayload(payload: QuoteEmailPayload): PdfDetails {
  const text = stripHtml(payload.text || "");
  const fallback = stripHtml(payload.invoiceHtml || payload.html || "");
  const reference = lineValue(text, "REFERENCE") || payload.reference || "WeSet document";
  return {
    docType: lineValue(text, "DOC_TYPE") || (reference.toUpperCase().startsWith("INV") ? "Invoice" : "Quote"),
    reference,
    quoteRef: lineValue(text, "QUOTE_REF") || reference,
    date: lineValue(text, "DATE") || new Date().toISOString().slice(0, 10),
    fromCompany: lineValue(text, "FROM_COMPANY") || "WeSet",
    fromDetails: lineValue(text, "FROM_DETAILS") || "Office Setup Consultancy | London, United Kingdom | quotes@weset.co.uk",
    clientCompany: lineValue(text, "CLIENT_COMPANY") || "Client",
    clientContact: lineValue(text, "CLIENT_CONTACT") || "",
    clientEmail: lineValue(text, "CLIENT_EMAIL") || payload.to || "",
    setupAddress: lineValue(text, "SETUP_ADDRESS") || "See details",
    items: parseItems(text).length ? parseItems(text) : [{ description: fallback.split("\n").find(Boolean) || "Office setup services", qty: "1", unit: "", amount: "" }],
    subtotal: lineValue(text, "SUBTOTAL") || "",
    vatLabel: lineValue(text, "VAT_LABEL") || "VAT",
    vatAmount: lineValue(text, "VAT_AMOUNT") || "",
    total: lineValue(text, "TOTAL") || ""
  };
}

function pdfEscape(value: string) {
  return String(value || "").replace(/[^\x20-\x7E]/g, " ").replace(/[\\()]/g, "\\$&");
}

function wrapLine(line: string, max = 42) {
  const words = String(line || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > max) {
      if (current) lines.push(current);
      current = word;
    } else current = (current + " " + word).trim();
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildPdf(payload: QuoteEmailPayload) {
  const details = detailsFromPayload(payload);
  const ops: string[] = [];
  const rect = (x: number, y: number, w: number, h: number, color: string) => ops.push("q", `${color} rg`, `${x} ${y} ${w} ${h} re f`, "Q");
  const strokeRect = (x: number, y: number, w: number, h: number, color: string) => ops.push("q", `${color} RG`, `${x} ${y} ${w} ${h} re S`, "Q");
  const text = (x: number, y: number, value: string, size = 10, font = "F1", color = "0.114 0.145 0.157") => ops.push("BT", `${color} rg`, `/${font} ${size} Tf`, `${x} ${y} Td`, `(${pdfEscape(value)}) Tj`, "ET");
  const rightText = (x: number, y: number, value: string, size = 10, font = "F1", color = "0.114 0.145 0.157") => text(Math.max(40, x - String(value || "").length * size * 0.52), y, value, size, font, color);

  rect(0, 742, 595, 100, "0.078 0.361 0.345");
  rect(38, 766, 118, 42, "1 1 1");
  text(55, 783, "WeSet", 22, "F2", "0.078 0.361 0.345");
  text(378, 792, details.docType.toUpperCase(), 27, "F2", "1 1 1");
  text(378, 771, `No. ${details.reference}`, 11, "F1", "0.862 0.910 0.918");

  text(40, 714, "From", 12, "F2");
  strokeRect(40, 612, 245, 88, "0.851 0.878 0.882");
  text(56, 676, details.fromCompany, 12, "F2");
  details.fromDetails.split("|").map((part) => part.trim()).slice(0, 4).forEach((line, index) => text(56, 656 - index * 14, line, 9));

  text(310, 714, "Bill to", 12, "F2");
  strokeRect(310, 612, 245, 88, "0.851 0.878 0.882");
  text(326, 676, details.clientCompany, 12, "F2");
  [details.clientContact, details.clientEmail, ...wrapLine(details.setupAddress, 36)].filter(Boolean).slice(0, 4).forEach((line, index) => text(326, 656 - index * 14, line, 9));

  rect(40, 570, 515, 28, "0.910 0.953 0.945");
  text(56, 580, `Reference: ${details.reference}`, 10, "F2");
  text(240, 580, `Quote: ${details.quoteRef}`, 10);
  text(420, 580, `Date: ${details.date}`, 10);

  rect(40, 522, 515, 30, "0.078 0.361 0.345");
  text(54, 532, "Description", 10, "F2", "1 1 1");
  rightText(364, 532, "Qty", 10, "F2", "1 1 1");
  rightText(452, 532, "Unit", 10, "F2", "1 1 1");
  rightText(538, 532, "Amount", 10, "F2", "1 1 1");

  let y = 496;
  details.items.slice(0, 10).forEach((item, index) => {
    if (index % 2 === 0) rect(40, y - 8, 515, 24, "0.973 0.980 0.984");
    const desc = wrapLine(item.description, 46);
    text(54, y, desc[0] || "Item", 9);
    rightText(364, y, item.qty, 9);
    rightText(452, y, item.unit, 9);
    rightText(538, y, item.amount, 9, "F2");
    y -= Math.max(24, desc.length * 12);
  });
  strokeRect(40, y + 8, 515, 520 - y, "0.851 0.878 0.882");

  const boxY = Math.max(160, y - 130);
  rect(330, boxY, 225, 112, "0.973 0.980 0.984");
  strokeRect(330, boxY, 225, 112, "0.851 0.878 0.882");
  text(346, boxY + 86, "Totals", 12, "F2");
  text(346, boxY + 62, "Subtotal", 10); rightText(535, boxY + 62, details.subtotal, 10, "F2");
  text(346, boxY + 42, details.vatLabel || "VAT", 10); rightText(535, boxY + 42, details.vatAmount, 10, "F2");
  rect(330, boxY, 225, 30, "0.078 0.361 0.345");
  text(346, boxY + 10, details.docType === "Invoice" ? "Total due" : "Total", 12, "F2", "1 1 1");
  rightText(535, boxY + 10, details.total, 12, "F2", "1 1 1");

  text(40, 96, "Thank you for choosing WeSet.", 10, "F2", "0.078 0.361 0.345");
  text(40, 78, "Please contact us with any questions about this document.", 9, "F1", "0.408 0.455 0.471");
  text(40, 55, "WeSet | Office setup, quoted clearly | quotes@weset.co.uk", 8, "F1", "0.408 0.455 0.471");

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
  for (const object of objects) { offsets.push(pdf.length); pdf += object; }
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
  const body: Record<string, unknown> = {
    from: fromEmail,
    to: [payload.to],
    subject: payload.subject,
    text: payload.text || stripHtml(payload.html) || "Please see the attached WeSet PDF.",
    html: designedEmail(payload),
    attachments: [{ filename, content: buildPdf(payload), contentType: "application/pdf" }]
  };

  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: data.message || "Email provider rejected the message.", details: data }, 502);
  return json({ ok: true, providerId: data.id || null, quoteId: payload.quoteId || null, reference: payload.reference || null, attachment: filename });
});
