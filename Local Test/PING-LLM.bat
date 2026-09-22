@echo off
setlocal enabledelayedexpansion
title PING LLM // moteur de la carte

:: ============================================================
::  PING-LLM -- moteur sequentiel de la carte 3D (version simple).
::  Teste les sites UN PAR UN via curl, X secondes entre chaque,
::  puis reboucle a l'infini. results.js mis a jour apres CHAQUE
::  site (lu par carte-llm.html).
::
::  2 fichiers a garder ensemble : PING-LLM.bat + carte-llm.html
::
::  NOTE : curl ne suit PAS le proxy Windows (WPAD), donc un site
::  peut apparaitre OUVERT alors que le navigateur le voit bloque.
::  La detection des pages de blocage rattrape une partie des cas.
::
::  CTRL+C pour arreter.
::  AJOUTER UN SITE : 1) une ligne "call :add" plus bas
::                    2) sa position dans carte-llm.html (SITES)
:: ============================================================

if not defined _KEEP (
  set _KEEP=1
  cmd /k ""%~f0""
  exit /b
)

where curl >nul 2>&1
if errorlevel 1 (
  echo curl introuvable. Windows 10 1803+ requis.
  goto :eof
)

for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "R=%ESC%[0m"
set "GRN=%ESC%[1;32m"
set "RED=%ESC%[1;31m"
set "AMB=%ESC%[1;33m"
set "DIM=%ESC%[90m"

echo(
set /a secs=2

set "out=%~dp0results.js"

:: ============================================================
::  LISTE DES SITES  (le NOM doit correspondre a carte-llm.html)
:: ============================================================
set n=0
call :add "CHATGPT"           "https://chatgpt.com"
call :add "GEMINI"            "https://gemini.google.com"
call :add "CLAUDE"            "https://claude.ai"
call :add "META AI"           "https://www.meta.ai"
call :add "PERPLEXITY"        "https://www.perplexity.ai"
call :add "GROK"              "https://grok.com"
call :add "LE CHAT (MISTRAL)" "https://chat.mistral.ai"
call :add "DEEPSEEK"          "https://chat.deepseek.com"
call :add "KIMI"              "https://www.kimi.com"
call :add "MINIMAX"           "https://chat.minimax.io"
call :add "COPILOT"           "https://copilot.microsoft.com"
call :add "MIMO (XIAOMI)"     "https://aistudio.xiaomimimo.com"
call :add "LUMO (PROTON)"     "https://lumo.proton.me"
call :add "EURIA (INFOMANIAK)" "https://euria.infomaniak.com"
call :add "QWEN (ALIBABA)"    "https://chat.qwen.ai"
call :add "COPILOT (GITHUB)"  "https://github.com/copilot"
:: ============================================================

echo(
echo  %DIM%!n! sites -- un ping toutes les !secs! s, en boucle -- CTRL+C pour arreter%R%
echo(
start "" "%~dp0carte-llm.html"

:loop
for /l %%i in (1,1,!n!) do (
  call :test %%i
  timeout /t !secs! /nobreak >nul
)
echo  %DIM%--- tour complet, on reboucle ---%R%
goto :loop


:: ============================================================
::  ROUTINES
:: ============================================================
:add
set /a n+=1
set "NAME%n%=%~1"
set "URL%n%=%~2"
exit /b 0

:test
set "i=%~1"
set "name=!NAME%i%!"
set "url=!URL%i%!"
set "tmp=%TEMP%\llm_body.tmp"
del "%tmp%" >nul 2>&1
set "code=000"
set "t=0"

for /f "tokens=1,2" %%c in ('curl -k -s -m 10 --connect-timeout 6 -L -A "Mozilla/5.0 Chrome/126" -o "%tmp%" -w "%%{http_code} %%{time_total}" "!url!" 2^>nul') do (
  set "code=%%c"
  set "t=%%d"
)
set "t=!t:~0,4!"

set "state=OK"
if "!code!"=="000" set "state=DOWN"
if "!code!"=="407" set "state=WARN"

if not "!state!"=="DOWN" if exist "%tmp%" (
  findstr /i /c:"application blocked" /c:"blocked in accordance" /c:"accordance with company policy" /c:"contact your system administrator" /c:"paloalto" /c:"palo alto" /c:"pan-os" /c:"zscaler" /c:"fortiguard" /c:"fortinet" /c:"forcepoint" /c:"websense" /c:"bluecoat" /c:"netskope" /c:"umbrella" /c:"opendns" /c:"barracuda" /c:"sonicwall" /c:"iboss" /c:"lightspeed" /c:"smoothwall" /c:"access denied" /c:"blocked by" /c:"site bloqu" /c:"page bloqu" /c:"web filter" "%tmp%" >nul 2>&1 && set "state=FILT"
)

set RES%i%={"name":"!name!","state":"!state!","code":"!code!","t":"!t!"}

set "json="
for /l %%j in (1,1,!n!) do if defined RES%%j set json=!json!!RES%%j!,
> "%out%.tmp" echo window.LLM_RESULTS={"ts":"%TIME:~0,8%","last":"!name!","sites":[!json:~0,-1!]};
move /y "%out%.tmp" "%out%" >nul 2>&1

if "!state!"=="OK" (
  echo  %DIM%%TIME:~0,8%%R%  %GRN%OUVERT%R%  !name!  %DIM%http !code!  !t!s%R%
) else if "!state!"=="FILT" (
  echo  %DIM%%TIME:~0,8%%R%  %RED%FILTRE%R%  !name!  %DIM%page de blocage ^(http !code!^)%R%
) else if "!state!"=="WARN" (
  echo  %DIM%%TIME:~0,8%%R%  %AMB%PROXY %R%  !name!  %DIM%authentification requise ^(407^)%R%
) else (
  echo  %DIM%%TIME:~0,8%%R%  %RED%COUPE %R%  !name!  %DIM%aucune reponse%R%
)
del "%tmp%" >nul 2>&1
exit /b 0
