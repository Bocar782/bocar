// Vrai test de non-régression (Prompt 05.16.4) : le webhook Stripe n'a
// volontairement PAS été modifié par cette tâche — ni vérification
// d'origine, ni changement de cookie. Ce test importe et exécute le VRAI
// handler POST de route.ts et prouve qu'il continue de fonctionner
// exactement comme avant : authentification par signature Stripe
// uniquement, accessible sans cookie ni en-tête Origin (Stripe appelle
// cette route directement, serveur à serveur).
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  createStripeClient: () => ({
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
    subscriptions: { retrieve: (...args: unknown[]) => mockSubscriptionsRetrieve(...args) },
  }),
}));

vi.mock("@/lib/stripe/env", () => ({
  getStripeWebhookSecret: () => "whsec_test_123",
}));

const mockUpsert = vi.fn();
mockUpsert.mockResolvedValue({ data: null, error: null });
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ upsert: mockUpsert }),
  }),
}));

function callRoute(body: string, headers?: Record<string, string>) {
  return import("@/app/api/stripe/webhook/route").then(({ POST }) =>
    POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers,
        body,
      }),
    ),
  );
}

beforeEach(() => {
  mockConstructEvent.mockReset();
  mockSubscriptionsRetrieve.mockReset();
  mockUpsert.mockClear();
});

describe("POST /api/stripe/webhook (vrai route.ts, aucune vérification d'origine — inchangé)", () => {
  it("renvoie 400 si l'en-tête stripe-signature est absent", async () => {
    const response = await callRoute("{}");

    expect(response.status).toBe(400);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("renvoie 400 si la signature est invalide", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("signature invalide");
    });

    const response = await callRoute("{}", { "stripe-signature": "sig_invalide" });

    expect(response.status).toBe(400);
  });

  it("fonctionne SANS aucun en-tête Origin (serveur à serveur, comme avant cette tâche)", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          metadata: { supabase_user_id: "user-1" },
          items: { data: [{ current_period_start: 1700000000, current_period_end: 1702592000 }] },
        },
      },
    });

    const response = await callRoute("{}", { "stripe-signature": "sig_valide" });

    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [payload] = mockUpsert.mock.calls[0] as [{ status: string; user_id: string }];
    expect(payload.status).toBe("active");
    expect(payload.user_id).toBe("user-1");
  });

  it("fonctionne même avec un en-tête Origin présent et quelconque (aucune vérification d'origine ajoutée ici)", async () => {
    mockConstructEvent.mockReturnValue({ type: "checkout.session.completed", data: { object: { mode: "payment" } } });

    const response = await callRoute("{}", {
      "stripe-signature": "sig_valide",
      origin: "https://ce-qui-importe-nest-pas-verifie.example",
    });

    expect(response.status).toBe(200);
  });
});
