import { useRef } from "react";
import Icon from "./Icon.jsx";
export default function TravelDate({ value, onChange, label = "Travel date" }) {
  const input = useRef(null);
  return <div className="travel-date-control"><input ref={input} className="bp-input" aria-label={label} type="date" value={value} onChange={onChange} /><button type="button" aria-label={`Open calendar for ${label}`} title="Choose from calendar" onClick={() => { try { input.current.showPicker(); } catch { input.current.focus(); } }}><Icon name="calendar" size={20} /></button></div>;
}
