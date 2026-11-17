// Vrais tests automatisés (Prompt 05.16.4, correction M3 de l'audit
// 05.16.3) : importent et exécutent le VRAI handler POST de route.ts, y
// compris le VRAI `checkRequestOrigin` qu'il appelle désormais en premier.
// Seules les frontières externes (Supabase, Stripe) sont mockées — aucun
// appel réel à Stripe.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStripeCustomersCreate = vi.fn();
const mockStripeCheckoutSessionsCreate = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  createStripeClient: () => ({
    customers: { create: (...args: unknown[]) => mockStripeCustomersCreate(...args) },
    checkout: { sessions: { create: (...args: unknown[]) => mockStripeCheckoutSessionsCreate(...args) } },
  }),
}));

vi.mock("@/lib/stripe/env", () => ({
  getStripePriceId: () => "price_test_123",
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

let currentUser: { id: string; email: string } | null = { id: "user-1", email: "user@test.local" };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}));

function callRoute(origin?: string) {
  return import("@/app/api/stripe/checkout/route").then(({ POST }) =>
    POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: origin ? { origin } : undefined,
      }),
    ),
  );
}

beforeEach(() => {
  vi.resetModules();
  currentUser = { id: "user-1", email: "user@test.local" };
  mockSubscriptionsSelect.mockReset();
  mockSubscriptionsSelect.mockResolvedValue({ data: null });
  mockStripeCustomersCreate.mockReset();
  mockStripeCustomersCreate.mockResolvedValue({ id: "cus_new_123" });
  mockStripeCheckoutSessionsCreate.mockReset();
  mockStripeCheckoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session/abc" });
});

describe("POST /api/stripe/checkout (vrai route.ts + vraie vérification d'origine)", () => {
  it("renvoie 403 pour une origine externe non autorisée, sans jamais appeler Stripe", async () => {
    const response = await callRoute("https://evil.example");

    expect(response.status).toBe(403);
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("laisse passer une requête sans en-tête Origin (pas de blocage injustifié)", async () => {
    const response = await callRoute(undefined);

    expect(response.status).toBe(303);
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
  });

  it("laisse passer l'origine légitime configurée (NEXT_PUBLIC_SITE_URL de test)", async () => {
    const response = await callRoute("http://localhost:3000");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/session/abc");
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
  });

  it("renvoie 401 si non authentifié (non-régression, inchangé par la vérification d'origine)", async () => {
    currentUser = null;

    const response = await callRoute("http://localhost:3000");

    expect(response.status).toBe(401);
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("réutilise le customer Stripe existant plutôt que d'en créer un nouveau (non-régression)", async () => {
    mockSubscriptionsSelect.mockResolvedValue({ data: { stripe_customer_id: "cus_existing_456" } });

    await callRoute("http://localhost:3000");

    expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
    const [[sessionArgs]] = mockStripeCheckoutSessionsCreate.mock.calls;
    expect(sessionArgs.customer).toBe("cus_existing_456");
  });
});
