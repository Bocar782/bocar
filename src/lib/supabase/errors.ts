const KNOWN_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Email ou mot de passe incorrect.",
  "Email not confirmed":
    "Ton email n'est pas encore confirmé. Vérifie ta boîte mail.",
  "User already registered": "Un compte existe déjà avec cet email.",
  "Password should be at least 6 characters":
    "Le mot de passe doit contenir au moins 6 caractères.",
  "Email rate limit exceeded":
    "Trop de tentatives. Réessaie dans quelques minutes.",
  "For security purposes, you can only request this after 60 seconds":
    "Pour des raisons de sécurité, attends une minute avant de réessayer.",
};

export function translateAuthError(message: string): string {
  return KNOWN_MESSAGES[message] ?? "Une erreur est survenue. Réessaie.";
}
