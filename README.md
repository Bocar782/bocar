# Lia

Lia est une plateforme d'apprentissage assistée par IA : l'utilisateur décrit ce qu'il veut apprendre, et Lia génère une formation complète, structurée et personnalisée (chapitres, exemples, cas pratiques, quiz).

Ce dépôt contient le frontend de la plateforme, construit avec Next.js (App Router, TypeScript) et Tailwind CSS.

## Démarrer en local

```bash
npm install
cp .env.example .env.local # renseigner les clés Supabase (dashboard → Project Settings → API)
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**
- **Supabase** (base de données, auth) via `@supabase/ssr`
- Police [Geist](https://vercel.com/font)

## Structure

```
src/
  app/                # Routes (App Router), layout global, styles
  components/         # Composants UI réutilisables
  lib/supabase/
    client.ts         # Client navigateur (Client Components)
    server.ts          # Client serveur (Server Components / Actions, respecte la session + RLS)
    admin.ts            # Client privilégié, clé secrète — serveur uniquement
  proxy.ts             # Rafraîchit la session Supabase à chaque requête (anciennement middleware.ts)
```

## Variables d'environnement

Voir `.env.example`. `SUPABASE_SECRET_KEY` ne doit jamais être préfixée par
`NEXT_PUBLIC_` ni utilisée ailleurs que dans `src/lib/supabase/admin.ts`
(côté serveur uniquement) : elle contourne les policies RLS.
