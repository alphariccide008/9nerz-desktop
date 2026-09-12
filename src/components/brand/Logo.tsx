/** Org-chart-ring mark, ported 1:1 from mobile's components/brand/Logo.tsx (react-native-svg → plain SVG). */
export function LogoMark({ size = 40 }: { size?: number }) {
  const r = size * 0.22;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <linearGradient id="nerzbg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#202B4E" />
          <stop offset="100%" stopColor="#1F7A66" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="200" height="200" rx={(r / size) * 200} fill="url(#nerzbg)" />
      <circle cx="100" cy="80" r="32" fill="none" stroke="#FFFFFF" strokeWidth="16" />
      <path d="M 126 98 C 129 120, 119 144, 96 152" fill="none" stroke="#FFFFFF" strokeWidth="16" strokeLinecap="round" />
      <circle cx="72" cy="62" r="9" fill="#F2A93B" />
      <circle cx="128" cy="62" r="9" fill="#F2A93B" />
      <circle cx="100" cy="112" r="9" fill="#F2A93B" />
    </svg>
  );
}

export function Wordmark({ size = 40, tone = "ink" }: { size?: number; tone?: "ink" | "white" }) {
  const fontSize = Math.round(size * 0.62);
  return (
    <div className="flex flex-row items-center" style={{ gap: size * 0.28 }}>
      <LogoMark size={size} />
      <span
        className="font-display"
        style={{
          fontSize,
          lineHeight: `${Math.round(fontSize * 1.15)}px`,
          letterSpacing: 0.3,
          color: tone === "white" ? "#FFFFFF" : "#202B4E",
        }}
      >
        9nerz
      </span>
    </div>
  );
}
