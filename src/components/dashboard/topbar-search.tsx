"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IconSearch } from "./icons";

// Prompt 06.3 : recherche globale — redirige vers la bibliothèque avec la
// requête en paramètre plutôt que de dupliquer un index de recherche sur
// chaque page du shell (la bibliothèque a déjà la liste complète et le
// vrai filtre, voir library-browser.tsx).
export function TopbarSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    router.push(
      trimmed ? `/dashboard/formations?q=${encodeURIComponent(trimmed)}` : "/dashboard/formations",
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-md">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted">
        <IconSearch width={16} height={16} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Rechercher une formation…"
        className="w-full rounded-full border border-border-subtle bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent-violet/50 focus:outline-none"
      />
    </form>
  );
}
