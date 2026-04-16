interface LogoProps {
  variant?: "mark" | "full" | "stacked" | "wordmark";
  inverted?: boolean;
  size?: number;
  className?: string;
  /**
   * Show the "CLEAR. COMPLIANT. CONSISTENT." tagline beneath the wordmark.
   * Only applies to `full` and `stacked` variants.
   */
  tagline?: boolean;
}

/**
 * AutoLabels.io Logo
 *
 * Brand identity: a vivid blue price tag with a white "$" mark, a small
 * ring hole at the top, and a checkmark indicating "compliant / approved".
 * The wordmark splits the name — gunmetal "Auto" + signal-blue "Labels.io" —
 * mirroring the master logo.
 */
const Logo = ({
  variant = "mark",
  inverted = false,
  size = 32,
  className,
  tagline = false,
}: LogoProps) => {
  const uid = Math.random().toString(36).slice(2, 7);
  const tagGradId = `tagGrad-${uid}`;
  const shineGradId = `shineGrad-${uid}`;
  const wordAuto = inverted ? "#94A3B8" : "#475569";
  const wordLabels = inverted ? "#3B9DFF" : "#1E90FF";
  const taglineColor = inverted ? "#64748B" : "#94A3B8";

  // Price-tag mark — vivid blue with $ and check
  const TagMark = () => (
    <g>
      <defs>
        <linearGradient id={tagGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3BB4FF" />
          <stop offset="55%" stopColor="#1E90FF" />
          <stop offset="100%" stopColor="#0066CC" />
        </linearGradient>
        <linearGradient id={shineGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="60%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Tag body — rounded rect with pointed bottom-right corner */}
      <path
        d="
          M 14 10
          L 40 10
          Q 46 10 50 14
          L 56 20
          Q 60 24 60 30
          L 60 46
          Q 60 52 54 52
          L 14 52
          Q 8 52 8 46
          L 8 16
          Q 8 10 14 10 Z
        "
        fill={`url(#${tagGradId})`}
      />

      {/* Subtle top shine */}
      <path
        d="
          M 14 10
          L 40 10
          Q 46 10 50 14
          L 56 20
          Q 60 24 60 30
          L 60 32
          Q 40 22 8 28
          L 8 16
          Q 8 10 14 10 Z
        "
        fill={`url(#${shineGradId})`}
      />

      {/* Tag ring hole */}
      <circle cx="50" cy="20" r="3.5" fill="white" />
      <circle cx="50" cy="20" r="1.6" fill="#0B2041" />

      {/* Dollar sign */}
      <text
        x="26"
        y="42"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="28"
        fontWeight="900"
        fill="white"
        textAnchor="middle"
        letterSpacing="-0.04em"
      >
        $
      </text>

      {/* Compliance checkmark — sits over the bottom-right corner */}
      <g transform="translate(40 38)">
        <circle r="9" fill={`url(#${tagGradId})`} stroke="white" strokeWidth="2" />
        <path
          d="M -4 0 L -1 3 L 4 -3"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </g>
  );

  if (variant === "mark") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="AutoLabels.io"
      >
        <TagMark />
      </svg>
    );
  }

  if (variant === "wordmark") {
    return (
      <svg
        width={size * 5}
        height={tagline ? size * 1.45 : size}
        viewBox={`0 0 200 ${tagline ? 58 : 40}`}
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="AutoLabels.io"
      >
        <text
          x="0"
          y="28"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="26"
          fontWeight="800"
          fill={wordAuto}
          letterSpacing="-0.025em"
        >
          Auto
        </text>
        <text
          x="56"
          y="28"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="26"
          fontWeight="800"
          fill={wordLabels}
          letterSpacing="-0.025em"
          fontStyle="italic"
        >
          Labels.io
        </text>
        {tagline && (
          <text
            x="0"
            y="48"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="7.5"
            fontWeight="600"
            fill={taglineColor}
            letterSpacing="0.22em"
          >
            CLEAR.  COMPLIANT.  CONSISTENT.
          </text>
        )}
      </svg>
    );
  }

  if (variant === "stacked") {
    return (
      <svg
        width={size * 3}
        height={size * (tagline ? 2.3 : 2)}
        viewBox={`0 0 192 ${tagline ? 148 : 128}`}
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="AutoLabels.io"
      >
        <g transform="translate(64 0)">
          <TagMark />
        </g>
        <text
          x="96"
          y="92"
          textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="22"
          fontWeight="800"
          fill={wordAuto}
          letterSpacing="-0.025em"
        >
          Auto<tspan fill={wordLabels} fontStyle="italic">Labels.io</tspan>
        </text>
        {tagline && (
          <text
            x="96"
            y="116"
            textAnchor="middle"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="8"
            fontWeight="600"
            fill={taglineColor}
            letterSpacing="0.24em"
          >
            CLEAR.  COMPLIANT.  CONSISTENT.
          </text>
        )}
      </svg>
    );
  }

  // full — horizontal lockup
  return (
    <svg
      width={size * 5.5}
      height={size * (tagline ? 1.4 : 1)}
      viewBox={`0 0 352 ${tagline ? 90 : 64}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AutoLabels.io"
    >
      <TagMark />
      <text
        x="80"
        y="42"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="32"
        fontWeight="800"
        fill={wordAuto}
        letterSpacing="-0.025em"
      >
        Auto
      </text>
      <text
        x="148"
        y="42"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="32"
        fontWeight="800"
        fill={wordLabels}
        letterSpacing="-0.025em"
        fontStyle="italic"
      >
        Labels.io
      </text>
      {tagline && (
        <text
          x="80"
          y="68"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="9"
          fontWeight="600"
          fill={taglineColor}
          letterSpacing="0.28em"
        >
          CLEAR.  COMPLIANT.  CONSISTENT.
        </text>
      )}
    </svg>
  );
};

export default Logo;
