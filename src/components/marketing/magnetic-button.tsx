"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";

const PULL = 10; // déplacement maximal, en pixels

/**
 * CTA avec deux micro-interactions au survol : une légère attraction vers le
 * curseur ("magnétique") et une lueur qui suit sa position. Purement
 * cosmétique — se désactive avec prefers-reduced-motion (voir globals.css).
 */
export function MagneticButton({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  function handleMouseMove(event: MouseEvent<HTMLAnchorElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = event.clientX - rect.left;
    const relY = event.clientY - rect.top;

    el.style.setProperty("--mx", `${(relX / rect.width) * 100}%`);
    el.style.setProperty("--my", `${(relY / rect.height) * 100}%`);

    const offsetX = ((relX - rect.width / 2) / (rect.width / 2)) * PULL;
    const offsetY = ((relY - rect.height / 2) / (rect.height / 2)) * PULL;
    el.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  }

  function handleMouseLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "translate(0, 0)";
  }

  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`magnetic-btn ${className}`}
    >
      {children}
    </Link>
  );
}
