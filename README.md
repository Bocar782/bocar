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

Les règles de contenu vivent dans `src/lib/courses/plan.ts` :

- `FREE_PLAN_COURSE_LIMIT` (1) : nombre de formations qu'un utilisateur
  gratuit peut générer, **à vie** (pas par mois).
- `FREE_PLAN_UNLOCKED_CHAPTERS` (2) : nombre de chapitres accessibles
  normalement dans une formation du plan gratuit.
- `isOnFreePlan(supabase, userId)` : vérifie le vrai statut d'abonnement
  Stripe de l'utilisateur dans la table `subscriptions` (`active` ou
  `trialing` → plan Pro, sinon plan gratuit). Voir la section Stripe
  ci-dessous.
- `getUsageStatus(supabase, userId)` : renvoie `{ isPro, used, limit,
  remaining, resetsAt }` — pour le plan gratuit, `used`/`limit` comptent
  les formations à vie ; pour le plan Pro, elles sont recomptées depuis
  `current_period_start` de l'abonnement (donc remises à zéro à chaque
  renouvellement), et `resetsAt` donne la date du prochain renouvellement.

**Contrôle côté serveur** : `/api/courses/generate` appelle
`getUsageStatus` et renvoie une erreur 403 si `remaining <= 0` (limite à
vie pour le plan gratuit, limite mensuelle réinitialisée à chaque période
de facturation pour le plan Pro) — un appel direct à l'API sans passer par
l'interface ne permet donc pas de la contourner.

**Paywall visuel** (`src/components/course-view.tsx`) : pour une formation
verrouillée, les `FREE_PLAN_UNLOCKED_CHAPTERS` premiers chapitres
s'affichent normalement. Le reste (chapitres suivants, résumé, quiz) est
toujours envoyé au client mais rendu flouté (`blur-sm` + `inert`, donc non
interactif et retiré de l'arbre d'accessibilité) dans un conteneur à
hauteur limitée avec un fondu vers le fond. Juste avant ce flou, une carte
nette (non floutée) annonce combien de chapitres restent à débloquer et
propose un bouton "Débloquer la formation complète" vers `/pricing`
(`src/app/pricing/page.tsx`, page de tarifs avec un plan "Gratuit" et un
plan "Pro" à 9,99€/mois). Le chat (`ChapterChat`) et le suivi de
progression (`ProgressTracker`) reçoivent tous les deux un
`maxChapterIndex` qui les empêche d'aller au-delà du dernier chapitre
débloqué, même si le DOM contient le reste de la formation.

## Paiement : abonnement Pro via Stripe

Un seul plan payant : 9,99€/mois, 3 formations générées par mois (quota
remis à zéro à chaque renouvellement), accès complet à chaque formation.
Abonnement géré par Stripe Checkout + Billing Portal, en mode test.

- **Produit/Price** : créés une fois dans Stripe (voir `STRIPE_PRICE_ID`),
  abonnement mensuel récurrent de 999 centimes (`PRO_PLAN_PRICE_EUR` /
  `PRO_PLAN_MONTHLY_COURSE_LIMIT` dans `src/lib/courses/plan.ts`).
- **`POST /api/stripe/checkout`** (`src/app/api/stripe/checkout/route.ts`) :
  crée (ou réutilise) le customer Stripe de l'utilisateur connecté, ouvre
  une session Stripe Checkout hébergée pour le Price Pro, et redirige
  l'utilisateur dessus. Déclenché par un simple `<form method="POST">`
  (page `/pricing` et dashboard) — fonctionne même sans JavaScript.
- **`POST /api/stripe/webhook`** (`src/app/api/stripe/webhook/route.ts`) :
  vérifie la signature Stripe (`STRIPE_WEBHOOK_SECRET`) et synchronise la
  table `subscriptions` (statut, `current_period_start`,
  `current_period_end`) sur `checkout.session.completed` (paiement réussi)
  et `customer.subscription.created/updated/deleted` (renouvellement,
  passage en impayé, résiliation). Utilise le client Supabase "admin" (clé
  de service, contourne la RLS) car Stripe appelle cette route sans
  session utilisateur.
- **`POST /api/stripe/portal`** (`src/app/api/stripe/portal/route.ts`) :
  ouvre le Stripe Billing Portal (factures, moyen de paiement,
  résiliation) pour le customer Stripe de l'utilisateur connecté. Bouton
  "Gérer mon abonnement" sur `/pricing` et dans le dashboard.
