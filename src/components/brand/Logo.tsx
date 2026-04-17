interface LogoProps {
  variant?: "mark" | "full" | "stacked" | "wordmark";
  inverted?: boolean;
  size?: number;
  className?: string;
  /**
   * Reserved for API compatibility with prior SVG version. The tagline
   * "CLEAR. COMPLIANT. CONSISTENT." is baked into the `full` raster, so
   * this prop is a no-op today. Kept so existing call sites still compile.
   */
  tagline?: boolean;
}

/**
 * AutoLabels.io Logo
 *
 * Renders the official brand raster. The full lockup (price-tag mark +
 * "AutoLabels.io" wordmark + "CLEAR. COMPLIANT. CONSISTENT." tagline)
 * lives at /autolabels-logo.png. The square mark-only version lives at
 * /autolabels-mark.png. Save those files into the `public/` folder.
 *
 * The raster aspect ratio of the lockup is ~3.8:1. `size` controls the
 * rendered height in pixels; width scales proportionally.
 */
// Use the SVG lockup so the logo always renders. Dealers can override
// by dropping /autolabels-logo.png (full) or /autolabels-mark.png
// (square) into public/ — the SVG stays as a reliable fallback.
const FULL_SRC = "/autolabels-logo.svg";
const MARK_SRC = "/autolabels-mark.svg";

const Logo = ({
  variant = "mark",
  inverted = false,
  size = 32,
  className,
}: LogoProps) => {
  const isMark = variant === "mark";
  const src = isMark ? MARK_SRC : FULL_SRC;
  // Approximate aspect ratios from the supplied brand art.
  const aspect = isMark ? 1 : 3.8;
  const width = Math.round(size * aspect);

  return (
    <img
      src={src}
      alt="AutoLabels.io"
      width={width}
      height={size}
      className={className}
      draggable={false}
      style={{
        height: size,
        width,
        objectFit: "contain",
        filter: inverted ? "brightness(0) invert(1)" : undefined,
      }}
    />
  );
};

export default Logo;
