import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Prompt 05.27 : serif d'affichage pour les grands titres de la landing
// (voir --font-display dans globals.css). `display: "swap"` + un repli
// système explicite évitent tout texte invisible et tout blocage de build
// si Google Fonts est injoignable au build (le build échoue sinon, voir
// vérification ci-dessous).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  display: "swap",
  fallback: ["Georgia", "serif"],
});

const TITLE = "Tavyra — Transforme n'importe quel sujet en formation sur mesure";
const DESCRIPTION =
  "Tavyra est une plateforme d'apprentissage assistée par IA : décris ce que tu veux apprendre, elle génère une formation complète, structurée et personnalisée, avec exemples, cas pratiques et quiz.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: TITLE, template: "%s · Tavyra" },
  description: DESCRIPTION,
  keywords: [
    "formation en ligne IA",
    "apprentissage personnalisé",
    "générateur de cours",
    "e-learning IA",
    "Tavyra",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "Tavyra",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
