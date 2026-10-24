@echo off
cd /d "%~dp0"
title Avant-Premiere
REM Le port par defaut est 4321. Si PORT est change dans .env, ce lanceur ne le suit pas.
curl -s -o nul -f http://localhost:4321/api/today
if not errorlevel 1 (
  echo Avant-Premiere est deja lance, ouverture du navigateur.
  start "" http://localhost:4321
  goto :eof
)
if not exist .env (
  copy .env.example .env >nul
  echo Premier lancement : colle tes cles TMDB et OMDb dans le fichier qui s'ouvre,
  echo enregistre-le, puis relance Avant-Premiere.
  start "" notepad .env
  echo.
  echo Appuie sur une touche pour fermer cette fenetre.
  pause >nul
  goto :eof
)
"node\node.exe" server.mjs --open || goto :erreur
goto :eof
:erreur
echo.
echo Une erreur est survenue. Lis le message ci-dessus, puis appuie sur une touche.
pause >nul
