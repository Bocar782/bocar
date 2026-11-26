# Publicité Tavyra (9:16, 1080×1920, 37 s)

Vidéo publicitaire produite avec [Remotion](https://remotion.dev) : chaque scène
est du code React qui reproduit fidèlement l'interface réelle de Tavyra
(tokens de `src/app/globals.css`, composants `src/components/*`, police Geist,
logo et wordmark officiels). Rendu final : `out/tavyra-ad.mp4`.

## Storyboard (30 fps, 120 BPM — 1 temps = 15 frames)

| # | Scène | Temps | Rôle |
|---|-------|-------|------|
| 1 | Hook | 0–3 s | Compteur « 47 onglets ouverts. » → « Et tu n'as toujours rien appris. » |
| 2 | Problème | 3–7 s | Recherche nocturne, infos éparpillées, « Aucun plan. », implosion |
| 3 | Révélation | 7–10 s | Flash, logo + étoile, wordmark, « Le savoir prend forme. » |
| 4 | Démo | 10–18 s | Saisie du sujet → diagnostic → plan proposé → génération (étapes réelles) |
| 5 | Immersion | 18–28 s | Sommaire & progression, chapitre, exercice, quiz & score, chat Tavyra |
| 6 | Désir | 28–32 s | Mur de formations, « Si tu peux le décrire, tu peux l'apprendre. » |
| 7 | CTA | 32–37 s | « 47 onglets ? Un seul suffit. » → logo, CTA, tavyra.netlify.app |

Tous les repères temporels sont dans `src/timing.json`, partagé par la vidéo
et par le générateur audio (synchronisation au frame près).

## Commandes

```bash
npm install
npm run music    # régénère public/audio/soundtrack.wav (Python 3 + numpy + scipy + ffmpeg)
npm run studio   # prévisualisation interactive
npm run render   # exporte out/tavyra-ad.mp4
```

Le rendu utilise le Chromium headless indiqué dans `remotion.config.ts`
(adapter le chemin ou supprimer la ligne pour laisser Remotion télécharger le sien).

## Bande-son

`audio/generate_music.py` compose musique et sound design par synthèse
(aucun sample tiers, donc aucun problème de droits) : tension au hook,
silence avant la révélation, drop à 10 s, montée sur la scène désir,
résolution en do majeur sur le logo. Normalisée à −14 LUFS / −1 dBTP
(standard TikTok/Reels/Shorts).
