import type { InputHTMLAttributes } from "react";

export function AuthField({
  label,
  ...inputProps
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-foreground-muted">
        {label}
      </span>
      <input
        {...inputProps}
        className="w-full rounded-xl border border-border-subtle bg-white/[0.03] px-4 py-2.5 text-sm text-foreground placeholder:text-foreground-muted/60 outline-none transition-colors focus:border-accent-violet/60 focus:bg-white/[0.05]"
      />
    </label>
  );
}
