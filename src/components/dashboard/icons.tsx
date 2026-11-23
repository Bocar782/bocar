import type { SVGProps } from "react";

// Jeu d'icônes dédié à la navigation/l'intérieur du SaaS (Prompt 06.1) —
// même style que src/components/marketing/icons.tsx (trait 1.6, coins
// arrondis) pour rester visuellement cohérent, mais regroupé séparément
// car ce sont des pictogrammes d'interface (nav, actions), pas de
// marketing.
function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  );
}

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v8.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V10" />
      <path d="M10 20v-5.5h4V20" />
    </Base>
  );
}

export function IconLibrary(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M5 4.5h4v15H5z" />
      <path d="M11 4.5h4v15h-4z" />
      <path d="M17.2 5 20 19l-3.9.7L13.3 5.7Z" />
    </Base>
  );
}

export function IconPlusCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Base>
  );
}

export function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </Base>
  );
}

export function IconLogout(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M9 20H6.5A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4H9" />
      <path d="M14 16l4.5-4-4.5-4" />
      <path d="M18.5 12H9.5" />
    </Base>
  );
}

export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
    </Base>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </Base>
  );
}

export function IconFlame(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 3c1 2.4-0.5 3.7-1.8 5C8.8 9.4 7.5 11 7.5 13.5a4.5 4.5 0 0 0 9 0c0-1.6-.6-2.6-1.3-3.6.3 1.3-.1 2.3-1 2.8.4-2-1-3-1.5-4.7C12.4 6.8 13 5 12 3Z" />
    </Base>
  );
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3 20 20" />
    </Base>
  );
}

export function IconSun(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2.5M12 18.5V21M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M3 12h2.5M18.5 12H21M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </Base>
  );
}

export function IconMoon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M20 14.3A8.5 8.5 0 1 1 9.7 4a7 7 0 0 0 10.3 10.3Z" />
    </Base>
  );
}

// Prompt 06.13 : icônes pour la page /dashboard/parametres (identifiant,
// sécurité, facturation).
export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6" />
    </Base>
  );
}

export function IconMail(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </Base>
  );
}

export function IconLock(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Base>
  );
}

export function IconCreditCard(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.2" />
      <path d="M2.5 10h19" />
      <path d="M6 14.5h4" />
    </Base>
  );
}
