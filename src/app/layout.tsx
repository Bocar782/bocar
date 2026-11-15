import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

const TITLE = "Lia — Transforme n'importe quel sujet en formation sur mesure";
const DESCRIPTION =
  "Lia est une plateforme d'apprentissage assistée par IA : décris ce que tu veux apprendre, elle génère une formation complète, structurée et personnalisée, avec exemples, cas pratiques et quiz.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: TITLE, template: "%s · Lia" },
  description: DESCRIPTION,
  keywords: [
    "formation en ligne IA",
    "apprentissage personnalisé",
    "générateur de cours",
    "e-learning IA",
    "Lia",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "Lia",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
