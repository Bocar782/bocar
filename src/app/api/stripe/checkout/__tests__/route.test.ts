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
const mockStripeCheckoutSessionsList = vi.fn();
const mockStripeSubscriptionsList = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  createStripeClient: () => ({
    customers: { create: (...args: unknown[]) => mockStripeCustomersCreate(...args) },
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeCheckoutSessionsCreate(...args),
        list: (...args: unknown[]) => mockStripeCheckoutSessionsList(...args),
      },
    },
    subscriptions: { list: (...args: unknown[]) => mockStripeSubscriptionsList(...args) },
  }),
}));

vi.mock("@/lib/stripe/env", () => ({
  getStripePriceId: () => "price_test_123",
}));

type ReservationResult = { ok: boolean; reason: string; existing_customer_id: string | null };
type ReleaseResult = { released: boolean; reason: string };

let reservationResult: ReservationResult = { ok: true, reason: "ok", existing_customer_id: null };
let reservationError: Error | null = null;
// Prompt 06.19 : résultat de la RETENTATIVE de réservation après une
// libération de verrou abandonné réussie — par défaut identique au premier
// résultat (comportement inchangé pour tous les tests qui ne configurent
// pas explicitement de scénario de récupération).
let retryReservationResult: ReservationResult | null = null;

// Valeur renvoyée par la lecture directe de `pending_checkout_at` (hors
// RPC) que fait `tryRecoverAbandonedLock` avant toute vérification Stripe.
// `null` par défaut : aucun verrou à vérifier, donc aucune tentative de
// récupération ne se déclenche — préserve le comportement des tests
// existants qui ne configurent pas ce scénario.
let currentPendingCheckoutAt: string | null = null;
let pendingCheckoutAtReadError: Error | null = null;

let releaseResult: ReleaseResult = { released: false, reason: "no_pending_checkout" };
let releaseError: Error | null = null;

const rpcCalls: { fnName: string; args: unknown }[] = [];
const mockReserveRpc = vi.fn();
const mockReleaseRpc = vi.fn();

