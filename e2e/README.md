# Suite E2E Playwright (Prompt 05.18)

## Limitation d'environnement constatée (pas une prudence : un fait vérifié)

Cette session de développement (conteneur cloud) a un accès réseau sortant
filtré : seuls certains hôtes sont autorisés (`api.anthropic.com`, les
registres de paquets, etc.). **Le projet Supabase réel configuré dans
`.env.local` (`NEXT_PUBLIC_SUPABASE_URL`) n'en fait pas partie** — vérifié
directement :

```
$ NODE_USE_ENV_PROXY=1 node --env-file=.env.local -e "fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/health')..."
RequestAbortedError: Proxy response (403) !== 200 when HTTP Tunneling
```

Conséquence directe : **aucune authentification réelle (signup/login) ne
peut réussir dans cette session**, puisque `supabase.auth.signInWithPassword`/
`signUp` appellent ce même hôte, inaccessible. Ce n'est pas un choix de
conception de cette suite — c'est une contrainte dure du bac à sable.

Ce que ça permet malgré tout de tester RÉELLEMENT (vrai navigateur, vrai
`next dev`, vrai code applicatif, zéro mock applicatif) :
- Toutes les pages publiques (rendu, responsive, navigation).
- Le rendu des pages d'authentification et leur validation CÔTÉ CLIENT
  (longueur de mot de passe, confirmation) — ces vérifications s'exécutent
  avant tout appel réseau.
- La protection des pages privées pour un **utilisateur non connecté** :
  chaque page protégée appelle `supabase.auth.getUser()`, qui ne lève
  jamais d'exception sur échec réseau (le SDK Supabase renvoie
  `{ user: null }`) — la redirection vers `/login` qui s'ensuit est
  exactement le même code qui s'exécute pour un VRAI utilisateur non
  connecté. C'est donc un test réel de ce comportement précis, même s'il
  est obtenu indirectement.
- Le comportement de dégradation d'une tentative de connexion/inscription
  qui échoue techniquement (message générique affiché, jamais de crash ni
  de détail technique exposé) — démontré, mais via UNE cause d'échec
  (réseau) différente de celle qu'un vrai utilisateur rencontrerait le plus
  souvent (mauvais mot de passe). Les deux passent par le même code
  (`translateAuthError`), mais ce fichier ne prouve que le chemin
  générique, pas le message spécifique "Email ou mot de passe incorrect."
  (déjà couvert par un test unitaire direct si besoin).

Ce que cette suite NE PEUT PAS tester ici, et qui nécessite une vraie
connectivité Supabase (CI, ou la machine du développeur) :
- Toute session réellement authentifiée (dashboard rempli, lecture de
  formation, quiz, chat, abonnement Pro, etc.).
- Les parcours où ces sections détaillent un comportement spécifique à un
  compte Free/Pro réellement connecté.

Ces parcours sont couverts autrement dans ce dépôt — par de vrais tests
Vitest qui importent et exécutent le code réel des routes/composants/
fonctions serveur (voir `src/**/__tests__/*.test.ts(x)`) avec seulement les
frontières externes (Supabase, Stripe, Anthropic) mockées, et par de vrais
tests PostgreSQL sur une base locale jetable pour toute la logique SQL
(RLS, RPC). Le rapport de la tâche 05.18 détaille précisément, parcours par
parcours, ce qui relève de chaque catégorie.

## Lancer la suite

```
npm run test:e2e
```

Démarre automatiquement `next dev` (voir `playwright.config.ts`).
