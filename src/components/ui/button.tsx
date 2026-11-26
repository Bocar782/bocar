import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

// - primary : pilule au dégradé de marque, reflet qui balaie au survol
//   (voir .btn-brand dans globals.css).
// - secondary : pilule à bordure translucide (action secondaire).
// - ghost : texte seul, sans fond ni bordure (action discrète).
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "btn-brand text-white",
  secondary:
    "border border-border-subtle bg-overlay/[0.04] text-foreground backdrop-blur hover:border-accent-violet/40 hover:bg-overlay/[0.08]",
  ghost: "text-foreground-muted hover:text-foreground",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-xs",
  md: "px-6 py-2.5 text-sm",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40";

function buttonClassName(variant: ButtonVariant, size: ButtonSize, fullWidth?: boolean, className = "") {
  return [
    BASE,
    VARIANT_CLASSES[variant],
    variant === "primary" ? "font-semibold" : "",
    SIZE_CLASSES[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href"> & {
    href: string;
    pending?: undefined;
  };

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    href?: undefined;
    /** Affiche "Chargement…" et désactive le bouton (ex. soumission de formulaire). */
    pending?: boolean;
  };

/**
 * Bouton partagé (Prompt 05.14) : un seul endroit pour les 3 styles déjà
 * utilisés partout dans l'app. `href` fait rendre un `next/link` (CTA de
 * navigation) ; son absence rend un vrai `<button>` (action/soumission).
 */
export function Button(props: ButtonAsLink | ButtonAsButton) {
  const { variant = "primary", size = "md", fullWidth, className = "", children, ...rest } = props;
  const classes = buttonClassName(variant, size, fullWidth, className);

  if ("href" in rest && typeof rest.href === "string") {
    const { href, ...anchorRest } = rest as ButtonAsLink;
    return (
      <Link href={href} className={classes} {...anchorRest}>
        {children}
      </Link>
    );
  }

  const { pending, disabled, type = "button", ...buttonRest } = rest as ButtonAsButton;
  return (
    <button type={type} disabled={disabled || pending} className={classes} {...buttonRest}>
      {pending ? "Chargement…" : children}
    </button>
  );
}
