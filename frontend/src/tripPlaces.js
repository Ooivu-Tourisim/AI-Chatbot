// Representative area pins, not hotel/park entrances. Coordinate provenance:
// https://en.wikipedia.org/wiki/{Jaffna,Neduntheevu,Nainativu,Karainagar,
// Keerimalai,Point_Pedro,Chunnakam,Valvettithurai,Mannar,_Sri_Lanka,
// Talaimannar,Chundikkulam_National_Park,Vankalai,Nallur_Kandaswamy_temple}
export const PLACES = [
  // RDA project map: 9°36'2.52"N, 79°47'23.80"E
  // https://rda.gov.lk/rda_project_new/uploads/procurement/791/attchment_202508140920_Draft_bidding_document1755164600.pdf
  { id: "jetty", name: "Kurikadduwan jetty", lat: 9.6007, lng: 79.78994, words: ["kurikadduwan", "kkd jetty"] },
  { id: "jaffna", name: "Jaffna", lat: 9.66472, lng: 80.01667, words: ["jaffna"] },
  { id: "nallur", name: "Nallur", lat: 9.6745, lng: 80.0293, words: ["nallur", "sangilean", "sangiliyan", "yamuna"] },
  { id: "pedro", name: "Point Pedro", lat: 9.81667, lng: 80.23333, words: ["point pedro"] },
  { id: "keerimalai", name: "Keerimalai", lat: 9.81667, lng: 80, words: ["keerimalai"] },
  { id: "karainagar", name: "Karainagar / Casuarina area", lat: 9.73333, lng: 79.86667, words: ["karainagar", "casuarina"] },
  { id: "delft", name: "Delft Island", lat: 9.51667, lng: 79.68333, words: ["delft", "neduntheevu"], island: true },
  { id: "nainativu", name: "Nainativu", lat: 9.6, lng: 79.76667, words: ["nainativu", "nagadeepa"], island: true },
  { id: "chunnakam", name: "Chunnakam", lat: 9.75, lng: 80.017, words: ["chunnakam"] },
  { id: "valvai", name: "Valvettithurai", lat: 9.81667, lng: 80.16667, words: ["valvettithurai"] },
  { id: "chundikulam", name: "Chundikulam area", lat: 9.49861, lng: 80.50694, words: ["chundikulam", "chundikkulam"] },
  { id: "mannar", name: "Mannar", lat: 8.967, lng: 79.883, words: ["mannar"] },
  { id: "talaimannar", name: "Talaimannar", lat: 9.1, lng: 79.71667, words: ["talaimannar", "adam's bridge"] },
  { id: "vankalai", name: "Vankalai area", lat: 8.883, lng: 79.933, words: ["vankalai"] },
];

function mentions(text) {
  // Regional food names are not extra geographic stops.
  const lower = text.toLowerCase().replace(/jaffna\s+(curry|chili|crab|spice|cuisine)/g, "$1");
  return PLACES.map(p => {
    const positions = p.words.map(w => {
      const match = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").exec(lower);
      return match ? match.index : Infinity;
    });
    return { ...p, position: Math.min(...positions) };
  }).filter(p => Number.isFinite(p.position)).sort((a, b) => a.position - b.position);
}

export function dayPlaces(day, pkg) {
  const explicit = mentions(day.activities || "");
  const departure = /^(.*?)\s+to\s+/i.exec(day.title || "");
  if (departure) {
    for (const origin of mentions(departure[1]).reverse()) if (explicit[0]?.id !== origin.id) explicit.unshift(origin);
  }
  if (explicit.length) return explicit;
  const title = mentions(day.title || "");
  if (title.length) return title;
  // A day without a named stop uses its package's region, clearly marked.
  return mentions((pkg?.destinations || []).join(" · ")).slice(0, 1).map(p => ({ ...p, approximate: true }));
}

export function routeStops(days) {
  const stops = [];
  days.forEach((day, i) => (day.places || []).forEach(place => {
    if (stops.at(-1)?.id === place.id) return;
    stops.push({ ...place, tripDay: i + 1 });
  }));
  return stops;
}

export function directionsUrl(stops) {
  if (!stops.length) return null;
  if (stops.length === 1) return `https://www.google.com/maps/search/?api=1&query=${stops[0].lat},${stops[0].lng}`;
  const params = new URLSearchParams({ api: "1", origin: `${stops[0].lat},${stops[0].lng}`, destination: `${stops.at(-1).lat},${stops.at(-1).lng}` });
  // Per-leg links in the map UI support long trips without dropping stops.
  if (stops.length > 2) params.set("waypoints", stops.slice(1, -1).map(s => `${s.lat},${s.lng}`).join("|"));
  if (!stops.some(s => s.island)) params.set("travelmode", "driving");
  return `https://www.google.com/maps/dir/?${params}`;
}

// Group nearby mapped days, keeping the first day and a final departure fixed.
// This is a geographical suggestion; ferry times and bookings still need review.
export function groupNearbyDays(days) {
  if (days.length < 3) return [...days];
  const distance = (a, b) => {
    const rad = Math.PI / 180;
    const dlat = (b.lat-a.lat)*rad, dlng = (b.lng-a.lng)*rad;
    const x = Math.sin(dlat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlng/2)**2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1,x)));
  };
  const mapped = days.map((day,index)=>({day,index,place:day.places?.[0]})).filter(x=>x.place);
  if (mapped.length < 3) return [...days];
  const departure = /departure|departures|farewell|return/i.test(days.at(-1).title || "") ? mapped.find(x=>x.index===days.length-1) : null;
  const first = mapped[0];
  let remaining = mapped.filter(x=>x!==first && x!==departure);
  const sorted = [first];
  while (remaining.length) {
    const previous = sorted.at(-1);
    const nearby = remaining.filter(x=> (previous.place.island || x.place.island) ? previous.place.id === x.place.id : distance(previous.place,x.place) <= 15);
    const pool = nearby.length ? nearby : remaining;
    const best = pool.reduce((a,b)=>distance(previous.place,a.place)<=distance(previous.place,b.place)?a:b);
    sorted.push(best); remaining = remaining.filter(x=>x!==best);
  }
  if (departure && departure!==first) sorted.push(departure);
  const result = [...days];
  mapped.forEach((x,index)=> { result[x.index] = sorted[index].day; });
  return result;
}