const mockUpdate = vi.fn(() => ({
  eq: () => ({
    select: async () => ({ data: [{ user_id: "user-1" }], error: null }),
    then: (resolve: (value: { data: null; error: null }) => void) =>
      resolve({ data: null, error: null }),
  }),
}));
const mockSelect = vi.fn(() => ({
  eq: () => ({
    maybeSingle: async () => ({
      data: pendingCheckoutAtReadError ? null : { pending_checkout_at: currentPendingCheckoutAt },
      error: pendingCheckoutAtReadError,
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: (fnName: string, args: unknown) => {
      rpcCalls.push({ fnName, args });
      if (fnName === "release_abandoned_checkout_lock") {
        mockReleaseRpc(fnName, args);
        return { single: async () => ({ data: releaseError ? null : releaseResult, error: releaseError }) };
      }
      mockReserveRpc(fnName, args);
      const result = retryReservationResult && mockReserveRpc.mock.calls.length > 1
        ? retryReservationResult
        : reservationResult;
      return {
        single: async () => ({ data: reservationError ? null : result, error: reservationError }),
      };
    },
    from: () => ({ update: mockUpdate, select: mockSelect }),
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
  retryReservationResult = null;
  currentPendingCheckoutAt = null;
  pendingCheckoutAtReadError = null;
  releaseResult = { released: false, reason: "no_pending_checkout" };
  releaseError = null;
  mockReserveRpc.mockClear();
  mockReleaseRpc.mockClear();
  mockSelect.mockClear();
  rpcCalls.length = 0;
  mockUpdate.mockClear();
  mockStripeCustomersCreate.mockReset();
  mockStripeCustomersCreate.mockResolvedValue({ id: "cus_new_123" });
  mockStripeCheckoutSessionsCreate.mockReset();
  mockStripeCheckoutSessionsCreate.mockResolvedValue({ id: "cs_test_abc", client_secret: "cs_test_abc_secret" });
  mockStripeCheckoutSessionsList.mockReset();
  mockStripeCheckoutSessionsList.mockResolvedValue({ data: [], has_more: false });
  mockStripeSubscriptionsList.mockReset();
  mockStripeSubscriptionsList.mockResolvedValue({ data: [], has_more: false });
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

    expect(response.status).toBe(200);
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
  });

  it("06.28 : laisse passer l'origine légitime configurée (NEXT_PUBLIC_SITE_URL de test) et renvoie le client_secret en JSON — plus de redirection HTTP", async () => {
    const response = await callRoute("http://localhost:3000");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ clientSecret: "cs_test_abc_secret" });
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
    const [[sessionArgs]] = mockStripeCheckoutSessionsCreate.mock.calls;
    expect(sessionArgs.ui_mode).toBe("embedded_page");
    expect(sessionArgs.return_url).toBeDefined();
    expect(sessionArgs.success_url).toBeUndefined();
    expect(sessionArgs.cancel_url).toBeUndefined();
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

    it("06.27 : ne crée JAMAIS un customer Stripe séparément pour un nouveau compte — laisse Checkout le créer en un seul appel (via customer_email), puis persiste l'id lu sur la session", async () => {
      reservationResult = { ok: true, reason: "ok", existing_customer_id: null };
      mockStripeCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_test_abc",
        client_secret: "cs_test_abc_secret",
        customer: "cus_new_123",
      });

      await callRoute("http://localhost:3000");

      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
      const [[sessionArgs]] = mockStripeCheckoutSessionsCreate.mock.calls;
      expect(sessionArgs.customer).toBeUndefined();
      expect(sessionArgs.customer_email).toBe("user@test.local");
      expect(mockUpdate).toHaveBeenCalledWith({ stripe_customer_id: "cus_new_123" });
    });
  });

  describe("correctif 06.17 : se rétablit si le customer Stripe persisté est orphelin", () => {
    it("retente une fois (via customer_email, sans appel séparé à customers.create, 06.27) si checkout.sessions.create() échoue avec 'No such customer'", async () => {
      reservationResult = { ok: true, reason: "ok", existing_customer_id: "cus_orphan_old" };
      mockStripeCheckoutSessionsCreate.mockReset();
      mockStripeCheckoutSessionsCreate
        .mockRejectedValueOnce(
          Object.assign(new Error("No such customer: 'cus_orphan_old'"), {
            type: "StripeInvalidRequestError",
            code: "resource_missing",
            param: "customer",
          }),
        )
        .mockResolvedValueOnce({
          id: "cs_test_retry",
          client_secret: "cs_test_retry_secret",
          customer: "cus_fresh_new",
        });

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ clientSecret: "cs_test_retry_secret" });
      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith({ stripe_customer_id: "cus_fresh_new" });
      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledTimes(2);
      const [[retryArgs]] = mockStripeCheckoutSessionsCreate.mock.calls.slice(1);
      expect(retryArgs.customer).toBeUndefined();
      expect(retryArgs.customer_email).toBe("user@test.local");
    });

    it("ne masque pas une autre erreur Stripe sous prétexte de 'customer' manquant", async () => {
      reservationResult = { ok: true, reason: "ok", existing_customer_id: "cus_existing_456" };
      mockStripeCheckoutSessionsCreate.mockReset();
      mockStripeCheckoutSessionsCreate.mockRejectedValueOnce(
        Object.assign(new Error("No such price"), {
          type: "StripeInvalidRequestError",
          code: "resource_missing",
          param: "price",
        }),
      );

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(502);
      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
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

    it("06.27 : relâche le verrou et renvoie 502 si checkout.sessions.create() échoue pour un nouveau compte (plus d'appel customers.create() séparé)", async () => {
      reservationResult = { ok: true, reason: "ok", existing_customer_id: null };
      mockStripeCheckoutSessionsCreate.mockRejectedValueOnce(new Error("Invalid API key"));

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(502);
      expect(mockUpdate).toHaveBeenCalledWith({ pending_checkout_at: null });
      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
    });
  });

  describe("correctif 06.21 : protège contre la course entre une requête encore en cours et la récupération de verrou déclenchée par une seconde requête", () => {
    it("ne tente AUCUNE récupération si le verrou vient d'être posé (quelques millisecondes) — la requête d'origine peut être encore en train de parler à Stripe", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      // Verrou posé "maintenant" : simule exactement le scénario décrit —
      // la Requête A vient d'obtenir reserve_checkout_session() et n'a pas
      // encore eu le temps de créer sa session Checkout quand la Requête B
      // arrive et se heurte au verrou.
      currentPendingCheckoutAt = new Date().toISOString();
      // Même si la recherche Stripe ne trouverait RIEN (la session de A
      // n'existe pas encore), la libération ne doit jamais être tentée :
      // le garde-fou d'âge doit arrêter la récupération AVANT tout appel
      // Stripe.
      mockStripeCheckoutSessionsList.mockResolvedValue({ data: [], has_more: false });
      mockStripeSubscriptionsList.mockResolvedValue({ data: [], has_more: false });
      releaseResult = { released: true, reason: "released" };

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockStripeCheckoutSessionsList).not.toHaveBeenCalled();
      expect(mockStripeSubscriptionsList).not.toHaveBeenCalled();
      expect(mockReleaseRpc).not.toHaveBeenCalled();
      expect(mockReserveRpc).toHaveBeenCalledTimes(1);
    });

    it("ne tente AUCUNE récupération pour un verrou vieux de 30 secondes (nettement sous le seuil)", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = new Date(Date.now() - 30_000).toISOString();

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockStripeCheckoutSessionsList).not.toHaveBeenCalled();
      expect(mockReleaseRpc).not.toHaveBeenCalled();
    });

    it("ne tente AUCUNE récupération pour un verrou vieux de 80 secondes — pile le timeout SDK Stripe d'UN SEUL appel (démontre que ce seul repère, utilisé par erreur dans une première version de ce correctif, aurait été dangereusement insuffisant)", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = new Date(Date.now() - 80_000).toISOString();

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockStripeCheckoutSessionsList).not.toHaveBeenCalled();
      expect(mockReleaseRpc).not.toHaveBeenCalled();
    });

    it("ne tente AUCUNE récupération pour un verrou vieux de 118 secondes — quasiment `maxDuration` (120s) lui-même, qui n'est PAS une garantie plateforme vérifiée (voir le commentaire sur `export const maxDuration` dans route.ts) et ne doit donc jamais servir de seuil de sécurité à lui seul", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = new Date(Date.now() - 118_000).toISOString();

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockStripeCheckoutSessionsList).not.toHaveBeenCalled();
      expect(mockReleaseRpc).not.toHaveBeenCalled();
    });

    it("ne tente AUCUNE récupération pour un verrou vieux de 16 minutes moins 1 seconde — juste sous le seuil réel (plafond AWS Lambda 900s + marge), marge testée au plus près", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = new Date(Date.now() - (16 * 60 * 1000 - 1_000)).toISOString();

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockStripeCheckoutSessionsList).not.toHaveBeenCalled();
      expect(mockReleaseRpc).not.toHaveBeenCalled();
    });

    it("ne tente AUCUNE récupération à exactement 15 minutes (900s) — le plafond AWS Lambda lui-même, avant la marge de sécurité supplémentaire", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockStripeCheckoutSessionsList).not.toHaveBeenCalled();
      expect(mockReleaseRpc).not.toHaveBeenCalled();
    });

    it("autorise la vérification Stripe pour un verrou vieux de 16 minutes et 1 seconde (juste après le seuil réel)", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = new Date(Date.now() - (16 * 60 * 1000 + 1_000)).toISOString();
      releaseResult = { released: true, reason: "released" };
      retryReservationResult = { ok: true, reason: "ok", existing_customer_id: "cus_existing_456" };

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(200);
      expect(mockStripeCheckoutSessionsList).toHaveBeenCalledTimes(1);
      expect(mockReleaseRpc).toHaveBeenCalledTimes(1);
    });

    it("06.23 : le seuil de récupération repose sur le plafond AWS Lambda (900s, structurel — Netlify Functions s'exécutent sur AWS Lambda) + 60s de marge, JAMAIS sur `maxDuration` — garde-fou vivant contre une régression vers une base non vérifiée", async () => {
      // Importe la constante RÉELLE du module (pas une copie) : si le
      // seuil est un jour recalculé sur une base différente et plus
      // faible (ex. retour à maxDuration seul), ce test échoue
      // immédiatement plutôt que de laisser la marge de sécurité se
      // réduire silencieusement sans justification vérifiable.
      const routeModule = await import("@/app/api/stripe/checkout/route");
      const AWS_LAMBDA_HARD_MAX_DURATION_MS = 15 * 60 * 1000;
      const MARGIN_MS = 60_000;

      expect(routeModule.MIN_LOCK_AGE_BEFORE_RECOVERY_MS).toBeGreaterThanOrEqual(
        AWS_LAMBDA_HARD_MAX_DURATION_MS + MARGIN_MS,
      );
      // Le seuil reste malgré tout nettement plus rapide que l'attente
      // aveugle de 30 minutes (reserve_checkout_session, 0022, inchangée).
      expect(routeModule.MIN_LOCK_AGE_BEFORE_RECOVERY_MS).toBeLessThan(30 * 60 * 1000);
    });

    it("06.21/06.24 : release_abandoned_checkout_lock (RPC) refuse elle-même toute libération si le verrou a moins de 16 minutes (960s) — défense en profondeur appliquant la MÊME invariante que route.ts, indépendamment, pas une version affaiblie", async () => {
      // Ce test documente le comportement attendu de la RPC SQL
      // elle-même (vérifié séparément en conditions réelles sur un
      // Postgres local, voir la revue de sécurité 06.21/06.24) : le
      // plancher SQL (960s) a été harmonisé pour être numériquement
      // identique au seuil applicatif (MIN_LOCK_AGE_BEFORE_RECOVERY_MS,
      // route.ts) — jamais un plancher plus faible qui laisserait passer
      // un appel direct (éditeur SQL Supabase, futur code) entre les deux
      // seuils. Ici on vérifie que route.ts respecte bien le refus
      // `lock_too_recent` renvoyé par la RPC exactement comme n'importe
      // quel autre refus (`lock_changed_since_verification`) : aucune
      // nouvelle tentative, verrou conservé.
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = new Date(Date.now() - (16 * 60 * 1000 + 1_000)).toISOString();
      releaseResult = { released: false, reason: "lock_too_recent" };

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockReleaseRpc).toHaveBeenCalledTimes(1);
      expect(mockReserveRpc).toHaveBeenCalledTimes(1);
    });
  });

  describe("correctif 06.19/06.20 : récupération sécurisée d'un verrou abandonné, vérifiée contre Stripe (en cas de doute, le verrou est conservé)", () => {
    it("ne tente aucune récupération si la réservation est refusée pour 'already_pro' (abonnement actif jamais touché)", async () => {
      reservationResult = { ok: false, reason: "already_pro", existing_customer_id: "cus_existing_456" };

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockReleaseRpc).not.toHaveBeenCalled();
      expect(mockStripeCheckoutSessionsList).not.toHaveBeenCalled();
    });

    it("06.20 : ne libère JAMAIS automatiquement si le customer Stripe est absent de Supabase (existing_customer_id null) — seul le délai de 30 min peut libérer ce cas", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: null };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      releaseResult = { released: true, reason: "released" };
      retryReservationResult = { ok: true, reason: "ok", existing_customer_id: null };

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockStripeCheckoutSessionsList).not.toHaveBeenCalled();
      expect(mockStripeSubscriptionsList).not.toHaveBeenCalled();
      expect(mockReleaseRpc).not.toHaveBeenCalled();
      expect(mockReserveRpc).toHaveBeenCalledTimes(1);
    });

    it("vérifie Stripe (toutes les sessions, sans filtre de statut côté appel), ne trouve rien en cours, libère le verrou et retente avec succès", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      mockStripeCheckoutSessionsList.mockResolvedValue({
        data: [{ id: "cs_paid_old", status: "complete", payment_status: "paid" }],
        has_more: false,
      });
      mockStripeSubscriptionsList.mockResolvedValue({
        data: [{ id: "sub_old", status: "canceled" }],
        has_more: false,
      });
      releaseResult = { released: true, reason: "released" };
      retryReservationResult = { ok: true, reason: "ok", existing_customer_id: "cus_existing_456" };

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(200);
      expect(mockStripeCheckoutSessionsList).toHaveBeenCalledWith({
        customer: "cus_existing_456",
        limit: 100,
        starting_after: undefined,
      });
      expect(mockStripeSubscriptionsList).toHaveBeenCalledWith({
        customer: "cus_existing_456",
        status: "all",
        limit: 100,
        starting_after: undefined,
      });
      expect(mockReleaseRpc).toHaveBeenCalledTimes(1);
      expect(mockReserveRpc).toHaveBeenCalledTimes(2);
    });

    it("ne libère JAMAIS si Stripe signale une session Checkout encore ouverte", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      mockStripeCheckoutSessionsList.mockResolvedValue({
        data: [{ id: "cs_open_1", status: "open", payment_status: "unpaid" }],
        has_more: false,
      });

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockReleaseRpc).not.toHaveBeenCalled();
      expect(mockReserveRpc).toHaveBeenCalledTimes(1);
    });

    it("06.20 : ne libère JAMAIS une session 'complete' dont le paiement est encore 'unpaid' (moyen de paiement asynchrone, ex. virement SEPA)", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      mockStripeCheckoutSessionsList.mockResolvedValue({
        data: [{ id: "cs_async_pending", status: "complete", payment_status: "unpaid" }],
        has_more: false,
      });

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockReleaseRpc).not.toHaveBeenCalled();
    });

    it("06.20 : libère normalement une session 'complete' avec 'no_payment_required' (ex. essai gratuit sans carte)", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      mockStripeCheckoutSessionsList.mockResolvedValue({
        data: [{ id: "cs_free", status: "complete", payment_status: "no_payment_required" }],
        has_more: false,
      });
      releaseResult = { released: true, reason: "released" };
      retryReservationResult = { ok: true, reason: "ok", existing_customer_id: "cus_existing_456" };

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(200);
      expect(mockReleaseRpc).toHaveBeenCalledTimes(1);
    });

    it("ne libère JAMAIS si Stripe signale un abonnement actif non encore synchronisé par le webhook", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      mockStripeSubscriptionsList.mockResolvedValue({
        data: [{ id: "sub_live", status: "active" }],
        has_more: false,
      });

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockReleaseRpc).not.toHaveBeenCalled();
    });

    it.each(["incomplete", "past_due", "unpaid"])(
      "06.20 : ne libère JAMAIS si un abonnement Stripe est '%s' (paiement en traitement ou en échec avec nouvelle tentative)",
      async (status) => {
        reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
        currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
        mockStripeSubscriptionsList.mockResolvedValue({
          data: [{ id: "sub_pending", status }],
          has_more: false,
        });

        const response = await callRoute("http://localhost:3000");

        expect(response.status).toBe(409);
        expect(mockReleaseRpc).not.toHaveBeenCalled();
      },
    );

    it("06.20 : libère normalement si l'abonnement est 'incomplete_expired' (premier paiement jamais abouti, définitivement abandonné)", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      mockStripeSubscriptionsList.mockResolvedValue({
        data: [{ id: "sub_expired", status: "incomplete_expired" }],
        has_more: false,
      });
      releaseResult = { released: true, reason: "released" };
      retryReservationResult = { ok: true, reason: "ok", existing_customer_id: "cus_existing_456" };

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(200);
      expect(mockReleaseRpc).toHaveBeenCalledTimes(1);
    });

    it("06.20 : traite un statut d'abonnement INCONNU (futur, non prévu par ce code) comme bloquant, jamais comme sûr", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      mockStripeSubscriptionsList.mockResolvedValue({
        data: [{ id: "sub_futur", status: "un_statut_que_stripe_ajoutera_plus_tard" }],
        has_more: false,
      });

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockReleaseRpc).not.toHaveBeenCalled();
    });

    it("06.20 : pagination Stripe — parcourt toutes les pages avant de conclure (une session bloquante en page 2 est bien détectée)", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      mockStripeCheckoutSessionsList
        .mockResolvedValueOnce({
          data: [{ id: "cs_page1_paid", status: "complete", payment_status: "paid" }],
          has_more: true,
        })
        .mockResolvedValueOnce({
          data: [{ id: "cs_page2_open", status: "open", payment_status: "unpaid" }],
          has_more: false,
        });

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockStripeCheckoutSessionsList).toHaveBeenCalledTimes(2);
      expect(mockStripeCheckoutSessionsList).toHaveBeenNthCalledWith(2, {
        customer: "cus_existing_456",
        limit: 100,
        starting_after: "cs_page1_paid",
      });
      expect(mockReleaseRpc).not.toHaveBeenCalled();
    });

    it("06.20 : pagination incomplète (limite de sécurité atteinte) est traitée comme une INCERTITUDE bloquante, jamais comme 'rien trouvé'", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      // Toujours has_more: true -> la pagination atteint sa limite de
      // sécurité (10 pages) sans jamais voir la dernière page.
      mockStripeCheckoutSessionsList.mockImplementation((args: { starting_after?: string }) =>
        Promise.resolve({
          data: [{ id: `cs_${args.starting_after ?? "first"}`, status: "complete", payment_status: "paid" }],
          has_more: true,
        }),
      );

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockReleaseRpc).not.toHaveBeenCalled();
      // S'arrête bien à la limite de sécurité plutôt que de boucler indéfiniment.
      expect(mockStripeCheckoutSessionsList.mock.calls.length).toBeLessThanOrEqual(10);
    });

    it("comportement fail closed : si la vérification des sessions Stripe échoue (réseau, clé API...), ne libère rien", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      mockStripeCheckoutSessionsList.mockRejectedValueOnce(new Error("Stripe API indisponible"));

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockReleaseRpc).not.toHaveBeenCalled();
    });

    it("comportement fail closed : si la vérification des abonnements Stripe échoue, ne libère rien", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      mockStripeSubscriptionsList.mockRejectedValueOnce(
        Object.assign(new Error("Stripe API timeout"), { type: "StripeConnectionError" }),
      );

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockReleaseRpc).not.toHaveBeenCalled();
    });

    it("ne retente pas la réservation si la lecture du verrou échoue techniquement", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      pendingCheckoutAtReadError = new Error("connexion Supabase perdue");

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockStripeCheckoutSessionsList).not.toHaveBeenCalled();
      expect(mockReleaseRpc).not.toHaveBeenCalled();
    });

    it("n'accède jamais la réservation si release_abandoned_checkout_lock refuse (verrou changé entre-temps)", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      releaseResult = { released: false, reason: "lock_changed_since_verification" };

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      expect(mockReleaseRpc).toHaveBeenCalledTimes(1);
      expect(mockReserveRpc).toHaveBeenCalledTimes(1);
    });

    it("reflète le résultat de la RETENTATIVE si elle échoue à nouveau après une libération réussie (ex. devenu already_pro entre-temps)", async () => {
      reservationResult = { ok: false, reason: "checkout_in_progress", existing_customer_id: "cus_existing_456" };
      currentPendingCheckoutAt = "2026-01-01T00:00:00.000Z";
      releaseResult = { released: true, reason: "released" };
      retryReservationResult = { ok: false, reason: "already_pro", existing_customer_id: "cus_existing_456" };

      const response = await callRoute("http://localhost:3000");

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error).toBe("Tu as déjà un abonnement Pro actif.");
      expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
    });
  });
});
