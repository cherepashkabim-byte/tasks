const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
};

export const IconBack = () => (
  <svg {...base}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const IconCalendar = () => (
  <svg {...base}>
    <rect x="3.5" y="5" width="17" height="15" rx="4" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

export const IconFolder = () => (
  <svg {...base}>
    <path d="M3.5 8a3 3 0 0 1 3-3h3l2 2h6a3 3 0 0 1 3 3v6.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3z" />
  </svg>
);

export const IconFlame = () => (
  <svg {...base}>
    <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-2.6 1.4-4.6 3-6.2.4 1.7 1.3 2.8 2.4 3.3C10.6 8.3 12 5.2 14.6 3c.2 3 1.6 4.8 2.7 6.3 1 1.4 1.7 3 1.7 5.1 0 3.9-2.9 6.6-7 6.6z" />
    <path d="M12 21c-1.7 0-2.9-1.2-2.9-2.9 0-1.6 1-2.7 2.2-3.7.3 1 .9 1.6 1.6 1.8.2-1.2.7-2.2 1.4-2.9.6 1 1.6 2.2 1.6 3.9 0 2.1-1.6 3.8-3.9 3.8z" />
  </svg>
);

export const IconTag = () => (
  <svg {...base}>
    <path d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7l8.3 8.3a2 2 0 0 1 0 2.8l-5.9 5.9a2 2 0 0 1-2.8 0z" />
    <circle cx="8.5" cy="8.5" r="1.5" />
  </svg>
);

export const IconPlus = () => (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconCheck = () => (
  <svg {...base} stroke-width={3}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const IconChevron = () => (
  <svg {...base}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconClose = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconTrash = () => (
  <svg {...base}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

export const IconEdit = () => (
  <svg {...base}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" />
  </svg>
);

export const IconWarning = () => (
  <svg {...base}>
    <path d="M12 4l9 16H3l9-16zM12 10v4M12 17.5v.01" />
  </svg>
);
