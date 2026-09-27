(() => {
  const originalFetch = window.fetch.bind(window);

  function applyPatch(data, patch) {
    const replacements = patch?.replaceByCode || {};

    for (const category of data.categories || []) {
      const groups = [category.rules || []];
      for (const sub of category.subcategories || []) groups.push(sub.rules || []);

      for (const rules of groups) {
        for (const rule of rules) {
          const replacement = replacements[String(rule.code || "")];
          if (replacement) Object.assign(rule, replacement);
        }
      }
    }

    for (const [categoryId, subcategories] of Object.entries(patch?.addSubcategories || {})) {
      const category = (data.categories || []).find(item => item.id === categoryId);
      if (!category) continue;
      if (!Array.isArray(category.subcategories)) category.subcategories = [];

      for (const incoming of subcategories || []) {
        const index = category.subcategories.findIndex(item => item.id === incoming.id);
        if (index >= 0) category.subcategories[index] = incoming;
        else category.subcategories.push(incoming);
      }
    }

    if (patch?.update) {
      if (!Array.isArray(data.updates)) data.updates = [];
      const exists = data.updates.some(item => item.title === patch.update.title && item.date === patch.update.date);
      if (!exists) data.updates.unshift(patch.update);
    }

    return data;
  }

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const isRules =
      url === "./content/rules.json" ||
      url === "content/rules.json" ||
      /\/content\/rules\.json(?:\?|$)/.test(url);

    if (!isRules) return originalFetch(input, init);

    const [rulesResponse, patchResponse] = await Promise.all([
      originalFetch("./rules.json", init),
      originalFetch("./content/rules-patch.json", { cache: "no-store" })
    ]);

    if (!rulesResponse.ok) return rulesResponse;

    const data = await rulesResponse.json();
    if (patchResponse.ok) {
      try {
        applyPatch(data, await patchResponse.json());
      } catch (error) {
        console.warn("Não foi possível aplicar o patch de regras:", error);
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  };
})();
