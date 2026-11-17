// Vrais tests automatisés (Prompt 05.16.4, correction M3 de l'audit
// 05.16.3) : importent et exécutent le VRAI handler POST de route.ts, y
// compris le VRAI `checkRequestOrigin` qu'il appelle désormais en premier.
// Seules les frontières externes (Supabase, Stripe) sont mockées — aucun
// appel réel à Stripe.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockBillingPortalSessionsCreate = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  createStripeClient: () => ({
    billingPortal: { sessions: { create: (...args: unknown[]) => mockBillingPortalSessionsCreate(...args) } },
  }),
}));

const mockSubscriptionsSelect = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: (...args: unknown[]) => mockSubscriptionsSelect(...args),
        }),
      }),
    }),
  }),
}));

let currentUser: { id: string } | null = { id: "user-1" };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}));

function callRoute(origin?: string) {
  return import("@/app/api/stripe/portal/route").then(({ POST }) =>
    POST(
      new Request("http://localhost/api/stripe/portal", {
        method: "POST",
        headers: origin ? { origin } : undefined,
      }),
    ),
  );
}

beforeEach(() => {
  vi.resetModules();
  currentUser = { id: "user-1" };
  mockSubscriptionsSelect.mockReset();
  mockSubscriptionsSelect.mockResolvedValue({ data: { stripe_customer_id: "cus_existing_789" } });
  mockBillingPortalSessionsCreate.mockReset();
  mockBillingPortalSessionsCreate.mockResolvedValue({ url: "https://billing.stripe.com/session/xyz" });
});

describe("POST /api/stripe/portal (vrai route.ts + vraie vérification d'origine)", () => {
  it("renvoie 403 pour une origine externe non autorisée, sans jamais appeler Stripe", async () => {
    const response = await callRoute("https://evil.example");

    expect(response.status).toBe(403);
    expect(mockBillingPortalSessionsCreate).not.toHaveBeenCalled();
  });

  it("laisse passer une requête sans en-tête Origin (pas de blocage injustifié)", async () => {
    const response = await callRoute(undefined);

    expect(response.status).toBe(303);
    expect(mockBillingPortalSessionsCreate).toHaveBeenCalledTimes(1);
  });

  it("laisse passer l'origine légitime configurée (NEXT_PUBLIC_SITE_URL de test)", async () => {
    const response = await callRoute("http://localhost:3000");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://billing.stripe.com/session/xyz");
  });

  it("renvoie 401 si non authentifié (non-régression, inchangé par la vérification d'origine)", async () => {
    currentUser = null;

    const response = await callRoute("http://localhost:3000");

    expect(response.status).toBe(401);
    expect(mockBillingPortalSessionsCreate).not.toHaveBeenCalled();
  });

  it("renvoie 404 si l'utilisateur n'a aucun abonnement Stripe (non-régression)", async () => {
    mockSubscriptionsSelect.mockResolvedValue({ data: null });

    const response = await callRoute("http://localhost:3000");

    expect(response.status).toBe(404);
    expect(mockBillingPortalSessionsCreate).not.toHaveBeenCalled();
  });
});
