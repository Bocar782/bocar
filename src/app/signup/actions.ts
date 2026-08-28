"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/supabase/errors";
import { getSiteUrl } from "@/lib/site-url";

export type SignupState =
  | { error: string; success?: undefined }
  | { success: true; error?: undefined }
  | undefined;

export async function signup(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !password) {
    return { error: "Renseigne ton email et ton mot de passe." };
  }

  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  if (password !== confirmPassword) {
    return { error: "Les mots de passe ne correspondent pas." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  // Si la confirmation par email est désactivée côté Supabase, une session
  // est immédiatement disponible : on connecte l'utilisateur directement.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  return { success: true };
}
