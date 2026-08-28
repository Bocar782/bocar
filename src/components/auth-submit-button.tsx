import type { ButtonHTMLAttributes } from "react";

export function AuthSubmitButton({
  pending,
  children,
  ...buttonProps
}: {
  pending: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...buttonProps}
      type="submit"
      disabled={pending}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-blue to-accent-violet px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_var(--accent-violet)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Chargement…" : children}
    </button>
  );
}
