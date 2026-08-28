"use client";

import { useActionState } from "react";
import { AuthField } from "@/components/auth-field";
import { AuthMessage } from "@/components/auth-message";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { updatePassword } from "./actions";

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <AuthMessage tone="error">{state.error}</AuthMessage>}

      <AuthField
        label="Nouveau mot de passe"
        type="password"
        name="password"
        autoComplete="new-password"
        placeholder="8 caractères minimum"
        minLength={8}
        required
      />

      <AuthField
        label="Confirme le nouveau mot de passe"
        type="password"
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="••••••••"
        minLength={8}
        required
      />

      <AuthSubmitButton pending={pending}>
        Mettre à jour le mot de passe
      </AuthSubmitButton>
    </form>
  );
}
