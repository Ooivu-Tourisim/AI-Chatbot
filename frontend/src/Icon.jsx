// Eva Icons (outline set), inlined so they inherit text color via currentColor.
const files = import.meta.glob(
  [
    "/node_modules/eva-icons/outline/svg/compass-outline.svg",
    "/node_modules/eva-icons/outline/svg/credit-card-outline.svg",
    "/node_modules/eva-icons/outline/svg/briefcase-outline.svg",
    "/node_modules/eva-icons/outline/svg/message-circle-outline.svg",
    "/node_modules/eva-icons/outline/svg/arrow-back-outline.svg",
    "/node_modules/eva-icons/outline/svg/arrow-forward-outline.svg",
    "/node_modules/eva-icons/outline/svg/plus-outline.svg",
    "/node_modules/eva-icons/outline/svg/close-outline.svg",
    "/node_modules/eva-icons/outline/svg/map-outline.svg",
    "/node_modules/eva-icons/outline/svg/chevron-down-outline.svg",
    "/node_modules/eva-icons/outline/svg/swap-outline.svg",
    "/node_modules/eva-icons/outline/svg/arrow-upward-outline.svg",
    "/node_modules/eva-icons/outline/svg/flash-outline.svg",
    "/node_modules/eva-icons/outline/svg/globe-outline.svg",
  ],
  { query: "?raw", import: "default", eager: true }
);

const ICONS = {};
ICONS.mic = '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></g>';
ICONS.sound = '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/></g>';
ICONS.settings = '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h4M12 7h8M4 17h8M16 17h4"/><circle cx="10" cy="7" r="2"/><circle cx="14" cy="17" r="2"/></g>';
ICONS.travelers = '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 5v3"/></g>';
for (const [path, svg] of Object.entries(files)) {
  const name = path.split("/").pop().replace("-outline.svg", "");
  ICONS[name] = svg.replace(/<svg[^>]*>/, "").replace("</svg>", "");
}

ICONS.rocket = '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15c-2-4 2-10 11-11 0 9-6 13-10 11zM9 8H5l-3 5 6-1M16 15v4l-5 3 1-6M6 16c-2 0-3 2-3 5 3 0 5-1 5-3"/><circle cx="15" cy="9" r="2"/></g>';

ICONS["paper-plane"] = '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/></g>';

const PREMIUM_PATHS = {
  heritage: '<path d="m3 9 9-6 9 6H3ZM5 10v9M10 10v9M14 10v9M19 10v9M3 21h18"/>',
  island: '<path d="M3 21h18M5 18h14M12 18V8M12 8c-4-4-8-2-9 1 4-1 6 0 9-1ZM12 8c3-5 7-4 9-1-4-1-6 0-9 1ZM12 8c2-2 6 0 6 4-2-3-4-3-6-4"/>',
  food: '<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 3c-4 2-5 8-2 10h2M20 3v18"/>',
  wellness: '<path d="M12 21c-6 0-10-4-10-9 5 0 8 2 10 6 2-4 5-6 10-6 0 5-4 9-10 9ZM12 18c-5-5-4-10 0-15 4 5 5 10 0 15"/>',
  wildlife: '<path d="M3 19c6-2 8-6 9-12 5 0 8 3 9 7l-5 1-4 6M12 7l3-4 3 4M4 8l4 4M2 11l5 3"/><circle cx="16" cy="10" r=".7"/>',
  romance: '<path d="M20 4c-3-2-6-1-8 2-2-3-5-4-8-2-4 3-1 9 8 16 9-7 12-13 8-16Z"/>',
  bed: '<path d="M3 18V6M21 18v-7a2 2 0 0 0-2-2h-7v7M3 16h18M3 11h9M3 19v2M21 19v2"/><rect x="5" y="8" width="5" height="3" rx="1"/>',
  vehicle: '<rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 11h16M8 19v2M16 19v2M7 15h2M15 15h2"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 3v4M18 5h4"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/>',
  guide: '<circle cx="12" cy="6" r="3"/><path d="M6 21v-4a6 6 0 0 1 12 0v4M12 12v5"/>'
};
for (const [name, paths] of Object.entries(PREMIUM_PATHS)) ICONS[name] = `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;

ICONS["assistant-bubble"] = '<g fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path fill="#f7effc" stroke="#76229a" d="M20 12a8 8 0 0 1-8 8H4l1-4a8 8 0 1 1 15-4Z"/><path fill="#f4a34f" stroke="#e48024" d="m12 6 1.5 4.5L18 12l-4.5 1.5L12 18l-1.5-4.5L6 12l4.5-1.5L12 6Z"/></g>';

ICONS.calendar = '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M7 17h2M12 17h2"/></g>';

export default function Icon({ name, size = 20, className = "" }) {
  return (
    <svg
      className={`aura-eva ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[name] || "" }}
    />
  );
}
