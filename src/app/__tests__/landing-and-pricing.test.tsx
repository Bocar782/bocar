// Vrais tests (Prompt 05.13) : importent et rendent le VRAI code (page.tsx,
// pricing/page.tsx, components/marketing/*, faq-data.ts) — pas une
// reproduction de leur contenu. SSR via react-dom/server, sans DOM
// nécessaire. Seul le client Supabase (frontière externe) est mocké pour
// la page /pricing, qui est un Server Component async.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FAQ_ITEMS } from "@/components/marketing/faq-data";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FREE_PLAN_FEATURES, FREE_PLAN_LIMITATION, PRO_PLAN_FEATURES } from "@/lib/courses/plan";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

describe("FAQ (vrai code) — plus de mention générique \"le SaaS\"", () => {
  it("ne contient plus \"le SaaS\" et nomme Tavyra à la place", () => {
    const allText = FAQ_ITEMS.map((item) => `${item.question} ${item.answer}`).join(" ");
    expect(allText).not.toMatch(/le SaaS/i);
    expect(FAQ_ITEMS[0].question).toBe("Comment fonctionne Tavyra ?");
    expect(FAQ_ITEMS[7].question).toBe("Puis-je utiliser Tavyra sur téléphone ?");
  });
});

describe("Landing (vrai code, page.tsx) — hero honnête", () => {
  it("ne prétend plus un nombre d'utilisateurs non vérifiable", async () => {
    const { default: Home } = await import("@/app/page");
    const html = renderToStaticMarkup(<Home />);
    expect(html).not.toMatch(/\+\s*5\s*000\s*utilisateurs/i);
    expect(html).toContain("Gratuit, sans carte bancaire");
  });

  it("ne contient plus aucun lien mort vers Confidentialité/CGU", async () => {
    const { default: Home } = await import("@/app/page");
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain('href="/confidentialite"');
    expect(html).toContain('href="/conditions-utilisation"');
  });

  it("met en avant les bénéfices pour les élèves ET les entrepreneurs", async () => {
    const { default: Home } = await import("@/app/page");
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("Pour les élèves et étudiants");
    expect(html).toContain("Pour les entrepreneurs");
  });
});

describe("Parité des avantages Pro/Gratuit entre la landing et /pricing (vrai code)", () => {
  it("la landing (PricingSection) affiche bien tous les avantages de la source partagée", () => {
    const html = renderToStaticMarkup(<PricingSection />);
    for (const feature of PRO_PLAN_FEATURES) expect(html).toContain(feature);
    for (const feature of FREE_PLAN_FEATURES) expect(html).toContain(feature);
    expect(html).toContain(FREE_PLAN_LIMITATION);
  });

  it("/pricing (vraie page) affiche exactement les mêmes avantages que la landing", async () => {
    const { default: PricingPage } = await import("@/app/pricing/page");
    const element = await PricingPage();
    const html = renderToStaticMarkup(element);
    for (const feature of PRO_PLAN_FEATURES) expect(html).toContain(feature);
    for (const feature of FREE_PLAN_FEATURES) expect(html).toContain(feature);
    expect(html).toContain(FREE_PLAN_LIMITATION);
  });

  it("/pricing propose un vrai appel à l'action vers l'inscription pour un visiteur non connecté (plan gratuit)", async () => {
    const { default: PricingPage } = await import("@/app/pricing/page");
    const element = await PricingPage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain('href="/signup"');
    expect(html).toContain("Commencer gratuitement");
  });
});

describe("Pages Confidentialité / Conditions d'utilisation (vrai code)", () => {
  it("affichent clairement qu'elles ne sont pas encore des pages juridiques finalisées, sans rien inventer", async () => {
    const { default: PrivacyPage } = await import("@/app/confidentialite/page");
    const { default: TermsPage } = await import("@/app/conditions-utilisation/page");

    const privacyHtml = renderToStaticMarkup(<PrivacyPage />);
    const termsHtml = renderToStaticMarkup(<TermsPage />);

    expect(privacyHtml).toMatch(/pas encore une politique de confidentialité complète/i);
    expect(termsHtml).toMatch(/pas encore des conditions/i);
    expect(termsHtml).toMatch(/juridiquement finalisées/i);

    // Aucune information inventée : ni adresse, ni SIRET, ni nom de société.
    for (const html of [privacyHtml, termsHtml]) {
      expect(html).not.toMatch(/SIRET|SAS\b|SARL\b/i);
    }
  });
});
