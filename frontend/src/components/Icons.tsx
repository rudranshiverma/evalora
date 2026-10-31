import type { ReactNode } from "react";

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icon"
    >
      {children}
    </svg>
  );
}

export const DocIcon = () => (
  <Svg>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Svg>
);

export const ListIcon = () => (
  <Svg>
    <path d="M10 6h11M10 12h11M10 18h11" />
    <path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />
  </Svg>
);

export const ChartIcon = () => (
  <Svg>
    <path d="M4 20v-9M10 20V5M16 20v-6M21 20H3" />
  </Svg>
);

export const UsersIcon = () => (
  <Svg>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);

export const UploadIcon = () => (
  <Svg>
    <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
  </Svg>
);

export const DownloadIcon = () => (
  <Svg>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Svg>
);

export const FolderIcon = () => (
  <Svg>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
);

export const ClockIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const TargetIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </Svg>
);

export const CheckCircleIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </Svg>
);

export const XCircleIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="m15 9-6 6M9 9l6 6" />
  </Svg>
);

export const AlertIcon = () => (
  <Svg>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </Svg>
);

export const InfoIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);

export const RefreshIcon = () => (
  <Svg>
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
  </Svg>
);

export const PlusIcon = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const XIcon = () => (
  <Svg>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);

export const CheckIcon = () => (
  <Svg size={15}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const ChevronRightIcon = () => (
  <Svg>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <span className={`chevron ${open ? "chevron--open" : ""}`}>
      <Svg>
        <path d="m6 9 6 6 6-6" />
      </Svg>
    </span>
  );
}