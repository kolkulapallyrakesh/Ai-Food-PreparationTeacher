export function fmt(n) {
  if (!n) return "";
  const r = Math.round(n * 4) / 4, w = Math.floor(r), f = r - w;
  const frac = { 0.25: "¼", 0.5: "½", 0.75: "¾" }[f] || "";
  return (w ? String(w) : "") + frac || String(+n.toFixed(2));
}
export const ingLine = (i, servings, base) =>
  [i.qty ? fmt((i.qty * servings) / base) : "", i.unit, i.name].filter(Boolean).join(" ");

export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
};
