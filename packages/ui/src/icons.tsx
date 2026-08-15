interface IconProps {
  path: string;
  size?: number;
  className?: string;
}

/** Generic outline-icon renderer — every icon in the design system is one `d` path on a
 * 24x24 viewBox, ported from the mockup's inline SVGs. */
export function Icon({ path, size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

export const ICON_PATHS = {
  search: "M11 3a8 8 0 105.29 14.29L21 22M11 3a8 8 0 018 8",
  collapseMenu: "M4 5h16M4 12h10M4 19h16",
  themeSun: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4",
  close: "M6 6l12 12M18 6L6 18",
  sparkle: "M12 3l2 5.5L19.5 11 14 13 12 19 10 13 4.5 11 10 8.5z",
  send: "M5 12h13M12 5l7 7-7 7",
  check: "M4 12l5 5L20 6",
  chevronUpDown: "M8 10l4-4 4 4M8 14l4 4 4-4",
  construction: "M4 21h16M6 21V9l6-6 6 6v12M10 21v-6h4v6",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z",
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
} as const;
