import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Crée ton compte"
      subtitle="Un email, un mot de passe, et ta première formation t'attend."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground transition-colors hover:text-accent-violet-light"
          >
            Se connecter
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
