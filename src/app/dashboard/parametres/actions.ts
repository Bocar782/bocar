"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/supabase/errors";

const MAX_USERNAME_LENGTH = 40;

export type SettingsActionState =
  | { error: string; success?: undefined }
  | { success: string; error?: undefined }
  | undefined;

// Prompt 06.13 : nom d'utilisateur stocké dans user_metadata (pas de table
// dédiée — Supabase le propose nativement et c'est la seule donnée
// d'affichage qu'on a besoin de persister ici).
export async function updateUsername(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const username = String(formData.get("username") ?? "").trim();

  if (!username) {
    return { error: "Le nom d'utilisateur ne peut pas être vide." };
  }
  if (username.length > MAX_USERNAME_LENGTH) {
    return { error: `Le nom d'utilisateur ne peut pas dépasser ${MAX_USERNAME_LENGTH} caractères.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu dois être connecté." };
  }

  const { error } = await supabase.auth.updateUser({ data: { username } });
  if (error) {
    return { error: translateAuthError(error.message) };
  }

  revalidatePath("/dashboard/parametres");
  revalidatePath("/dashboard");
  return { success: "Nom d'utilisateur mis à jour." };
}

// Prompt 06.13 : supabase.auth.updateUser({ email }) déclenche l'envoi par
// Supabase d'un email de confirmation à la nouvelle adresse — le
// changement ne prend donc effet qu'une fois ce lien ouvert, jamais
// immédiatement ici.
export async function updateEmail(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email || !email.includes("@")) {
    return { error: "Adresse email invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu dois être connecté." };
  }

  if (email === user.email) {
    return { error: "C'est déjà ton adresse actuelle." };
  }

  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    return { error: translateAuthError(error.message) };
  }

  return {
    success: `Un email de confirmation a été envoyé à ${email}. Le changement prendra effet une fois le lien ouvert.`,
  };
}

export async function updateSettingsPassword(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }
  if (password !== confirmPassword) {
    return { error: "Les mots de passe ne correspondent pas." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu dois être connecté." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: translateAuthError(error.message) };
  }

  return { success: "Mot de passe mis à jour." };
}
