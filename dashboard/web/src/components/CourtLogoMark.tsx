import { useState } from "react";

type CourtLogoMarkProps = {
  url?: string | null;
  alt: string;
  className?: string;
};

/** Small court/club logo; falls back to a placeholder icon when no logo is available. */
export function CourtLogoMark({ url, alt, className = "" }: CourtLogoMarkProps) {
  const [visible, setVisible] = useState(true);
  if (!url || !visible) {
    return (
      <span
        aria-label={alt}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cf-line bg-white text-base shadow-sm ${className}`.trim()}
      >
        ★
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className={`h-9 w-9 shrink-0 rounded-lg border border-cf-line bg-white object-contain p-0.5 shadow-sm ${className}`.trim()}
      decoding="async"
      onError={() => setVisible(false)}
    />
  );
}
