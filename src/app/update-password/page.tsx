import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./update-password-form";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Cette page n'est utile qu'avec la session de récupération créée par le
  // lien "mot de passe oublié" (via /auth/callback).
  if (!user) {
    redirect("/forgot-password");
  }

  return (
    <AuthShell
      title="Choisis un nouveau mot de passe"
      subtitle="Ton nouveau mot de passe doit contenir au moins 8 caractères."
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
