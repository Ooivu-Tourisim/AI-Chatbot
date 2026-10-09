import { plannerText } from "./plannerI18n.js";
const colors = ["#6c2389", "#d98a55", "#1688a1", "#89a657", "#bb83ce"];
export default function PriceChart({ quote, fmt, lang = "en" }) {
  if (!quote) return null;
  const positive = quote.lines.filter(l => l.amount_lkr > 0);
  const total = positive.reduce((n, l) => n + l.amount_lkr, 0);
  let start = 0;
  return <div className="price-chart"><svg viewBox="0 0 100 12" role="img" aria-label={plannerText(lang, "Estimated price breakdown")}><title>{quote.lines.map(l => `${plannerText(lang, l.label)}: ${fmt(l.amount_lkr)}`).join("; ")}</title>{positive.map((l, i) => { const width = l.amount_lkr / total * 100; const x = start; start += width; return <rect key={i} x={x} y="0" width={width} height="12" fill={colors[i % colors.length]} />; })}</svg><div className="chart-key">{quote.lines.map((l, i) => <div key={i}><span><i style={{background:l.amount_lkr < 0 ? "#4c8c59" : colors[positive.indexOf(l) % colors.length]}} />{l.kind === "base" ? plannerText(lang, "Experiences") : plannerText(lang, l.label)}</span><b>{fmt(l.amount_lkr)}</b></div>)}</div></div>;
}
