import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { directionsUrl, routeStops } from "./tripPlaces.js";

const cache = new Map();
const time = seconds => `${Math.round(seconds / 60)} min`;

export default function TripMap({ days, onFocusDay }) {
  const node = useRef(null);
  const map = useRef(null);
  const [driving, setDriving] = useState(false);
  const [driveNote, setDriveNote] = useState("");
  const [legs, setLegs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const stops = useMemo(() => routeStops(days), [days]);
  const key = stops.map(s => `${s.id}:${s.tripDay}`).join("|");
  useEffect(() => {
    map.current = L.map(node.current, { scrollWheelZoom: false }).setView([9.55, 80.0], 9);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' })
      .on("tileerror", () => setTilesFailed(true)).addTo(map.current);
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(node.current);
    return () => { observer.disconnect(); map.current.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    setDriving(false); setDriveNote("");
    setLegs([]);
    const pairs = stops.slice(1).map((to, i) => ({ from: stops[i], to }));
    const initial = pairs.map(p => ({ ...p, kind: p.from.island || p.to.island ? "ferry" : "pending" }));
    setLegs(initial);
    setLoading(pairs.some(p => !p.from.island && !p.to.island));
    const timer = setTimeout(() => controller.abort(), 12000);
    Promise.all(initial.map(async p => {
      if (p.kind === "ferry") return p;
      const id = `${p.from.id}:${p.to.id}`;
      if (cache.has(id)) return { ...p, ...cache.get(id) };
      try {
        const coords = `${p.from.lng},${p.from.lat};${p.to.lng},${p.to.lat}`;
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal: controller.signal });
        if (!res.ok) throw new Error("routing");
        const data = await res.json();
        const r = data.routes?.[0];
        if (data.code !== "Ok" || !r || data.waypoints?.some(w => w.distance > 3000)) throw new Error("no nearby road");
        const result = { kind: "road", geometry: r.geometry, distance: r.distance, duration: r.duration };
        cache.set(id, result);
        return { ...p, ...result };
      } catch { return { ...p, kind: "preview" }; }
    })).then(result => { if (live) { setLegs(result); setLoading(false); } }).finally(() => clearTimeout(timer));
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [key]);

  useEffect(() => {
    const layer = L.layerGroup().addTo(map.current);
    const grouped = new Map();
    stops.forEach((s, i) => { const group = grouped.get(s.id) || { ...s, visits: [] }; group.visits.push(i + 1); grouped.set(s.id, group); });
    grouped.forEach(s => {
      const badge = s.visits.join("·");
      const marker = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "route-pin", html: `<span>${badge}</span>`, iconSize: [34, 34] }) }).addTo(layer);
      const label = document.createElement("span"); label.textContent = `${s.name} · Day ${s.tripDay}`;
      marker.bindTooltip(label).on("click", () => onFocusDay(s.tripDay - 1));
    });
    legs.forEach(p => {
      if (p.kind === "road") L.geoJSON(p.geometry, { style: { color: "#fc6600", weight: 5, opacity: .85 } }).addTo(layer);
      else L.polyline([[p.from.lat, p.from.lng], [p.to.lat, p.to.lng]], { color: p.kind === "ferry" ? "#1688a1" : "#a39aaa", weight: 3, dashArray: "6 8" }).addTo(layer);
    });
    if (stops.length) map.current.fitBounds(L.latLngBounds(stops.map(s => [s.lat, s.lng])), { padding: [35, 35], maxZoom: 12 });
    return () => { if (map.current) map.current.removeLayer(layer); };
  }, [key, legs]);
  const driveRoads = [];
  for (const leg of legs) { if (leg.kind !== "road") break; driveRoads.push(leg); }
  useEffect(() => {
    if (!driving || !map.current || !driveRoads.length) return;
    let frame;
    const coords = driveRoads.flatMap(leg => leg.geometry.coordinates.map(([lng,lat]) => L.latLng(lat,lng)));
    const distances = [0];
    for (let i=1;i<coords.length;i++) distances.push(distances[i-1] + coords[i-1].distanceTo(coords[i]));
    const total = distances.at(-1);
    if (!total) { setDriving(false); return; }
    const jeep = L.marker(coords[0], { zIndexOffset:1000, keyboard:false, interactive:false, icon:L.divIcon({className:"route-jeep", iconSize:[58,42], iconAnchor:[29,21], html:'<svg class="jeep-body" width="58" height="42" viewBox="0 0 58 42" aria-hidden="true"><ellipse cx="29" cy="36" rx="24" ry="4" fill="#855331" opacity=".2"/><path d="M7 14h27l7 11h10v10H5V20z" fill="#fc6600" stroke="#fff8eb" stroke-width="2"/><path d="M11 15h10v10H9zM24 15h9l6 10H24z" fill="#d2edf0" stroke="#754990" stroke-width="1.3"/><path d="M12 12h22M22 14v19M8 28h39" stroke="#8c3b80" stroke-width="2"/><rect x="43" y="27" width="8" height="4" rx="1" fill="#fff1ba"/><rect x="2" y="28" width="5" height="6" rx="2" fill="#713589"/><circle cx="15" cy="34" r="7" fill="#713589" stroke="#fff8eb" stroke-width="2"/><circle cx="43" cy="34" r="7" fill="#713589" stroke="#fff8eb" stroke-width="2"/><circle cx="15" cy="34" r="3" fill="#edc7f4"/><circle cx="43" cy="34" r="3" fill="#edc7f4"/><path d="M26 29h4" stroke="#fff2da" stroke-width="2"/></svg>'}) }).addTo(map.current);
    let started;
    function tick(now) {
      started ??= now;
      const progress = Math.min(1,(now-started)/Math.min(30000,Math.max(8000,driveRoads.length*8000)));
      const target = progress*total;
      let i=1; while(i<distances.length-1 && distances[i]<target) i++;
      const fraction = (target-distances[i-1]) / (distances[i]-distances[i-1] || 1);
      const a=coords[i-1], b=coords[i];
      jeep.setLatLng([a.lat+(b.lat-a.lat)*fraction,a.lng+(b.lng-a.lng)*fraction]);
      const svg=jeep.getElement()?.querySelector("svg"); if(svg) svg.style.transform=b.lng<a.lng?"scaleX(-1)":"scaleX(1)";
      if(progress<1) frame=requestAnimationFrame(tick);
      else { setDriving(false); setDriveNote(legs[driveRoads.length]?.kind === "ferry" ? "Ferry connection ahead — jeep stops here." : legs.length>driveRoads.length ? "Road preview stops where routing is unavailable." : "Road preview complete."); }
    }
    frame=requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); if(map.current) map.current.removeLayer(jeep); };
  }, [driving, legs, key]);
  const roads = legs.filter(p => p.kind === "road");
  const url = stops.length <= 5 ? directionsUrl(stops) : null;
  return <section className="route-card">
    <div className="route-heading"><h3>Your route</h3>{url && <a href={url} target="_blank" rel="noreferrer">Open in Maps</a>}</div>
    <div className="trip-map" ref={node} role="region" aria-label="Selected trip stops on map" />
    {!days.length && <p className="route-caption">Add a day to plot your route.</p>}
    {!!days.length && <>
      <div className="route-stats"><span>{stops.length} stops</span><span>🚗 {roads.length ? `${Math.round(roads.reduce((n, p) => n + p.distance, 0) / 1000)} km by road` : loading ? "Finding roads…" : stops.length <= 1 ? "Local stay" : "No road estimate"}</span>{stops.some(s => s.island) && <span>⛴ Island transfer</span>}</div>
      <div className="route-drive"><button type="button" disabled={!driveRoads.length || loading} onClick={() => { setDriveNote(""); setDriving(v => !v); }}>{driving ? "Stop jeep" : "Preview drive"}</button><small>Jeep animation · road preview</small></div>
      {driveNote && <p className="route-caption" role="status">{driveNote}</p>}
      <p className="route-caption">{loading ? "Finding roads…" : "Area pins · travel times exclude traffic and visits"}{tilesFailed && " · Map tiles unavailable"}</p>
      {days.some(d => !d.places?.length) && <p className="route-warning">Some days have no mapped place.</p>}
      <details className="route-legs"><summary>Route details · {legs.length}</summary>{legs.map((p, i) => <div key={i}><span>{p.from.name} – {p.to.name}</span><strong>{p.kind === "road" ? `${Math.round(p.distance / 1000)} km · ${time(p.duration)}` : p.kind === "ferry" ? "Ferry / boat · confirm connection" : p.kind === "pending" ? "Finding route…" : "Road route unavailable"}</strong>{p.duration > 7200 && <small className="route-warning">Long transfer — consider changing day order.</small>}<a href={directionsUrl([p.from, p.to])} target="_blank" rel="noreferrer">View route ↗</a></div>)}</details>
      {stops.some(s => s.island) && <p className="route-warning">Ferry / boat connection needs confirmation.</p>}
      {legs.some(p => p.kind === "preview") && <p className="route-caption">Grey dotted lines show stop order, not roads.</p>}
    </>}
  </section>;
}
