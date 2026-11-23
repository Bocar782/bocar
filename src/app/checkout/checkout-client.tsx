"use client";

import { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Prompt 06.28 : paiement intégré directement sur ce site (ui_mode:
// "embedded", voir /api/stripe/checkout/route.ts) — remplace la redirection
// vers checkout.stripe.com, qui se bloquait de façon répétée et
// irrécupérable après le clic sur "S'abonner" (signalement utilisateur réel,
// constaté sur plusieurs comptes, réseaux et appareils, alors que le serveur
// lui-même répondait en 1,5s d'après les logs Netlify — voir route.ts).
export function CheckoutClient({ publishableKey }: { publishableKey: string }) {
  const [error, setError] = useState<string | null>(null);
  // `loadStripe` une seule fois par montage (jamais à chaque rendu) : c'est
  // le usage documenté de Stripe.js, qui met lui-même son propre résultat en
  // cache — l'initialiseur de useState ne s'exécute qu'au premier rendu.
  const [stripePromise] = useState(() => loadStripe(publishableKey));

  // Stripe.js appelle cette fonction lui-même, au moment où il monte le
  // formulaire embarqué — jamais directement par ce composant. Elle ne doit
  // jamais avaler une erreur : si `fetch` échoue réellement (après un
  // contenu non-JSON ou une erreur 4xx/5xx), ce composant doit basculer sur
  // l'état d'erreur plutôt que de laisser `EmbeddedCheckoutProvider` dans un
  // état de chargement indéfini.
  const fetchClientSecret = useCallback(async () => {
    const response = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = (await response.json().catch(() => null)) as { clientSecret?: string; error?: string } | null;

    if (!response.ok || !data?.clientSecret) {
      const message = data?.error ?? "Impossible de créer la session de paiement. Réessaie dans un instant.";
      setError(message);
      throw new Error(message);
    }

    return data.clientSecret;
  }, []);

  // Prompt 06.28 : le cadre (fond, en-tête, largeur, titre) vient de
  // page.tsx — ce composant ne rend plus que son propre contenu (le
  // formulaire Stripe, qui gère lui-même sa largeur responsive à 100%, ou
  // l'état d'erreur), pour rester simple à encarter dans ce cadre commun à
  // toutes les tailles d'écran.
  if (error) {
    return (
      <Card padding="md" className="w-full text-center">
        <p className="text-sm text-foreground">{error}</p>
        <Button href="/pricing" variant="secondary" fullWidth className="mt-6">
          Retour aux tarifs
        </Button>
      </Card>
    );
  }

  return (
    <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
