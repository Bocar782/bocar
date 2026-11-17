// Vrais tests (Prompt 05.17.3, correction du passage automatique
// Pro -> Free de l'audit 05.17) : importent et exécutent le VRAI
// src/lib/courses/plan.ts.
import { describe, expect, it, vi } from "vitest";
import { getUsageStatus, isOnFreePlan } from "@/lib/courses/plan";

function makeSupabase(subscriptionRow: Record<string, unknown> | null) {
  return {
    from: vi.fn((table: string) => {
      if (table === "subscriptions") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: subscriptionRow, error: null }) }),
          }),
        };
      }
      if (table === "courses") {
        return {
          select: () => ({
            eq: () => ({ gte: async () => ({ count: 0, error: null }) }),
          }),
        };
      }
      throw new Error(`Table inattendue dans ce mock : ${table}`);
    }),
  };
}

describe("isOnFreePlan / getUsageStatus — abonnement actif (non-régression)", () => {
  it("considère Pro un abonnement 'active' avec une période en cours", async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString();
    const supabase = makeSupabase({
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: future,
    });

    expect(await isOnFreePlan(supabase as never, "user-1")).toBe(false);
    const usage = await getUsageStatus(supabase as never, "user-1");
    expect(usage.isPro).toBe(true);
  });

  it("considère Free un utilisateur sans aucune ligne subscriptions (non-régression)", async () => {
    const supabase = makeSupabase(null);

    expect(await isOnFreePlan(supabase as never, "user-1")).toBe(true);
  });

  it("considère Free un statut 'past_due' (paiement échoué, non-régression)", async () => {
    const supabase = makeSupabase({
      status: "past_due",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    });

    expect(await isOnFreePlan(supabase as never, "user-1")).toBe(true);
  });
});

describe("isOnFreePlan — filet de sécurité 05.17.3 (expiration de période malgré un statut 'active' obsolète)", () => {
  it("considère Free un abonnement 'active' dont current_period_end est déjà dans le passé", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    const supabase = makeSupabase({
      status: "active",
      current_period_start: new Date(Date.now() - 1000 * 60 * 60 * 24 * 31).toISOString(),
      current_period_end: past,
    });

    expect(await isOnFreePlan(supabase as never, "user-1")).toBe(true);
  });

  it("conserve l'accès Pro pendant une annulation programmée (cancel_at_period_end) tant que la période n'est pas terminée", async () => {
    // cancel_at_period_end n'affecte jamais current_period_end : la
    // période payée reste dans le futur jusqu'à son terme réel.
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString();
    const supabase = makeSupabase({
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: future,
    });

    expect(await isOnFreePlan(supabase as never, "user-1")).toBe(false);
  });

  it("n'applique aucun filet de sécurité quand current_period_end est absent (null)", async () => {
    const supabase = makeSupabase({
      status: "trialing",
      current_period_start: new Date().toISOString(),
      current_period_end: null,
    });

    expect(await isOnFreePlan(supabase as never, "user-1")).toBe(false);
  });
});
