"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";

// Prompt 06.16 : un double-clic (impatience, réseau lent) sur "S'abonner"
// envoyait deux requêtes POST successives vers /api/stripe/checkout. La
// seconde se heurtait systématiquement au verrou anti-double-abonnement
// (`reserve_checkout_session`) et affichait une erreur à un visiteur qui
// n'avait pourtant rien fait d'anormal — un vrai risque de perdre une
// vente. Désactiver le bouton dès le premier clic (formulaire natif, donc
// navigation complète : pas de useActionState possible ici) empêche ce
// double envoi à la source, sans toucher à la protection côté serveur
// (gardée telle quelle, en profondeur).
export function StripeSubmitForm({
  action,
  children,
  variant,
  fullWidth,
  className,
}: {
  action: "/api/stripe/checkout" | "/api/stripe/portal";
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={action}
      method="POST"
      onSubmit={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        setPending(true);
      }}
    >
      <Button type="submit" variant={variant} fullWidth={fullWidth} className={className} pending={pending}>
        {children}
      </Button>
    </form>
  );
}
