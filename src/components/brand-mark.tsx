/**
 * Marque Lia : trois barres ascendantes (progression pédagogique), pas une
 * étincelle générique façon "IA" — cohérent avec les barres de progression
 * déjà présentes dans le produit (dashboard, formations).
 */
export function BrandMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={`shrink-0 drop-shadow-[0_0_18px_rgba(139,92,246,0.45)] ${className}`}
    >
      <defs>
        <linearGradient id="brand-mark-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4c7cf3" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#brand-mark-gradient)" />
      <rect x="7.5" y="18" width="4" height="7.5" rx="1.4" fill="white" fillOpacity="0.95" />
      <rect x="14" y="12.5" width="4" height="13" rx="1.4" fill="white" fillOpacity="0.95" />
      <rect x="20.5" y="6.5" width="4" height="19" rx="1.4" fill="white" />
    </svg>
  );
}
