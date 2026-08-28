"use client";

import { useActionState } from "react";
import { AuthField } from "@/components/auth-field";
import { AuthMessage } from "@/components/auth-message";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { login } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

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

      <div>
        <AuthField
          label="Mot de passe"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
        <a
          href="/forgot-password"
          className="mt-2 inline-block text-xs text-foreground-muted transition-colors hover:text-foreground"
        >
          Mot de passe oublié ?
        </a>
      </div>

      <AuthSubmitButton pending={pending}>Se connecter</AuthSubmitButton>
    </form>
  );
}
