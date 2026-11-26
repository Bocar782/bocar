import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { IconChat, IconTelescope } from "@/components/marketing/icons";
import { IconLibrary, IconPlusCircle } from "./icons";

type Action = {
  label: string;
  description: string;
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  pro?: boolean;
};

// Raccourcis vers les fonctions réelles de l'app. Pour un compte gratuit,
// l'analyse approfondie (réservée au Pro) mène au paiement, badge à l'appui.
export function QuickActions({ locked }: { locked: boolean }) {
  const actions: Action[] = [
    {
      label: "Nouvelle formation",
      description: "Décris un sujet, Tavyra construit le reste",
      href: "/dashboard/creer",
      Icon: IconPlusCircle,
    },
    {
      label: "Assistant",
      description: "Pose une question sur tes formations",
      href: "/dashboard/assistant",
      Icon: IconChat,
    },
    {
      label: "Analyse approfondie",
      description: "Étude détaillée de cas réels, avec sources",
      href: locked ? "/checkout" : "/dashboard/creer",
      Icon: IconTelescope,
      pro: locked,
    },
    {
      label: "Bibliothèque",
      description: "Toutes tes formations au même endroit",
      href: "/dashboard/formations",
      Icon: IconLibrary,
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {actions.map((action, i) => (
        <Link
          key={action.label}
          href={action.href}
          className="rise lift group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border-subtle bg-background-card/80 p-4 sm:p-5"
          style={{ ["--d" as string]: `${60 + i * 60}ms` }}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="bg-brand flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_20px_-10px_var(--glow)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
              <action.Icon width={19} height={19} />
            </span>
            {action.pro && (
              <span className="bg-brand rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Pro
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{action.label}</p>
            <p className="mt-0.5 hidden text-xs text-foreground-muted sm:block">
              {action.description}
            </p>
          </div>
        </Link>
      ))}
    </section>
  );
}
