interface IconProps { className?: string }

const base = (className?: string) => ({
  className,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
});

/** Chevron-bracket mark with a + + spark */
export function LogoMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="#121C2E" stroke="#263A5C" />
      <path d="M10 10.5 5.5 16 10 21.5" stroke="#45D4BE" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 21.5 19 16l-4.5-5.5" stroke="#8AB8EF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M23.5 12v5M21 14.5h5" stroke="#FFBE62" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M27 18.5v3M25.5 20h3" stroke="#FFBE62" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}

export function IconPlay({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M7 5.2v13.6c0 .9 1 1.5 1.8 1L19.6 13a1.2 1.2 0 0 0 0-2L8.8 4.2c-.8-.5-1.8.1-1.8 1Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSpinner({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function IconWarn({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 4 2.8 19.2c-.4.7.1 1.8 1 1.8h16.4c.9 0 1.4-1.1 1-1.8L12 4Z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.6" r="0.4" fill="currentColor" />
    </svg>
  );
}

export function IconError({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  );
}

export function IconTerminal({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="m7 9.5 3.5 2.8L7 15" />
      <path d="M12.5 15.5H17" />
    </svg>
  );
}

export function IconEraser({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m8.5 19 -4-4a1.6 1.6 0 0 1 0-2.3l8.2-8.2a1.6 1.6 0 0 1 2.3 0l4.5 4.5a1.6 1.6 0 0 1 0 2.3L12 19" />
      <path d="M8.5 19H20" />
      <path d="m7 10.5 6.5 6.5" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconChevron({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function IconCode({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
      <path d="m13.5 4.5-3 15" />
    </svg>
  );
}

export function IconPanel({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M9.5 4.5v15" />
    </svg>
  );
}

export function IconBolt({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M13 3 5 13.5h5L11 21l8-10.5h-5L13 3Z" />
    </svg>
  );
}
