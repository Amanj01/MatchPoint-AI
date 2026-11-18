/** MatchPoint mark: an "M" whose middle point lands on a red dot, the match point. Same drawing as app/icon.svg (favicon). */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#111111" />
      <path d="M8 23V9l8 9 8-9v14" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="18" r="3.2" fill="#e2231a" />
    </svg>
  );
}
