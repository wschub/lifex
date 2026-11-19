/* Iconos SVG del prototipo (trazo 1.7, extremos redondos), copiados sin cambios de assets/js/app.js. */
export const ICONS = {
  plane:
    '<path d="M21 15.5v-1.6l-8-5V4.5a1.5 1.5 0 0 0-3 0v4.4l-8 5v1.6l8-2.3v4.4l-2 1.5V21l3.5-1 3.5 1v-1.4l-2-1.5v-4.4z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
  users:
    '<circle cx="9" cy="8.5" r="3.2"/><path d="M2.8 19.5c.6-3.4 3-5 6.2-5s5.6 1.6 6.2 5M16 5.5a3 3 0 0 1 0 6M18 14.8c2 .5 3.2 2 3.6 4.7"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  luggage:
    '<rect x="6" y="7" width="12" height="13" rx="2.5"/><path d="M9.5 7V4.5h5V7M9.5 11v5M14.5 11v5"/>',
  bag: '<path d="M6 8h12l1 12H5L6 8zM9 8V6.5a3 3 0 0 1 6 0V8"/>',
  seat: '<path d="M7 3.5h5a2.5 2.5 0 0 1 2.5 2.5v6.5H7V3.5zM7 12.5l-1.5 8M14.5 12.5 17 20.5M4.5 16h13"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.1"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16v.1"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  meal: '<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M17 21V3c-2 1.5-3 4-3 8h3"/>',
  wifi: '<path d="M3 9.5a14 14 0 0 1 18 0M6 13a9 9 0 0 1 12 0M9.2 16.3a4.5 4.5 0 0 1 5.6 0M12 19.5v.1"/>',
  refund: '<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4"/><path d="M12 8v4l2.5 1.5"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5z"/>',
  edit: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1zM14.5 6.5l3 3"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8H8M13 8l-3 8"/>',
  cabin: '<path d="M4 19V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v11M4 14h16M8 19v-5M16 19v-5"/>',
  crown: '<path d="M4 18.5h16M4.5 17 3.5 7.5l5 4 3.5-6 3.5 6 5-4-1 9.5"/>',
  wing: '<path d="M3 17c6 0 10-3 13-9-.5 5-4 10-13 9zM3 21c5 0 9-1.5 11-5"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>',
  heart:
    '<path d="M12 20s-7.5-4.6-7.5-10.2A4 4 0 0 1 12 7.8a4 4 0 0 1 7.5 2C19.5 15.4 12 20 12 20z"/>',
} as const;

export type IconName = keyof typeof ICONS;
