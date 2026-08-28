"use client";

import { useActionState } from "react";
import { AuthField } from "@/components/auth-field";
import { AuthMessage } from "@/components/auth-message";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { signup } from "./actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  if (state?.success) {
    return (
      <AuthMessage tone="success">
        Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse avant
        de te connecter.
      </AuthMessage>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <AuthMessage tone="error">{state.error}</AuthMessage>}

      <AuthField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="toi@exemple.com"
        required
      />

      <AuthField
        label="Mot de passe"
        type="password"
        name="password"
        autoComplete="new-password"
        placeholder="8 caractères minimum"
        minLength={8}
        required
      />

      <AuthField
        label="Confirme le mot de passe"
        type="password"
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="••••••••"
        minLength={8}
        required
      />

      <AuthSubmitButton pending={pending}>Créer mon compte</AuthSubmitButton>
    </form>
  );
}