- **Table `subscriptions`** (migrations `0004_subscriptions.sql` et
  `0005_subscription_period.sql`) : un abonnement par utilisateur, lu par
  `isOnFreePlan()` / `getUsageStatus()`. RLS : l'utilisateur peut lire son
  propre statut, seule la route webhook (clé de service) peut écrire.

**Sécurité des clés** : la clé secrète Stripe n'est jamais stockée en
clair dans ce projet. Dans cet environnement de développement, elle est
injectée automatiquement par le proxy réseau sur les appels vers
`api.stripe.com` (`.env.local` ne contient qu'un placeholder,
`STRIPE_SECRET_KEY=sk_test_proxy_injected_placeholder`). En production,
remplace-la par la vraie clé secrète directement dans les variables
d'environnement de la plateforme de déploiement (jamais dans un fichier
commité, jamais collée dans un chat). Le secret de signature du webhook
(`STRIPE_WEBHOOK_SECRET`) suit la même règle : à renseigner uniquement en
production, une fois l'endpoint webhook créé dans le dashboard Stripe avec
l'URL publique du déploiement. Seule la clé **publiable**
(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) est, par nature, destinée à être
publique.

Le SDK Stripe (basé sur `fetch`) a besoin de
`NODE_USE_ENV_PROXY=1` (déjà dans `.env.local`) pour passer par le proxy
réseau de cet environnement de développement — sans effet en production.

## Analyse approfondie (réservée au plan Pro)

En plus de la génération de formation classique, le dashboard propose une
**analyse approfondie** : plutôt qu'un cours structuré en chapitres, elle
étudie plusieurs cas réels (parcours d'entrepreneurs, entreprises,
investisseurs, stratégies, réussites et échecs) en lien avec un sujet,
avec recherche web et sources citées — un contenu plus long et plus
recherché qu'une formation classique, et donc plus coûteux à générer.

