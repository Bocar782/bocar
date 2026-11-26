import Link from "next/link";
import type { ReactNode } from "react";
import { BackgroundGlow } from "./background-glow";
import { BrandMark } from "./brand-mark";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <BackgroundGlow />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16">
        <Link href="/" className="rise mb-8 flex items-center gap-2">
          <BrandMark size={32} />
          <span className="text-lg font-semibold tracking-tight">Tavyra</span>
        </Link>

        <div
          className="rise gradient-border w-full max-w-md rounded-[28px] bg-background-elevated/80 p-8 shadow-[0_30px_80px_-30px_var(--glow)] backdrop-blur-xl"
          style={{ ["--d" as string]: "80ms" }}
        >
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-foreground-muted">{subtitle}</p>
          )}

          <div className="mt-6">{children}</div>
        </div>

        {footer && (
          <div className="mt-6 text-center text-sm text-foreground-muted">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
