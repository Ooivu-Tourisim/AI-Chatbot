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
for (const [path, svg] of Object.entries(files)) {
  const name = path.split("/").pop().replace("-outline.svg", "");
  ICONS[name] = svg.replace(/<svg[^>]*>/, "").replace("</svg>", "");
}

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
