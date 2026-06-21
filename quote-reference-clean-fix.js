(() => {
  const quoteMapKey = "weset.quote.references";
  const invoiceStoreKey = "weset.invoices";
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  const isFriendlyQuote = (value) => /^Q-\d+$/i.test(String(value || ""));

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function quotes() {
    if (typeof state !== "undefined" && Array.isArray(state.quotes)) return state.quotes;
    return readJson("weset.quotes", []);
  }

  function existingQuoteNumber(quote) {
    const values = [quote?.quoteNumber, quote?.quote_number, quote?.reference, quote?.ref, quote?.number, quote?.id];
    const found = values.map((value) => String(value || "").trim().toUpperCase()).find(isFriendlyQuote);
    return found || "";
  }

  function buildReferenceMap() {
    const saved = readJson(quoteMapKey, {});
    const map = { ...saved };
    const rows = [...quotes()];
    let highest = Object.values(map).reduce((max, value) => {
      const number = Number(String(value || "").replace(/\D/g, ""));
      return Number.isFinite(number) ? Math.max(max, number) : max;
    }, 1000);

    rows.forEach((quote) => {
      const id = String(quote?.id || "");
      if (!id) return;
      const friendly = existingQuoteNumber(quote);
      if (friendly) {
        map[id] = friendly;
        highest = Math.max(highest, Number(friendly.replace(/\D/g, "")) || highest);
      }
    });

    rows
      .filter((quote) => quote?.id && !map[String(quote.id)])
      .sort((a, b) => String(a.createdAt || a.created_at || a.requiredDate || a.id).localeCompare(String(b.createdAt || b.created_at || b.requiredDate || b.id)))
      .forEach((quote) => {
        highest += 1;
        map[String(quote.id)] = `Q-${highest}`;
      });

    writeJson(quoteMapKey, map);
    return map;
  }

  function quoteReference(input) {
    const quote = typeof input === "object" && input ? input : quotes().find((entry) => String(entry.id) === String(input));
    const id = String(quote?.id || input || "");
    if (isFriendlyQuote(id)) return id.toUpperCase();
    const map = buildReferenceMap();
    return map[id] || "Q-1001";
  }

  function invoiceReferenceForQuoteId(id) {
    return `INV-${quoteReference(id).replace(/^Q-?/i, "")}`;
  }

  function replaceReferences(value) {
    let text = String(value ?? "");
    const map = buildReferenceMap();
    Object.entries(map).forEach(([id, ref]) => {
      if (!id || !ref) return;
      text = text.replaceAll(`INV-${id}`, `INV-${ref.replace(/^Q-?/i, "")}`);
      text = text.replaceAll(`Quote ${id}`, `Quote ${ref}`);
      text = text.replaceAll(id, ref);
    });
    return text.replace(uuidPattern, (match) => map[match] || match);
  }

  function repairInvoiceNumbers() {
    const rows = readJson(invoiceStoreKey, []);
    if (!Array.isArray(rows) || !rows.length) return;
    let changed = false;
    const repaired = rows.map((invoice) => {
      const quoteId = invoice.quoteId || invoice.quote_id || "";
      const current = String(invoice.invoiceNumber || invoice.invoice_number || invoice.id || "");
      if (!quoteId || !isUuid(quoteId)) return invoice;
      const friendly = invoiceReferenceForQuoteId(quoteId);
      if (current === friendly) return invoice;
      if (!isUuid(current) && !/^INV-[0-9a-f-]{20,}$/i.test(current)) return invoice;
      changed = true;
      return { ...invoice, id: friendly, invoiceNumber: friendly, invoice_number: friendly };
    });
    if (changed) writeJson(invoiceStoreKey, repaired);
  }

  function cleanTextNode(node) {
    const next = replaceReferences(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function cleanVisibleInputs() {
    document.querySelectorAll("input, textarea").forEach((field) => {
      const id = String(field.id || "");
      const name = String(field.name || "");
      const safeVisibleReferenceField = /invoice|quote|subject|message|reference|search/i.test(`${id} ${name}`);
      if (!safeVisibleReferenceField) return;
      const next = replaceReferences(field.value);
      if (next !== field.value) field.value = next;
    });
  }

  function cleanDocument() {
    buildReferenceMap();
    repairInvoiceNumbers();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return uuidPattern.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(cleanTextNode);
    cleanVisibleInputs();
  }

  const schedule = (() => {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(cleanDocument, 90);
    };
  })();

  window.wesetQuoteReference = quoteReference;
  window.wesetInvoiceReferenceForQuote = invoiceReferenceForQuoteId;
  window.wesetCleanQuoteReferences = cleanDocument;

  const oldNextQuoteId = typeof nextQuoteId === "function" ? nextQuoteId : null;
  if (oldNextQuoteId) {
    nextQuoteId = function friendlyNextQuoteId() {
      const map = buildReferenceMap();
      const highest = Math.max(1000, ...Object.values(map).map((value) => Number(String(value).replace(/\D/g, "")) || 1000));
      return `Q-${highest + 1}`;
    };
  }

  const observer = new MutationObserver(schedule);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener("input", schedule, true);
  document.addEventListener("click", () => setTimeout(cleanDocument, 150), true);
  window.addEventListener("storage", schedule);
  setTimeout(cleanDocument, 300);
  setTimeout(cleanDocument, 1200);
})();
