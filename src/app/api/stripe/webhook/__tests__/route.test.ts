// Vrais tests automatisés (Prompt 05.17.3, correction des failles de
// fiabilité Stripe de l'audit 05.17) : importent et exécutent le VRAI
// handler POST de route.ts. Seules les frontières externes (SDK Stripe,
// client Supabase admin) sont mockées — aucun appel réel à Stripe ni
// Supabase, et aucun paiement réel. Le RPC `sync_stripe_subscription`
// lui-même (0022_stripe_reliability.sql) est vérifié séparément par de
// vrais tests PostgreSQL (voir le rapport final).
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

type RpcCall = { fnName: string; args: Record<string, unknown> };

type SyncRpcResult = { applied: boolean; duplicate: boolean; reason: string };

let syncResult: SyncRpcResult = { applied: true, duplicate: false, reason: "applied" };
let syncError: Error | null = null;
let rpcCalls: RpcCall[] = [];

const mockRpc = vi.fn((fnName: string, args: Record<string, unknown>) => {
  rpcCalls.push({ fnName, args });
  return { single: async () => ({ data: syncError ? null : syncResult, error: syncError }) };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
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

function fakeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_123",
    customer: "cus_123",
    status: "active",
    cancel_at_period_end: false,
    metadata: { supabase_user_id: "user-1" },
    items: { data: [{ current_period_start: 1700000000, current_period_end: 1702592000 }] },
    ...overrides,
  };
}

