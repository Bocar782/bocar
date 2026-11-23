import type { SVGProps } from "react";

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="22"
      height="22"
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

export function IconTarget(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconBrain(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M9 4.5a2.5 2.5 0 0 0-2.5 2.5v.3A2.7 2.7 0 0 0 5 9.8v.9a2.7 2.7 0 0 0 1 2.1v.7a3 3 0 0 0 3 3h0" />
      <path d="M15 4.5a2.5 2.5 0 0 1 2.5 2.5v.3a2.7 2.7 0 0 1 1.5 2.5v.9a2.7 2.7 0 0 1-1 2.1v.7a3 3 0 0 1-3 3h0" />
      <path d="M9 4.5A2.5 2.5 0 0 1 11.5 7v10a3 3 0 0 1-3 3" />
      <path d="M15 4.5A2.5 2.5 0 0 0 12.5 7" />
    </Base>
  );
}

export function IconExample(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3 20 20" />
    </Base>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <path d="M8.5 12.5l2.3 2.3L16 9.5" />
    </Base>
  );
}

export function IconChat(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" />
    </Base>
  );
}

export function IconTelescope(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 15.5 16.5 6l2 2.8L6 19.5Z" />
      <path d="M9.5 12.8 7 19.5" />
      <path d="M13 8.3l2.3 3.2" />
      <circle cx="18.5" cy="5.5" r="1.4" />
    </Base>
  );
}

export function IconRocket(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 3c2.8 1.6 4.5 4.6 4.5 8.5 0 1.7-.3 3-.8 4l-3.7 3.5-3.7-3.5c-.5-1-.8-2.3-.8-4C7.5 7.6 9.2 4.6 12 3Z" />
      <circle cx="12" cy="10.5" r="1.8" />
      <path d="M8.2 16 5 19.5M15.8 16 19 19.5" />
    </Base>
  );
}

export function IconCart(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 5h2l2 11h9.5l1.5-7H7" />
      <circle cx="10" cy="19" r="1.3" />
      <circle cx="17" cy="19" r="1.3" />
    </Base>
  );
}

export function IconChartLine(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 19.5h16" />
      <path d="M5 16l4-5 3.5 3L19 7" />
      <path d="M15 7h4v4" />
    </Base>
  );
}

export function IconMegaphone(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H7l1 4h2l-.8-4H11l7.5 4V5L11 9H5.5A1.5 1.5 0 0 0 4 10Z" />
    </Base>
  );
}

export function IconLandmark(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 20.5h16" />
      <path d="M5.5 20V11M9.5 20V11M14.5 20V11M18.5 20V11" />
      <path d="M3 11l9-5.5L21 11Z" />
    </Base>
  );
}

export function IconAtom(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="8.5" ry="3.2" />
      <ellipse cx="12" cy="12" rx="8.5" ry="3.2" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="8.5" ry="3.2" transform="rotate(120 12 12)" />
    </Base>
  );
}

export function IconGraduationCap(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14Z" />
      <path d="M6.5 11.8v4c0 1 2.5 2.2 5.5 2.2s5.5-1.2 5.5-2.2v-4" />
      <path d="M21.5 9.5v5" />
    </Base>
  );
}

// Prompt 06.13 : badges de réassurance (sans carte bancaire, paiement
// sécurisé, résiliation libre) près du CTA et des tarifs.
export function IconShieldCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 3.5 5 6v5.5c0 4.2 3 7.2 7 9 4-1.8 7-4.8 7-9V6Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </Base>
  );
}

export function IconCreditCardOff(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.2" />
      <path d="M2.5 10h19" />
      <path d="M6 14.5h4" />
    </Base>
  );
}

export function IconRefreshCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 10.5a4 4 0 0 1 6.7-1.8l1.3 1.3" />
      <path d="M15.5 13.5a4 4 0 0 1-6.7 1.8l-1.3-1.3" />
      <path d="M16.3 8.5v2h-2M7.7 15.5v-2h2" />
    </Base>
  );
}
