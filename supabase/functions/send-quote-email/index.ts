const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type QuoteEmailPayload = { quoteId?: string; to?: string; subject?: string; text?: string; html?: string; invoiceHtml?: string; reference?: string };
type LineItem = { product: string; description: string; qty: string; rate: string; amount: string; vat: string };
type PdfDetails = {
  docType: string; reference: string; quoteRef: string; date: string; dueDate: string; terms: string;
  fromCompany: string; fromAddress1: string; fromAddress2: string; fromVat: string; fromEmail: string; fromPhone: string;
  clientCompany: string; clientContact: string; clientEmail: string; shipTo: string;
  items: LineItem[]; subtotal: string; vatLabel: string; vatAmount: string; total: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function safeName(reference?: string) { return (reference || "weset-document").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "weset-document"; }
function stripHtml(value = "") { return String(value).replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&pound;/g, "GBP ").replace(/£/g, "GBP ").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\n{3,}/g, "\n\n").trim(); }
function removeRemoteImages(html = "") { return String(html).replace(/<img\b[^>]*>/gi, `<div style="display:inline-block;background:#ffffff;color:#145c58;border-radius:6px;padding:8px 12px;font-size:24px;font-weight:800;line-height:1;">WeSet</div>`); }
function lineValue(text: string, label: string) { const line = text.split("\n").find((entry) => entry.toUpperCase().startsWith(`${label.toUpperCase()}:`)); return line ? line.slice(label.length + 1).trim() : ""; }
function cleanPart(value: string, label: string) { return String(value || "").replace(new RegExp(`^${label}:\\s*`, "i"), "").trim(); }
function parseItems(text: string): LineItem[] {
  return text.split("\n").filter((line) => /^ITEM:/i.test(line)).map((line) => {
    const parts = line.replace(/^ITEM:\s*/i, "").split("|").map((part) => part.trim());
    return {
      product: cleanPart(parts[0] || "Services", "ITEM"),
      description: cleanPart(parts.find((p) => /^DESC:/i.test(p)) || "Office setup services", "DESC"),
      qty: cleanPart(parts.find((p) => /^QTY:/i.test(p)) || "1", "QTY"),
      rate: cleanPart(parts.find((p) => /^RATE:/i.test(p)) || "", "RATE"),
      amount: cleanPart(parts.find((p) => /^AMOUNT:/i.test(p)) || "", "AMOUNT"),
      vat: cleanPart(parts.find((p) => /^VAT:/i.test(p)) || "", "VAT")
    };
  });
}
function detailsFromPayload(payload: QuoteEmailPayload): PdfDetails {
  const text = stripHtml(payload.text || "");
  const reference = lineValue(text, "REFERENCE") || payload.reference || "WeSet document";
  const items = parseItems(text);
  return {
    docType: lineValue(text, "DOC_TYPE") || (reference.toUpperCase().startsWith("INV") ? "Invoice" : "Quote"),
    reference, quoteRef: lineValue(text, "QUOTE_REF") || reference, date: lineValue(text, "DATE") || new Date().toISOString().slice(0, 10), dueDate: lineValue(text, "DUE_DATE") || "", terms: lineValue(text, "TERMS") || "Net 15",
    fromCompany: lineValue(text, "FROM_COMPANY") || "WeSet", fromAddress1: lineValue(text, "FROM_ADDRESS1") || "", fromAddress2: lineValue(text, "FROM_ADDRESS2") || "", fromVat: lineValue(text, "FROM_VAT") || "", fromEmail: lineValue(text, "FROM_EMAIL") || "", fromPhone: lineValue(text, "FROM_PHONE") || "",
    clientCompany: lineValue(text, "CLIENT_COMPANY") || "Client", clientContact: lineValue(text, "CLIENT_CONTACT") || "", clientEmail: lineValue(text, "CLIENT_EMAIL") || payload.to || "", shipTo: lineValue(text, "SHIP_TO") || "",
    items: items.length ? items : [{ product: "Services", description: "Office setup services", qty: "1", rate: "", amount: "", vat: "" }],
    subtotal: lineValue(text, "SUBTOTAL") || "", vatLabel: lineValue(text, "VAT_LABEL") || "VAT", vatAmount: lineValue(text, "VAT_AMOUNT") || "", total: lineValue(text, "TOTAL") || ""
  };
}
function pdfEscape(value: string) { return String(value || "").replace(/[^\x20-\x7E]/g, " ").replace(/[\\()]/g, "\\$&"); }
function wrapLine(line: string, max = 32) { const words = String(line || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean); const lines: string[] = []; let current = ""; for (const word of words) { if ((current + " " + word).trim().length > max) { if (current) lines.push(current); current = word; } else current = (current + " " + word).trim(); } if (current) lines.push(current); return lines.length ? lines : [""]; }
function designedEmail(payload: QuoteEmailPayload) { if (payload.html) return removeRemoteImages(payload.html); return `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;"><div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d9e0e1;border-radius:8px;overflow:hidden;"><div style="background:#145c58;color:#ffffff;padding:24px 28px;"><div style="display:inline-block;background:#ffffff;color:#145c58;border-radius:6px;padding:8px 12px;font-size:24px;font-weight:800;line-height:1;">WeSet</div><h1 style="font-size:26px;line-height:1.2;margin:18px 0 0;">${payload.reference || "WeSet document"}</h1></div><div style="padding:24px 28px;font-size:15px;line-height:1.6;">${String(payload.text || "Please see attached PDF.").replaceAll("\n", "<br>")}</div></div></div>`; }
function buildPdf(payload: QuoteEmailPayload) {
  const d = detailsFromPayload(payload); const ops: string[] = [];
  const rect = (x: number, y: number, w: number, h: number, color: string) => ops.push("q", `${color} rg`, `${x} ${y} ${w} ${h} re f`, "Q");
  const line = (x1: number, y1: number, x2: number, y2: number, color = "0.82 0.85 0.87") => ops.push("q", `${color} RG`, `${x1} ${y1} m ${x2} ${y2} l S`, "Q");
  const text = (x: number, y: number, value: string, size = 9, font = "F1", color = "0.114 0.145 0.157") => ops.push("BT", `${color} rg`, `/${font} ${size} Tf`, `${x} ${y} Td`, `(${pdfEscape(value)}) Tj`, "ET");
  const rightText = (x: number, y: number, value: string, size = 9, font = "F1", color = "0.114 0.145 0.157") => text(Math.max(40, x - String(value || "").length * size * 0.52), y, value, size, font, color);

  text(40, 790, d.docType.toUpperCase(), 16, "F2", "0.050 0.435 0.624");
  text(40, 770, d.fromCompany, 9, "F2"); text(40, 756, d.fromAddress1, 9); text(40, 742, d.fromAddress2, 9); text(40, 728, d.fromVat, 9);
  text(210, 764, d.fromEmail, 9); text(210, 750, d.fromPhone, 9);
  rect(348, 724, 190, 72, "0.93 0.93 0.93"); text(377, 762, "WeSet", 30, "F2", "0.078 0.361 0.345"); text(395, 742, "Your Office, Ready.", 10, "F1", "0.078 0.361 0.345");

  rect(0, 592, 595, 110, "0.918 0.953 0.984");
  text(40, 674, "Bill to", 9, "F2"); text(40, 660, d.clientCompany, 9); text(40, 646, d.clientContact, 9); text(40, 632, d.clientEmail, 9);
  text(385, 674, "Ship to", 9, "F2"); wrapLine(d.shipTo || d.clientCompany, 34).slice(0, 4).forEach((v, i) => text(385, 660 - i * 14, v, 9));
  line(40, 596, 555, 596, "0.77 0.82 0.86");
  text(40, 560, `${d.docType} details`, 10, "F2"); text(40, 544, `${d.docType} no.: ${d.reference}`, 9); text(40, 530, `Terms: ${d.terms}`, 9); text(40, 516, `${d.docType} date: ${d.date}`, 9); text(40, 502, `Due date: ${d.dueDate || d.date}`, 9);

  const top = 452; text(38, top, "#", 9, "F2"); text(66, top, "Product or service", 9, "F2"); text(202, top, "Description", 9, "F2"); rightText(370, top, "Qty", 9, "F2"); rightText(440, top, "Rate", 9, "F2"); rightText(510, top, "Amount", 9, "F2"); rightText(555, top, "VAT", 9, "F2"); line(40, top - 10, 555, top - 10);
  let y = top - 34;
  d.items.slice(0, 8).forEach((item, index) => {
    text(40, y, `${index + 1}.`, 8); wrapLine(item.product, 22).slice(0, 3).forEach((v, i) => text(66, y - i * 12, v, 8, i ? "F1" : "F2")); wrapLine(item.description, 34).slice(0, 3).forEach((v, i) => text(202, y - i * 12, v, 8)); rightText(370, y, item.qty, 8); rightText(440, y, item.rate, 8); rightText(510, y, item.amount, 8); rightText(555, y, item.vat, 8); y -= 58; line(40, y + 16, 555, y + 16, "0.88 0.90 0.91");
  });
  const totalY = Math.max(64, y - 8); text(372, totalY + 48, d.vatLabel, 9); rightText(555, totalY + 48, d.vatAmount, 9); line(372, totalY + 30, 555, totalY + 30); text(372, totalY, "Total", 11, "F2"); rightText(555, totalY, d.total, 11, "F2");

  const stream = ops.join("\n"); const objects = ["1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n", "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n", "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >>\nendobj\n", "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n", `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`, "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n"];
  let pdf = "%PDF-1.4\n"; const offsets = [0]; for (const object of objects) { offsets.push(pdf.length); pdf += object; } const xref = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`; pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return btoa(pdf);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  const resendApiKey = Deno.env.get("RESEND_API_KEY"); const fromEmail = Deno.env.get("QUOTE_FROM_EMAIL") || "WeSet <quotes@weset.co.uk>";
  if (!resendApiKey) return json({ error: "RESEND_API_KEY is not configured in Supabase Edge Function secrets." }, 500);
  const payload = await request.json().catch(() => ({})) as QuoteEmailPayload;
  if (!payload.to) return json({ error: "Client email address is missing." }, 400); if (!payload.subject) return json({ error: "Email subject is missing." }, 400); if (!payload.text && !payload.html) return json({ error: "Email body is missing." }, 400);
  const filename = `${safeName(payload.reference)}.pdf`;
  const body: Record<string, unknown> = { from: fromEmail, to: [payload.to], subject: payload.subject, text: payload.text || stripHtml(payload.html) || "Please see the attached PDF.", html: designedEmail(payload), attachments: [{ filename, content: buildPdf(payload), contentType: "application/pdf" }] };
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({})); if (!response.ok) return json({ error: data.message || "Email provider rejected the message.", details: data }, 502);
  return json({ ok: true, providerId: data.id || null, quoteId: payload.quoteId || null, reference: payload.reference || null, attachment: filename });
});
