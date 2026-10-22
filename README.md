# Avant-Première

Préparer l'émission cinéma du mardi et piloter l'affichage dans OBS, depuis un seul outil.

## Installation (une seule fois)

1. Installer **Node.js LTS** depuis https://nodejs.org (version 22 ou plus récente).
2. Créer un compte gratuit sur https://www.themoviedb.org, puis aller dans **Paramètres → API** et demander une clé (usage personnel).
3. Dans le dossier de Avant-Première, copier `.env.example` en `.env` et coller la clé après `TMDB_API_KEY=`. La « Clé d'API » et le « Jeton d'accès en lecture » fonctionnent tous les deux. Dans le Bloc-notes, choisir « Tous les fichiers » à l'enregistrement pour que le fichier s'appelle bien `.env` et non `.env.txt`.
4. Faire un clic droit sur `Avant-Premiere.bat` → **Envoyer vers → Bureau (créer un raccourci)**.

## Utilisation

- Double-cliquer sur le raccourci **Avant-Premiere** : une fenêtre noire s'ouvre (ne pas la fermer pendant l'utilisation), puis la page de préparation s'affiche dans le navigateur.
- **Préparation** (http://localhost:4321) :
  - cocher les films à traiter ;
  - les ordonner avec les flèches ;
  - écrire ses notes, qui s'enregistrent automatiquement.
- **Régie** (http://localhost:4321/regie) :
  - pendant le live, `→` et `←` changent de film ;
  - les touches `1` à `3` choisissent l'affichage : fiche, bande-annonce, masquer.

## Configurer OBS

1. Dans la scène du live, ajouter une source **Navigateur**.
2. Renseigner :
   - URL : `http://localhost:4321/overlay`
   - Largeur `1920`, hauteur `1080`
3. Cocher **Contrôler l'audio via OBS**, sinon le son des bandes-annonces ne passe pas dans le stream.
4. Placer cette source au-dessus de la caméra. Son fond est transparent.

## Checklist avant le premier live

- [ ] Le voyant de la régie indique **OBS connecté**.
- [ ] En mode **Bande-annonce**, le son s'entend dans le moniteur audio d'OBS, et la fiche revient à la fin.
- [ ] Après avoir fermé et rouvert OBS, l'affichage revient tout seul.
- [ ] Après avoir fermé et relancé Avant-Première, la régie reprend sur le même film.

## En cas de souci

| Message | Que faire |
|---|---|
| « Aucune clé TMDB » | Vérifier le fichier `.env`, puis relancer Avant-Première. |
| « La clé TMDB est refusée » | Recopier la clé depuis le site TMDB, sans espace. |
| « TMDB ne répond pas » | Réessayer dans un instant ; les films déjà préparés restent utilisables. |
| « Le port 4321 est déjà utilisé » | Avant-Première est sûrement déjà ouvert : aller sur http://localhost:4321. |

## Pour le développement

```bash
npm install
npm run dev        # serveur + interface avec rechargement automatique (http://localhost:5173)
npm test           # tests
npm run typecheck  # vérification des types
npm run build      # construit l'interface dans dist/web
npm start          # lance la version construite (http://localhost:4321)
```

Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.
