import { Callout } from "./ui/callout";

/** Fine couche de compatibilité (Prompt 05.14) : repose sur `Callout`, mêmes points d'appel qu'avant. */
export function AuthMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <Callout tone={tone === "error" ? "error" : "success"} role={tone === "error" ? "alert" : undefined} className="mb-4">
      {children}
    </Callout>
  );
}
