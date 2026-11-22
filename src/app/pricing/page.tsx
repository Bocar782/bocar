import Link from "next/link";
import { BackgroundGlow } from "@/components/background-glow";
import { BrandMark } from "@/components/brand-mark";
import { Faq } from "@/components/marketing/faq";
import { SHORT_FAQ_ITEMS } from "@/components/marketing/faq-data";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { isOnFreePlan } from "@/lib/courses/plan";
import { createClient } from "@/lib/supabase/server";

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const onFreePlan = user ? await isOnFreePlan(supabase, user.id) : true;

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <BackgroundGlow />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
          <BrandMark size={32} />
          <span className="text-lg font-semibold tracking-tight">Tavyra</span>
        </Link>
        {!user && (
          <Link
            href="/login"
            className="text-sm text-foreground-muted transition-colors hover:text-foreground"
          >
            Connexion
          </Link>
        )}
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-24 pt-8 sm:pt-16">
        <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Des tarifs simples
        </h1>
        <p className="mt-3 max-w-md text-center text-sm text-foreground-muted">
          Commence gratuitement, débloque la suite quand tu es prêt à aller
          plus loin.
        </p>

        <div className="mt-12 w-full">
          <PricingCards user={user} onFreePlan={onFreePlan} />
        </div>

        {/* FAQ — sous-ensemble court des vraies questions (partagé avec la landing) */}
        <div className="mt-20 w-full">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">
            Questions fréquentes
          </h2>
          <div className="mt-8">
            <Faq items={SHORT_FAQ_ITEMS} />
          </div>
        </div>

        <p className="mt-10 text-sm text-foreground-muted">
          <Link
            href={user ? "/dashboard" : "/"}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {user ? "← Retour au tableau de bord" : "← Retour à l'accueil"}
          </Link>
        </p>
      </main>
    </div>
  );
}
