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
- **Anthropic API** (`@anthropic-ai/sdk`) pour la génération des formations
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
  lib/anthropic/
    client.ts           # Client Anthropic — serveur uniquement
  proxy.ts             # Rafraîchit la session Supabase à chaque requête (anciennement middleware.ts)
```

## Variables d'environnement

Voir `.env.example`. `SUPABASE_SECRET_KEY` et `ANTHROPIC_API_KEY` ne doivent
jamais être préfixées par `NEXT_PUBLIC_` ni importées en dehors de
`src/lib/supabase/admin.ts` / `src/lib/anthropic/` (côté serveur
uniquement, protégé par `server-only`) : la première contourne les policies
RLS, la seconde est facturée à l'usage sur votre compte Anthropic.

## Authentification

Email/mot de passe via Supabase Auth (`@supabase/ssr`, Server Actions).

- `/login`, `/signup` — redirigent vers `/dashboard` si une session existe déjà
- `/dashboard` — protégée, redirige vers `/login` si aucune session
- `/forgot-password` → email de réinitialisation → `/auth/callback` (échange
  le code contre une session) → `/update-password`
- `/auth/callback` gère aussi le lien de confirmation d'inscription

Pour que les liens envoyés par email fonctionnent, dans le dashboard
Supabase (Authentication → URL Configuration), ajouter à la liste des
**Redirect URLs** :

```
http://localhost:3000/auth/callback
https://<votre-domaine-de-prod>/auth/callback
```

## Chat avec Lia

Un chat contextuel est accessible depuis la page d'une formation
(`/dashboard/formations/[id]` et la vue juste après génération) via un
bouton flottant. Il est bâti sur :

- `src/lib/courses/chat-context.ts` — construit le prompt système à partir
  de la formation et du chapitre actuel (fonction pure, sans appel réseau)
- `src/components/chapter-chat.tsx` — widget client : repère le chapitre
  visible à l'écran avec un `IntersectionObserver`, envoie la conversation
  à `/api/chat` et affiche la réponse au fur et à mesure qu'elle arrive
- `src/app/api/chat/route.ts` — appelle `claude-opus-5-5` en streaming,
  sans persistance : l'historique vit dans l'état React du navigateur et
  est renvoyé à chaque tour (API sans état)

## Quiz final

Chaque formation se termine par un quiz de 10 questions à choix multiples,
généré en même temps que le résumé (`writeQuiz` dans
`src/lib/courses/generate.ts`) à partir du contenu réel des chapitres
uniquement — jamais de connaissance externe. Persisté dans
`course_quiz_questions` (migration `0002_quiz.sql`). Interface
(`src/components/quiz-view.tsx`) : question par question, score final,
explication par question (bonne réponse justifiée, qu'on se soit trompé
ou non), filtre pour ne revoir que ses erreurs, et possibilité de
refaire le quiz.

## Dashboard : mes formations, progression, utilisation

- **Mes formations** (`src/components/course-list-item.tsx`) : liste des
  formations de l'utilisateur, triées par dernière consultation. Chaque
  carte affiche son statut (pas commencée / en cours / terminée), une
  barre de progression, le chapitre actuel et le score du quiz s'il a été
  fait. Le bouton "Continuer" (ou "Commencer") renvoie directement sur
  `/dashboard/formations/[id]#chapitre-N`, à l'endroit exact où la
  lecture s'était arrêtée.
- **Progression** : `src/lib/use-current-chapter.ts` (hook partagé avec
  le chat) détecte le chapitre visible à l'écran ; `progress-tracker.tsx`
  l'enregistre en base (debounce de 1,5 s) via les Server Actions de
  `src/lib/courses/progress-actions.ts`, qui enregistrent aussi le score
  du quiz une fois terminé. Colonnes ajoutées par la migration
  `0003_progress.sql`.
- **Utilisation** : affiche le nombre de formations générées par
  l'utilisateur. Voir la section "Plan gratuit & paywall" ci-dessous pour
  la limite appliquée.

## Plan gratuit & paywall

Tout le monde est actuellement sur le plan gratuit (il n'existe pas encore
de système d'abonnement — pas de Stripe, pas de table "plan"). Les règles
vivent dans `src/lib/courses/plan.ts` :

- `FREE_PLAN_COURSE_LIMIT` (1) : nombre de formations qu'un utilisateur
  gratuit peut générer, **à vie** (pas par mois). `isOnFreePlan()` est le
  point unique à modifier le jour où un vrai plan payant existera.
- `FREE_PLAN_UNLOCKED_CHAPTERS` (2) : nombre de chapitres accessibles
  normalement dans une formation du plan gratuit.

**Contrôle côté serveur** : `/api/courses/generate` compte le nombre total
de formations déjà générées par l'utilisateur
(`countTotalGenerations` dans `src/lib/courses/persist.ts`) et renvoie une
erreur 403 si la limite est atteinte — un appel direct à l'API sans passer
par l'interface ne permet donc pas de la contourner.

**Paywall visuel** (`src/components/course-view.tsx`) : pour une formation
verrouillée, les `FREE_PLAN_UNLOCKED_CHAPTERS` premiers chapitres
s'affichent normalement. Le reste (chapitres suivants, résumé, quiz) est
toujours envoyé au client mais rendu flouté (`blur-sm` + `inert`, donc non
interactif et retiré de l'arbre d'accessibilité) dans un conteneur à
hauteur limitée avec un fondu vers le fond. Juste avant ce flou, une carte
nette (non floutée) annonce combien de chapitres restent à débloquer et
propose un bouton "Débloquer la formation complète" vers `/tarifs`
(`src/app/tarifs/page.tsx`, page de tarifs avec un plan "Gratuit" et un
plan "Pro" marqué "Bientôt disponible" — aucun paiement réel n'est encore
branché). Le chat (`ChapterChat`) et le suivi de progression
(`ProgressTracker`) reçoivent tous les deux un `maxChapterIndex` qui les
empêche d'aller au-delà du dernier chapitre débloqué, même si le DOM
contient le reste de la formation.
