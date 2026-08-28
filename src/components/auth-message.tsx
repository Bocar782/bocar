export function AuthMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={
        tone === "error"
          ? "mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          : "mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
      }
    >
      {children}
    </p>
  );
}
