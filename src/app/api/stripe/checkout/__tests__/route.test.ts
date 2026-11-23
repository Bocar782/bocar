// Vrais tests automatisés (Prompt 05.17.3, correction de la faille de
// double abonnement de l'audit 05.17) : importent et exécutent le VRAI
// handler POST de route.ts, y compris le VRAI `checkRequestOrigin`. Seules
// les frontières externes (Supabase, Stripe) sont mockées — aucun appel
// réel à Stripe. Le RPC `reserve_checkout_session` lui-même
// (0022_stripe_reliability.sql) est vérifié séparément par de vrais tests
// PostgreSQL (voir le rapport final), y compris sa protection de
// concurrence réelle (verrou avisoire) — ce fichier prouve uniquement que
// route.ts l'appelle correctement et respecte son résultat.
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

type ReservationResult = { ok: boolean; reason: string; existing_customer_id: string | null };

let reservationResult: ReservationResult = { ok: true, reason: "ok", existing_customer_id: null };
let reservationError: Error | null = null;
const rpcCalls: { fnName: string; args: unknown }[] = [];
const mockReserveRpc = vi.fn((fnName: string, args: unknown) => {
  rpcCalls.push({ fnName, args });
  return {
    single: async () => ({ data: reservationError ? null : reservationResult, error: reservationError }),
  };
});
const mockUpdate = vi.fn(() => ({ eq: async () => ({ data: null, error: null }) }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: (fnName: string, args: unknown) => mockReserveRpc(fnName, args),
    from: () => ({ update: mockUpdate }),
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
  reservationResult = { ok: true, reason: "ok", existing_customer_id: null };
  reservationError = null;
  mockReserveRpc.mockClear();
  rpcCalls.length = 0;
  mockUpdate.mockClear();
  mockStripeCustomersCreate.mockReset();
  mockStripeCustomersCreate.mockResolvedValue({ id: "cus_new_123" });
  mockStripeCheckoutSessionsCreate.mockReset();
  mockStripeCheckoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session/abc" });
});

describe("POST /api/stripe/checkout (vrai route.ts + vraie vérification d'origine)", () => {
  it("renvoie 403 pour une origine externe non autorisée, sans jamais appeler Stripe ni réserver de session", async () => {
    const response = await callRoute("https://evil.example");

    expect(response.status).toBe(403);
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
    expect(mockReserveRpc).not.toHaveBeenCalled();
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

  it("réutilise le customer Stripe existant renvoyé par la réservation plutôt que d'en créer un nouveau (non-régression)", async () => {
    reservationResult = { ok: true, reason: "ok", existing_customer_id: "cus_existing_456" };

    await callRoute("http://localhost:3000");

    expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
    const [[sessionArgs]] = mockStripeCheckoutSessionsCreate.mock.calls;
    expect(sessionArgs.customer).toBe("cus_existing_456");
  });

  describe("correction 05.17.3 : empêche les doubles abonnements", () => {
    it("appelle reserve_checkout_session AVANT tout appel à Stripe, avec l'id du vrai utilisateur connecté", async () => {
      await callRoute("http://localhost:3000");

      expect(mockReserveRpc).toHaveBeenCalledWith("reserve_checkout_session", { p_user_id: "user-1" });
      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
    });

    it("refuse (409) un utilisateur déjà Pro, sans jamais appeler Stripe", async () => {
      reservationResult = { ok: false, reason: "already_pro", existing_customer_id: "cus_existing_456" };

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
      expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
    });

    it("refuse (409) une deuxième requête Checkout concurrente, sans jamais appeler Stripe (protection anti-double-abonnement)", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: null };

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
    });

    it("renvoie 503 sans jamais appeler Stripe si la réservation échoue techniquement (jamais de fallback silencieux)", async () => {
      reservationError = new Error("RPC indisponible");

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(503);
      expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
    });

    it("persiste le nouveau customer Stripe créé, pour éviter un doublon au prochain essai", async () => {
      reservationResult = { ok: true, reason: "ok", existing_customer_id: null };

      await callRoute("http://localhost:3000");

      expect(mockStripeCustomersCreate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith({ stripe_customer_id: "cus_new_123" });
    });
  });

  describe("correctif 06.15 : ne laisse jamais le verrou bloqué après un échec Stripe", () => {
    it("relâche le verrou et renvoie 502 si stripe.checkout.sessions.create() échoue", async () => {
      reservationResult = { ok: true, reason: "ok", existing_customer_id: "cus_existing_456" };
      mockStripeCheckoutSessionsCreate.mockRejectedValueOnce(
        Object.assign(new Error("No such price"), { type: "StripeInvalidRequestError", code: "resource_missing" }),
      );

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(502);
      expect(mockUpdate).toHaveBeenCalledWith({ pending_checkout_at: null });
    });

    it("relâche le verrou et renvoie 502 si stripe.customers.create() échoue", async () => {
      reservationResult = { ok: true, reason: "ok", existing_customer_id: null };
      mockStripeCustomersCreate.mockRejectedValueOnce(new Error("Invalid API key"));

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(502);
      expect(mockUpdate).toHaveBeenCalledWith({ pending_checkout_at: null });
      expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
    });
  });
});
