interface Props {
  className?: string;
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const HomeIcon = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);

export const FolderIcon = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const CheckCircleIcon = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.3 12.2l2.6 2.6 4.8-5.2" />
  </svg>
);

export const ClockIcon = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.2 2" />
  </svg>
);

export const BarsIcon = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 20V11" />
    <path d="M10 20V4" />
    <path d="M16 20v-6" />
    <path d="M21 20H3" />
  </svg>
);

export const TrendIcon = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 16l5.5-5.5 3.5 3.5L21 5" />
    <path d="M15 5h6v6" />
  </svg>
);

export const BulbIcon = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 1 3.6 10.8c-.6.5-.9 1.1-.9 1.7H9.3c0-.6-.3-1.2-.9-1.7A6 6 0 0 1 12 3z" />
  </svg>
);

export const WarnTriangleIcon = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

export const BoltIcon = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </svg>
);

export const AlertCircleIcon = (p: Props) => (
  <svg {...base} {...p} strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5" />
    <path d="M12 16.3h.01" />
  </svg>
);

export const ArrowRightIcon = (p: Props) => (
  <svg {...base} {...p} strokeWidth={2}>
    <path d="M5 12h13" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

export const ChevronDownIcon = (p: Props) => (
  <svg {...base} {...p} strokeWidth={2.2}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const RefreshIcon = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 4v5h-5" />
  </svg>
);

export const AlpagoMark = (p: Props) => (
  <svg viewBox="0 0 48 48" fill="none" {...p}>
    <path d="M24 5 L41 42 M24 5 L7 42" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M24 14 L34 36 M24 14 L14 36" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M15.5 33 H32.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
