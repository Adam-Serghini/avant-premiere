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
if not exist node_modules\.package-lock.json (
  echo Installation des dependances, patiente un peu...
  call npm install || goto :erreur
)
echo Preparation de l'interface...
call npm run build || goto :erreur
call npm start -- --open || goto :erreur
goto :eof
:erreur
echo.
echo Une erreur est survenue. Lis le message ci-dessus, puis appuie sur une touche.
pause >nul
