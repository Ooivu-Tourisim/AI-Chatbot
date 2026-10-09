import { useCallback, useEffect, useState } from "react";

// Package text (titles, itinerary, inclusions...) lives in English in the database.
// For any other language the backend translates it (cached there); `localize` overlays the
// translation for display only. Ids, day numbers and prices always come from the original.
export default function usePackageText(apiBase, language, ids) {
  const [state, setState] = useState({ language: "", map: {} });
  const key = (ids || []).filter(Boolean).join(",");
  const english = !language || /^(english|en)$/i.test(language);

  useEffect(() => {
    if (english || !key) return;
    const controller = new AbortController();
    fetch(`${apiBase}/api/translate/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, package_ids: key.split(",") }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((map) => setState({ language, map }))
      .catch(() => {});
    return () => controller.abort();
  }, [apiBase, language, key, english]);

  const localize = useCallback((pkg) => {
    const tr = !english && state.language === language ? state.map[pkg?.id] : null;
    if (!tr) return pkg;
    const days = new Map((tr.itinerary || []).map((d) => [d.day, d]));
    return {
      ...pkg, ...tr,
      itinerary: pkg.itinerary.map((d) => ({ ...d, title: days.get(d.day)?.title || d.title, activities: days.get(d.day)?.activities || d.activities })),
    };
  }, [english, language, state]);

  return localize;
}
