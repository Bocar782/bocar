"use server";

import { createClient } from "@/lib/supabase/server";
import type { ReservationKind } from "./reservation";

export type GenerationStatus = {
  /**
   * `pending` : la génération est toujours en cours côté serveur (ou a été
   * interrompue sans jamais se résoudre — voir `createdAt`/l'expiration de
   * 15 minutes appliquée par `reserve_generation_slot`, 0007/0014).
   * `completed` : terminée avec succès, `resourceId` est l'id de la
   * formation. `released` : abandonnée/échouée. `not_found` : réservation
   * confirmée inexistante pour cet utilisateur (id invalide/périmé).
   * `unknown` : l'état n'a PAS pu être confirmé (panne réseau/Supabase,
   * utilisateur non authentifié) — jamais traité comme "toujours en
   * cours" ni comme "introuvable" : ce sont deux affirmations, celle-ci
   * n'en est aucune.
   */
  status: "pending" | "completed" | "released" | "not_found" | "unknown";
  resourceId: string | null;
  createdAt: string | null;
};

/**
 * Permet de retrouver l'état réel d'une génération après un rechargement
 * de page (Prompt 05.18.1, correction du problème signalé par l'audit
 * 05.18) : la réservation continue d'exister et d'évoluer côté serveur
 * indépendamment de la connexion du navigateur (voir
 * /api/courses/generate/route.ts), donc rien à "reprendre" côté serveur —
 * seulement à RELIRE. La policy RLS `generation_reservations_owner_select`
 * (0007) garantit déjà qu'un utilisateur ne peut lire que SES PROPRES
 * réservations ; le filtre `eq("user_id", user.id)` ci-dessous est
 * redondant avec elle mais appliqué quand même, en défense en profondeur,
 * comme pour le reste de ce projet. Ne lève jamais d'exception : une
 * incertitude (erreur réseau, etc.) est un statut "not_found" explicite —
 * jamais une prétention à tort que la génération continue.
 *
 * `kind` (Prompt 05.19/05.20) : réutilisé à l'identique pour la reprise
 * après rechargement d'une analyse approfondie en cours de génération
 * (`/api/analysis/generate`), qui souffrait jusqu'ici exactement du même
 * problème que celui corrigé pour les formations en 05.18.1 — même table
 * `generation_reservations`, seule la valeur de `kind` diffère
 * ("course"/"analysis"). Filtré explicitement (comme `user_id`) pour
 * qu'une réservation de formation ne puisse jamais être confondue avec
 * celle d'une analyse, même si leurs identifiants se ressemblaient.
 */
export async function getGenerationStatus(
  reservationId: string,
  kind: ReservationKind,
): Promise<GenerationStatus> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // Pas (ou plus) authentifié : on ne sait littéralement rien de cette
      // réservation, jamais "elle n'existe pas".
      return { status: "unknown", resourceId: null, createdAt: null };
    }

    const { data, error } = await supabase
      .from("generation_reservations")
      .select("status, resource_id, created_at")
      .eq("id", reservationId)
      .eq("user_id", user.id)
      .eq("kind", kind)
      .maybeSingle();

    if (error) {
      return { status: "unknown", resourceId: null, createdAt: null };
    }
    if (!data) {
      return { status: "not_found", resourceId: null, createdAt: null };
    }

    const status = data.status as string;
    if (status !== "pending" && status !== "completed" && status !== "released") {
      return { status: "unknown", resourceId: null, createdAt: null };
    }

    return {
      status,
      resourceId: (data.resource_id as string | null) ?? null,
      createdAt: (data.created_at as string | null) ?? null,
    };
  } catch {
    return { status: "unknown", resourceId: null, createdAt: null };
  }
}
