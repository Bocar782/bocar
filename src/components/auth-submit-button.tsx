import type { ButtonHTMLAttributes } from "react";
import { Button } from "./ui/button";

/**
 * Fine couche de compatibilité (Prompt 05.14) : repose sur `Button`
 * (variant primary, pleine largeur), mêmes points d'appel qu'avant. Forme
 * harmonisée en pilule (`rounded-full`), comme tous les autres boutons
 * primaires de l'app — auparavant seul ce bouton était en `rounded-xl`.
 */
export function AuthSubmitButton({
  pending,
  children,
  className = "",
  ...buttonProps
}: {
  pending: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button {...buttonProps} type="submit" pending={pending} fullWidth className={`mt-2 ${className}`}>
      {children}
    </Button>
  );
}
