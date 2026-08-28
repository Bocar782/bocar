"use server";

import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/supabase/errors";
import { getSiteUrl } from "@/lib/site-url";

export type ForgotPasswordState =
  | { error: string; success?: undefined }
  | { success: true; error?: undefined }
  | undefined;

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Renseigne ton email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/update-password`,
  });

  // Supabase ne signale pas si l'email existe (anti-énumération de comptes) :
  // on affiche le même message de succès dans tous les cas, sauf erreur
  // technique réelle (ex. rate limit).
  if (error) {
    return { error: translateAuthError(error.message) };
  }

  return { success: true };
}
