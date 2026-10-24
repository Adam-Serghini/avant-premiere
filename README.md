# Avant-Première

Préparer l'émission cinéma du mardi et piloter l'affichage dans OBS, depuis un seul outil.

## Installation (une seule fois)

1. Installer **Node.js LTS** depuis https://nodejs.org (version 22 ou plus récente).
2. Créer un compte gratuit sur https://www.themoviedb.org, puis aller dans **Paramètres → API** et demander une clé (usage personnel).
3. Dans le dossier de Avant-Première, copier `.env.example` en `.env` et coller la clé après `TMDB_API_KEY=`. La « Clé d'API » et le « Jeton d'accès en lecture » fonctionnent tous les deux. Dans le Bloc-notes, choisir « Tous les fichiers » à l'enregistrement pour que le fichier s'appelle bien `.env` et non `.env.txt`.
4. (Facultatif, pour afficher les notes IMDb, Rotten Tomatoes et Metacritic) Créer une clé gratuite sur https://www.omdbapi.com/apikey.aspx (formule gratuite), puis la coller après `OMDB_API_KEY=` dans le fichier `.env`. Sans cette clé, les notes ne s'affichent simplement pas.
5. Faire un clic droit sur `Avant-Premiere.bat` → **Envoyer vers → Bureau (créer un raccourci)**.

## Utilisation

- Double-cliquer sur le raccourci **Avant-Premiere** : une fenêtre noire s'ouvre (ne pas la fermer pendant l'utilisation), puis la page de préparation s'affiche dans le navigateur.
- **Préparation** (http://localhost:4321) :
  - cocher les films à traiter ;
  - les ordonner avec les flèches ;
  - écrire ses notes, qui s'enregistrent automatiquement ;
  - pas sur TMDB ? créer la fiche à la main ; « Utiliser une autre affiche » et « Vidéo de l'ordinateur » ajoutent ses propres fichiers (rangés dans `data/media/`). Pour les vidéos de l'ordinateur, préférer le MP4 en H.264 : c'est le format le plus sûr dans OBS.
- **Régie** (http://localhost:4321/regie) :
  - pendant le live, par défaut, `→` et `←` changent de film ;
  - par défaut, les touches `1` à `3` choisissent l'affichage : fiche, bande-annonce, masquer ;
  - le bouton **Raccourcis** permet de changer ces touches.

## Intégrer à la scène React d'OBS

L'overlay se place dans le grand cadre de gauche de la scène **React**, au-dessus de la capture du bureau. Rien d'autre ne change dans les scènes.

1. Lancer Avant-Première.
2. Dans OBS, sélectionner la scène **React**, puis dans **Sources** : **+** → **Navigateur**. Nom : « Avant-Première ».
3. Renseigner :
   - URL : `http://localhost:4321/overlay`
   - Largeur `1250`, hauteur `725` (ajuster à la taille exacte du cadre)
   - cocher **Contrôler l'audio via OBS**
4. Dans la liste des sources, placer « Avant-Première » **au-dessus** de la capture du bureau.
5. Dans l'aperçu, déplacer la source pour qu'elle recouvre exactement l'intérieur du cadre doré.
6. Pour s'entendre pendant les tests : **Édition → Propriétés audio avancées**, ligne « Avant-Première », colonne **Monitoring audio** → **Monitoring et sortie**.

En mode **Masqué**, l'overlay est transparent : le bureau réapparaît.

## Checklist avant le premier live

- [ ] Le voyant de la régie indique **OBS connecté**.
- [ ] En mode **Bande-annonce**, le son s'entend dans le moniteur audio d'OBS, et la fiche revient à la fin.
- [ ] Après avoir fermé et rouvert OBS, l'affichage revient tout seul.
- [ ] Après avoir fermé et relancé Avant-Première, la régie reprend sur le même film.
- [ ] La fiche remplit exactement le cadre de gauche de la scène React.

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
npm run pack       # fabrique release/Avant-Premiere.zip, prêt à l'emploi sous Windows (Node portable compris)
```

Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.
