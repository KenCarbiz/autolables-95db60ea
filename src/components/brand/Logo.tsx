interface LogoProps {
  variant?: "mark" | "full" | "stacked" | "wordmark";
  inverted?: boolean;
  size?: number;
  className?: string;
}

/**
 * AutoLabels.io Logo Component
 *
 * Variants:
 * - mark     — just the square mark (default)
 * - full     — mark + "autolabels.io" horizontal
 * - stacked  — mark on top, wordmark below
 * - wordmark — text only, no mark
 *
 * `inverted` flips colors for dark backgrounds.
 * `size` sets the height of the logo in px (proportions maintained).
 */
const Logo = ({ variant = "mark", inverted = false, size = 32, className }: LogoProps) => {
  const gradId = `acGrad-${inverted ? "inv" : "norm"}-${Math.random().toString(36).slice(2, 7)}`;
  const stroke = inverted ? "#FFFFFF" : "#FFFFFF";
  const wordColor = inverted ? "#FFFFFF" : "#0B2041";
  const ioColor = inverted ? "#60A5FA" : "#2563EB";

  // Just the square mark
  const MarkSquare = () => (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          {inverted ? (
            <>
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#FFFFFF" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#0B2041" />
            </>
          )}
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${gradId})`} />
      <path
        d="M 18 48 L 32 16 L 46 48"
        stroke={inverted ? "#0B2041" : stroke}
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="24"
        y1="38"
        x2="40"
        y2="38"
        stroke={inverted ? "#0B2041" : stroke}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="16" r="3.5" fill={inverted ? "#0B2041" : stroke} />
    </g>
  );

  if (variant === "mark") {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className={className}>
        <MarkSquare />
      </svg>
    );
  }

  if (variant === "wordmark") {
    return (
      <svg width={size * 4.5} height={size} viewBox="0 0 160 32" xmlns="http://www.w3.org/2000/svg" className={className}>
        <text x="0" y="24" fontFamily="Inter, system-ui, sans-serif" fontSize="20" fontWeight="800" fill={wordColor} letterSpacing="-0.02em">
          autolabels
        </text>
        <text x="115" y="24" fontFamily="Inter, system-ui, sans-serif" fontSize="20" fontWeight="500" fill={ioColor} letterSpacing="-0.01em">
          .io
        </text>
      </svg>
    );
  }

  if (variant === "stacked") {
    return (
      <svg width={size * 2.5} height={size * 1.7} viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg" className={className}>
        <g transform="translate(48 0)">
          <MarkSquare />
        </g>
        <text x="80" y="100" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize="16" fontWeight="800" fill={wordColor} letterSpacing="-0.02em">
          autolabels<tspan fill={ioColor} fontWeight="500">.io</tspan>
        </text>
      </svg>
    );
  }

  // full
  return (
    <svg width={size * 3.75} height={size} viewBox="0 0 240 64" xmlns="http://www.w3.org/2000/svg" className={className}>
      <MarkSquare />
      <text x="80" y="42" fontFamily="Inter, system-ui, sans-serif" fontSize="24" fontWeight="800" fill={wordColor} letterSpacing="-0.02em">
        autolabels
      </text>
      <text x="210" y="42" fontFamily="Inter, system-ui, sans-serif" fontSize="24" fontWeight="500" fill={ioColor} letterSpacing="-0.01em">
        .io
      </text>
    </svg>
  );
};

export default Logo;