- **`src/lib/analysis/generate.ts`** : pipeline en 4 étapes, sur le modèle
  du pipeline de formation (`src/lib/courses/generate.ts`) :
  1. **Cadrage** (`scopeAnalysis`) : titre, domaine, introduction, angle de
     recherche, nombre de cas à analyser (4 à 7) et requêtes de recherche
     web distinctes et complémentaires (succès, échecs, stratégies,
     données chiffrées — pas uniquement des success stories).
  2. **Recherche** (`researchRealCases` + `extractVerifiedCases`) : mène
     plusieurs recherches web réelles (outil `web_search_20260209`,
     jusqu'à 14 recherches), puis extrait les cas réels et vérifiés —
     avec le même filet anti-hallucination que les formations : un cas
     dont l'URL ne correspond à aucune source réellement trouvée est
     écarté. Si moins de 3 cas vérifiés sont trouvés, l'analyse échoue
     plutôt que de produire un contenu non fondé.
  3. **Rédaction** (`writeSection`) : une section détaillée par cas,
     rédigée en parallèle, avec contexte, décisions clés, explication
     causale de la réussite ou de l'échec, et enseignements — plus longue
     et plus analytique qu'un chapitre de formation classique.
  4. **Synthèse** (`writeSynthesis`) : motifs récurrents entre les cas,
     enseignements transversaux.
- **Persistance** : table `deep_analyses` (migration
  `0006_deep_analyses.sql`), contenu stocké en jsonb (lecture seule une
  fois généré, donc pas besoin d'un schéma normalisé comme pour les
  chapitres de formation). RLS : chaque utilisateur ne voit que ses
  propres analyses.
- **`POST /api/analysis/generate`** (streaming NDJSON, même format que
  `/api/courses/generate`) et page de détail
  `/dashboard/analyses/[id]`.
- **Quota, contrôlé côté serveur** (`getAnalysisUsageStatus` dans
  `src/lib/courses/plan.ts`) : réservée au plan Pro
  (`FREE_PLAN_ANALYSIS_LIMIT = 0`), `PRO_PLAN_MONTHLY_ANALYSIS_LIMIT = 2`
  par période de facturation — plus restrictif que les formations
  classiques vu le coût plus élevé (recherche web + génération longue).
  `/api/analysis/generate` renvoie une erreur 403 si le quota est atteint
  ou si l'utilisateur n'est pas sur le plan Pro, indépendamment de ce qui
  est affiché côté client.
- **Dashboard** : `GeneratorTabs` (`src/app/dashboard/generator-tabs.tsx`)
  bascule entre "Formation classique" et "Analyse approfondie" au même
  endroit, avec une section "Mes analyses approfondies" listant les
  analyses déjà générées.

## Landing page

La page `/` (`src/app/page.tsx`) est la vitrine publique, accessible sans
connexion : hero, démonstration visuelle interactive du produit ("wow
effect" — `src/components/marketing/wow-demo.tsx` : le visiteur tape son
propre sujet dans un champ, et l'aperçu de la formation générée
(domaine, titre, chapitres, exemple, quiz) s'adapte en direct parmi une
poignée de préréglages reconnus par mots-clés — **purement simulé côté
client, aucun appel API**, pour que ce soit immédiat et gratuit à servir
à chaque visiteur), exemples de sujets, avantages, un comparatif "Lia vs
chatbot vs cours en ligne" (`comparison-table.tsx`), une présentation de
l'interface (mockups en CSS/HTML, pas de vraies captures d'écran, pour
rester léger et cohérent avec le design system), avis clients
(**placeholders explicitement labellisés comme fictifs** — badge visible
+ mention sous chaque avis, à remplacer par de vrais avis après le
lancement), tarifs (section condensée qui reflète les vraies constantes
de `src/lib/courses/plan.ts`, donc toujours synchronisée avec le plan
réellement facturé), FAQ (accordéon, dont le contenu alimente aussi des
données structurées FAQPage pour le SEO — voir plus bas), et un CTA
final. Les sections apparaissent avec une légère animation au scroll
(`src/components/marketing/reveal.tsx`, IntersectionObserver + filet de
sécurité qui force l'affichage après 1,5s si l'observer ne se déclenche
pas, pour qu'aucun contenu ne reste invisible).

Une page séparée, `/pourquoi-nous` (accessible depuis le footer et la nav
du header), explique le problème de l'apprentissage traditionnel, notre
vision de l'apprentissage assisté par IA, et pourquoi ce produit existe.

Le header (`src/components/site-header.tsx`) bascule vers un menu mobile
(hamburger) en dessous de `lg:` (1024px) : avec le nombre de liens de
navigation actuels, un breakpoint `md:` (768px) provoquait un
chevauchement du logo sur tablette — testé visuellement et corrigé.

**Preuve sociale** : le chiffre "+5 000 utilisateurs" du hero est un
placeholder, à remplacer par un vrai chiffre avant la mise en ligne
publique.

### Branding

- **Marque** (`src/components/brand-mark.tsx`) : trois barres ascendantes
  dans un carré à dégradé bleu/violet (progression pédagogique), utilisée
  partout à la place d'un simple "L" — header, dashboard, `/pricing`,
  pages d'authentification. Déclinée en favicon (`src/app/icon.svg`),
  icône iOS (`apple-icon.tsx`) et image de partage Open Graph
  (`opengraph-image.tsx`, générée avec `next/og`, référencée par défaut
  dans les métadonnées de `layout.tsx` pour toutes les pages).
- **Icônes** (`src/components/marketing/icons.tsx`) : set de pictogrammes
  SVG dessinés sur-mesure (trait, 1.6px, couleurs de la marque) pour les
  sections Avantages et Exemples de sujets, à la place d'emojis.
- **Fond vivant** (`globals.css`) : les halos d'arrière-plan dérivent très
  lentement (`aurora-drift-a/b`), un grain subtil casse l'effet "dégradé
  plat" (`.grain-overlay`), et certaines sections ont une teinte de fond
  légèrement différente (`.section-tint-violet` / `.section-tint-blue`)
  pour rythmer le scroll. Tout est désactivé sous
  `prefers-reduced-motion`.
- **CTA magnétiques** (`src/components/marketing/magnetic-button.tsx`) :
  les boutons principaux suivent légèrement le curseur et affichent une
  lueur qui le suit, au survol.
- **Header** : sticky (reste visible au scroll, CTA toujours à portée de
  main) et surligne le lien de nav correspondant à la section visible
  (`use-active-section.ts`, IntersectionObserver — s'efface simplement
  sur les pages sans ces sections, comme `/pourquoi-nous`).
- **SEO** : métadonnées complètes dans `layout.tsx` (Open Graph, Twitter
  Card, `metadataBase`, canonical) et données structurées JSON-LD sur la
  page d'accueil (`SoftwareApplication` + `FAQPage`, cette dernière
  alimentée par les mêmes données que l'accordéon FAQ —
  `src/components/marketing/faq-data.ts`).
