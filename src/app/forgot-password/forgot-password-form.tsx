"use client";

import { useActionState } from "react";
import { AuthField } from "@/components/auth-field";
import { AuthMessage } from "@/components/auth-message";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    undefined,
  );

  if (state?.success) {
    return (
      <AuthMessage tone="success">
        Si un compte existe avec cet email, tu vas recevoir un lien pour
        réinitialiser ton mot de passe.
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

      <AuthSubmitButton pending={pending}>
        Envoyer le lien de réinitialisation
      </AuthSubmitButton>
    </form>
  );
}
