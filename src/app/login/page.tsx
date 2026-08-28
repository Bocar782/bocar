import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Content de te revoir"
      subtitle="Connecte-toi pour reprendre tes formations là où tu les as laissées."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground transition-colors hover:text-accent-violet-light"
          >
            Créer un compte
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
