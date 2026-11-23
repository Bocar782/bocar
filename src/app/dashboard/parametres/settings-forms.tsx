"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { updateEmail, updateSettingsPassword, updateUsername } from "./actions";

function Field({
  label,
  ...inputProps
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-foreground-muted">{label}</span>
      <input
        {...inputProps}
        className="w-full rounded-xl border border-border-subtle bg-overlay/[0.03] px-4 py-2.5 text-sm text-foreground placeholder:text-foreground-muted/60 outline-none transition-colors focus:border-accent-violet/60 focus:bg-overlay/[0.05]"
      />
    </label>
  );
}

export function UsernameForm({ currentUsername }: { currentUsername: string }) {
  const [state, formAction, pending] = useActionState(updateUsername, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Callout tone="error" role="alert">
          {state.error}
        </Callout>
      )}
      {state?.success && <Callout tone="success">{state.success}</Callout>}

      <Field
        label="Nom d'utilisateur"
        type="text"
        name="username"
        defaultValue={currentUsername}
        maxLength={40}
        placeholder="Ton nom, tel qu'affiché dans l'app"
        required
      />

      <Button type="submit" pending={pending}>
        Enregistrer
      </Button>
    </form>
  );
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction, pending] = useActionState(updateEmail, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Callout tone="error" role="alert">
          {state.error}
        </Callout>
      )}
      {state?.success && <Callout tone="success">{state.success}</Callout>}

      <Field
        label="Adresse email"
        type="email"
        name="email"
        defaultValue={currentEmail}
        autoComplete="email"
        placeholder="toi@exemple.com"
        required
      />

      <Button type="submit" pending={pending}>
        Changer d&apos;email
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(updateSettingsPassword, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Callout tone="error" role="alert">
          {state.error}
        </Callout>
      )}
      {state?.success && <Callout tone="success">{state.success}</Callout>}

      <Field
        label="Nouveau mot de passe"
        type="password"
        name="password"
        autoComplete="new-password"
        placeholder="8 caractères minimum"
        minLength={8}
        required
      />
      <Field
        label="Confirme le nouveau mot de passe"
        type="password"
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="••••••••"
        minLength={8}
        required
      />

      <Button type="submit" pending={pending}>
        Mettre à jour le mot de passe
      </Button>
    </form>
  );
}
