(() => {
  const params = new URLSearchParams(location.search);
  const shouldClear = params.get("clearLocal") === "1" || params.get("clearData") === "1";
  if (!shouldClear) return;

  const appStateKey = "we-set-office-console";
  const sessionKeyName = "we-set-session";
  const session = localStorage.getItem(sessionKeyName);
  const emptyState = {
    users: [],
    catalog: [],
    clients: [],
    quotes: [],
    expenses: []
  };

  const keysToRemove = [
    "weset.invoices",
    "weset.expense.categories",
    "weset.vat.payments",
    "weset.quote.vat.settings",
    "weset.document.overrides",
    "weset.quote.document.overrides",
    "weset.invoice.document.overrides",
    "weset.supabase.itemsSeeded",
    "weset.supabase.itemsSeedFixed"
  ];

  localStorage.setItem(appStateKey, JSON.stringify(emptyState));
  keysToRemove.forEach((key) => localStorage.removeItem(key));
  if (params.get("clearCompany") === "1") localStorage.removeItem("weset.company.details");
  if (session) localStorage.setItem(sessionKeyName, session);

  const cleanUrl = new URL(location.href);
  cleanUrl.searchParams.delete("clearLocal");
  cleanUrl.searchParams.delete("clearData");
  cleanUrl.searchParams.delete("clearCompany");
  cleanUrl.searchParams.set("cache", "20260619-clear-local1");
  sessionStorage.setItem("weset.clearLocalNotice", "1");
  location.replace(cleanUrl.toString());
})();
