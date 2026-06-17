(() => {
  const seedFlag = "weset.supabase.itemsSeedFixed";

  function starterItems() {
    if (typeof catalog === "undefined" || !Array.isArray(catalog)) return [];
    return catalog.map((item) => ({
      name: item.name,
      category: item.category,
      unit_cost: Number(item.unitCost || 0),
      unit: item.unit || "each",
      default_quantity: Number(item.defaultQuantity || 1),
      supplier: item.supplier || "",
      product_code: item.code || item.id,
      lead_time: item.leadTime || "",
      description: item.description || ""
    }));
  }

  function itemFromRow(row) {
    if (typeof sbItemFromRow === "function") return sbItemFromRow(row);
    return {
      id: row.id,
      name: row.name || "",
      category: row.category || "Custom",
      unitCost: Number(row.unit_cost || 0),
      unit: row.unit || "each",
      defaultQuantity: Number(row.default_quantity || 1),
      supplier: row.supplier || "",
      code: row.product_code || "",
      leadTime: row.lead_time || "",
      description: row.description || ""
    };
  }

  async function seedItemsIfMissing(showSuccess = false) {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return;
    const seedRows = starterItems();
    if (!seedRows.length) return;

    try {
      const existing = await sbRequest("items?select=*&order=created_at.asc");
      if (existing.length) {
        state.catalog = existing.map(itemFromRow);
        if (typeof saveState === "function") saveState();
        if (typeof renderItems === "function") renderItems();
        localStorage.setItem(seedFlag, "true");
        return;
      }

      const inserted = await sbRequest("items", { method: "POST", body: seedRows });
      state.catalog = inserted.map(itemFromRow);
      if (typeof saveState === "function") saveState();
      if (typeof render === "function") render();
      localStorage.setItem(seedFlag, "true");
      if (showSuccess) alert("Items have been added to Supabase.");
    } catch (error) {
      alert(`Items are not saving to Supabase yet: ${error.message || "check your items table and RLS policies."}`);
    }
  }

  const oldSbLoadAll = typeof sbLoadAll === "function" ? sbLoadAll : null;
  if (oldSbLoadAll) {
    sbLoadAll = async function sbLoadAllWithItemSeed() {
      await oldSbLoadAll();
      await seedItemsIfMissing(false);
    };
  }

  window.wesetSeedItemsToSupabase = () => seedItemsIfMissing(true);
  setTimeout(() => seedItemsIfMissing(false), 1200);
})();
