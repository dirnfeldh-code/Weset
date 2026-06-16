(() => {
  if (typeof window.className !== "function") {
    window.className = (value) => typeof cls === "function" ? cls(value) : String(value || "").replaceAll(" ", "-");
  }

  if (typeof window.formatMoney !== "function") {
    window.formatMoney = (value) => typeof money === "function"
      ? money(value)
      : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value || 0);
  }

  if (typeof window.formatDate !== "function") {
    window.formatDate = (value) => typeof date === "function"
      ? date(value)
      : value
        ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`))
        : "No date";
  }
})();
