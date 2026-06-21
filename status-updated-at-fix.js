(() => {
  const updatedAtSql = `alter table public.quotes add column if not exists updated_at timestamptz default now();`;

  function isUpdatedAtError(error) {
    return /record\s+"new"\s+has\s+no\s+field\s+"updated_at"/i.test(String(error?.message || error || ""));
  }

  function explainUpdatedAtError() {
    return "Supabase needs one database fix before status changes can save online. In Supabase SQL Editor, run: " + updatedAtSql;
  }

  function saveStatusLocally(id, patch) {
    state.quotes = (state.quotes || []).map((quote) => quote.id === id ? { ...quote, ...patch } : quote);
    saveState();
    render();
  }

  async function updateQuoteWithUpdatedAtGuide(id, patch) {
    if (typeof sbIsConnected === "function" && sbIsConnected() && typeof sbRequest === "function" && typeof sbIsUuid === "function" && sbIsUuid(id) && patch.status) {
      try {
        await sbRequest(`quotes?id=eq.${id}`, { method: "PATCH", body: { status: patch.status } });
      } catch (error) {
        if (isUpdatedAtError(error)) {
          saveStatusLocally(id, patch);
          alert(explainUpdatedAtError() + " The quote was moved in this browser, but Supabase will not keep it online until the SQL is run.");
          return;
        }
        alert(`Could not update quote status in Supabase: ${error.message || "Please check Supabase and try again."}`);
        return;
      }
    }
    saveStatusLocally(id, patch);
  }

  window.wesetUpdatedAtFixSql = updatedAtSql;

  if (typeof updateQuote === "function") updateQuote = updateQuoteWithUpdatedAtGuide;

  if (typeof sbShowError === "function") {
    const oldShowError = sbShowError;
    sbShowError = function sbShowErrorWithUpdatedAtGuide(error) {
      if (isUpdatedAtError(error)) {
        alert(explainUpdatedAtError());
        return;
      }
      oldShowError(error);
    };
  }
})();
