"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/supabase/errors";

export type UpdatePasswordState = { error: string } | undefined;

export async function updatePassword(
  _prevState: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  if (password !== confirmPassword) {
    return { error: "Les mots de passe ne correspondent pas." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  redirect("/dashboard");
}
