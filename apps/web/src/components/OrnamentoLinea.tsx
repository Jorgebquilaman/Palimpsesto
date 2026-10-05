export function OrnamentoLinea({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 80"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="ornamento-degradado" x1="0" y1="40" x2="220" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.7" />
          <stop offset="0.65" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M2 44
           C 18 44, 26 22, 42 22
           C 58 22, 58 52, 74 52
           C 90 52, 90 30, 106 30
           C 118 30, 120 44, 132 40
           C 148 35, 152 18, 168 18
           C 184 18, 190 30, 218 26"
        stroke="url(#ornamento-degradado)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
