import { IconCreditCardOff, IconRefreshCircle, IconShieldCheck } from "./icons";

// Prompt 06.13 : bandeau de réassurance — trois affirmations vérifiables
// (le plan gratuit ne demande pas de carte, Stripe gère le paiement, et le
// portail Stripe permet une résiliation à tout moment, cf.
// /conditions-utilisation) plutôt qu'une fausse garantie "satisfait ou
// remboursé" qu'on ne pourrait pas tenir.
const TRUST_ITEMS = [
  { icon: IconCreditCardOff, label: "Sans carte bancaire pour commencer" },
  { icon: IconShieldCheck, label: "Paiement sécurisé via Stripe" },
  { icon: IconRefreshCircle, label: "Résiliation en un clic, à tout moment" },
] as const;

export function TrustStrip({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-6 gap-y-2.5 ${className}`}>
      {TRUST_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <li
            key={item.label}
            className="flex items-center gap-2 text-xs font-medium text-foreground-muted"
          >
            <Icon width={15} height={15} className="shrink-0 text-accent-violet" />
            {item.label}
          </li>
        );
      })}
    </ul>
  );
}
