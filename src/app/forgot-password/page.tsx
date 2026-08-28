import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Indique ton email, on t'envoie un lien pour en choisir un nouveau."
      footer={
        <Link
          href="/login"
          className="font-medium text-foreground transition-colors hover:text-accent-violet-light"
        >
          Retour à la connexion
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