beforeEach(() => {
  mockConstructEvent.mockReset();
  mockSubscriptionsRetrieve.mockReset();
  mockSubscriptionsRetrieve.mockResolvedValue(fakeSubscription());
  mockRpc.mockClear();
  rpcCalls = [];
  syncResult = { applied: true, duplicate: false, reason: "applied" };
  syncError = null;
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
      id: "evt_1",
      type: "customer.subscription.updated",
      created: 1700000500,
      data: { object: { id: "sub_123" } },
    });

    const response = await callRoute("{}", { "stripe-signature": "sig_valide" });

    expect(response.status).toBe(200);
    // Relit TOUJOURS l'état actuel depuis Stripe, jamais l'objet embarqué.
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith("sub_123");
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const call = rpcCalls[0];
    expect(call.fnName).toBe("sync_stripe_subscription");
    expect(call.args.p_user_id).toBe("user-1");
    expect(call.args.p_status).toBe("active");
    expect(call.args.p_event_id).toBe("evt_1");
  });

  it("fonctionne même avec un en-tête Origin présent et quelconque (aucune vérification d'origine ajoutée ici)", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_2",
      type: "checkout.session.completed",
      created: 1700000500,
      data: { object: { mode: "payment" } },
    });

    const response = await callRoute("{}", {
      "stripe-signature": "sig_valide",
      origin: "https://ce-qui-importe-nest-pas-verifie.example",
    });

    expect(response.status).toBe(200);
  });

  describe("correction 05.17.3 : écritures Supabase systématiquement vérifiées", () => {
    it("renvoie 500 (pour que Stripe retente) si le RPC de synchronisation échoue techniquement", async () => {
      mockConstructEvent.mockReturnValue({
        id: "evt_3",
        type: "customer.subscription.updated",
        created: 1700000500,
        data: { object: { id: "sub_123" } },
      });
      syncError = new Error("connexion Supabase perdue");

      const response = await callRoute("{}", { "stripe-signature": "sig_valide" });

      expect(response.status).toBe(500);
    });

    it("renvoie 500 si la relecture Stripe elle-même échoue de façon inattendue", async () => {
      mockConstructEvent.mockReturnValue({
        id: "evt_4",
        type: "customer.subscription.updated",
        created: 1700000500,
        data: { object: { id: "sub_123" } },
      });
      mockSubscriptionsRetrieve.mockRejectedValue(new Error("API Stripe indisponible"));

      const response = await callRoute("{}", { "stripe-signature": "sig_valide" });

      expect(response.status).toBe(500);
    });

    it("renvoie 200 sans jamais écrire quoi que ce soit si l'abonnement n'a pas de metadata.supabase_user_id, mais journalise le problème", async () => {
      mockConstructEvent.mockReturnValue({
        id: "evt_5",
        type: "customer.subscription.created",
        created: 1700000500,
        data: { object: { id: "sub_999" } },
      });
      mockSubscriptionsRetrieve.mockResolvedValue(fakeSubscription({ id: "sub_999", metadata: {} }));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await callRoute("{}", { "stripe-signature": "sig_valide" });

      expect(response.status).toBe(200);
      expect(mockRpc).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedPayload = JSON.stringify(consoleErrorSpy.mock.calls);
      expect(loggedPayload).not.toMatch(/email|card|iban/i);
      consoleErrorSpy.mockRestore();
    });

    it("renvoie 200 quand le RPC signale un événement dupliqué (déjà traité) — pas une erreur", async () => {
      mockConstructEvent.mockReturnValue({
        id: "evt_dup",
        type: "customer.subscription.updated",
        created: 1700000500,
        data: { object: { id: "sub_123" } },
      });
      syncResult = { applied: false, duplicate: true, reason: "duplicate_event" };

      const response = await callRoute("{}", { "stripe-signature": "sig_valide" });

      expect(response.status).toBe(200);
    });

    it("renvoie 200 quand le RPC rejette l'écriture comme périmée (protection anti-désordre qui fonctionne) — pas une erreur", async () => {
      mockConstructEvent.mockReturnValue({
        id: "evt_stale",
        type: "customer.subscription.updated",
        created: 1600000000, // ancien
        data: { object: { id: "sub_123" } },
      });
      syncResult = { applied: false, duplicate: false, reason: "stale_event" };

      const response = await callRoute("{}", { "stripe-signature": "sig_valide" });

      expect(response.status).toBe(200);
    });

    it("customer.subscription.deleted relit aussi l'état réel chez Stripe avant de synchroniser", async () => {
      mockConstructEvent.mockReturnValue({
        id: "evt_del",
        type: "customer.subscription.deleted",
        created: 1700000600,
        data: { object: { id: "sub_123" } },
      });
      mockSubscriptionsRetrieve.mockResolvedValue(fakeSubscription({ status: "canceled" }));

      const response = await callRoute("{}", { "stripe-signature": "sig_valide" });

      expect(response.status).toBe(200);
      expect(rpcCalls[0].args.p_status).toBe("canceled");
    });

    it("checkout.session.completed relit l'abonnement chez Stripe (jamais l'objet de session) avant de synchroniser", async () => {
      mockConstructEvent.mockReturnValue({
        id: "evt_checkout",
        type: "checkout.session.completed",
        created: 1700000700,
        data: { object: { mode: "subscription", subscription: "sub_123" } },
      });

      const response = await callRoute("{}", { "stripe-signature": "sig_valide" });

      expect(response.status).toBe(200);
      expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith("sub_123");
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    it("invoice.payment_failed journalise sans donnée sensible et ne touche jamais Supabase", async () => {
      mockConstructEvent.mockReturnValue({
        id: "evt_fail",
        type: "invoice.payment_failed",
        created: 1700000800,
        data: {
          object: {
            id: "in_123",
            customer: "cus_123",
            attempt_count: 2,
            parent: { subscription_details: { subscription: "sub_123" } },
          },
        },
      });
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await callRoute("{}", { "stripe-signature": "sig_valide" });

      expect(response.status).toBe(200);
      expect(mockRpc).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedPayload = JSON.stringify(consoleErrorSpy.mock.calls);
      expect(loggedPayload).not.toMatch(/email|card|iban|4242/i);
      consoleErrorSpy.mockRestore();
    });
  });
});
