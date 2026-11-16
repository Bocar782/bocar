// Stub pour les tests (vitest tourne en environnement Node, pas dans le
// bundler Next.js) : le vrai paquet `server-only` lève volontairement une
// erreur à l'import pour empêcher qu'un module serveur fuite dans un
// bundle navigateur — une garantie imposée par le bundler de Next.js, pas
// par Node lui-même. Hors de ce bundler, ce garde-fou n'a pas de sens et
// empêcherait même les tests légitimes d'un module serveur (ex.
// src/lib/anthropic/client.ts) de l'importer. Ce fichier remplace
// `server-only` UNIQUEMENT dans vitest.config.ts (alias), jamais dans le
// build applicatif réel.
export {};
