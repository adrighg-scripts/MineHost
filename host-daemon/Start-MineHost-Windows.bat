@echo off
setlocal
chcp 65001 >nul
title MineHost - Windows Server Host
cd /d "%~dp0"

echo ===================================================================
echo   MineHost Server-Host (Windows 10/11 · Auto-Update aktiv)
echo   Dashboard: https://minehost-dashboard.adrilolghg.workers.dev
echo ===================================================================

if not exist "src\index.ts" (
    echo.
    echo [FEHLER] Bitte entpacke die Datei "MineHost_Windows.zip" zuerst
    echo          in einen normalen Ordner ^(Rechtsklick -^> Alle extrahieren^),
    echo          bevor du Start-MineHost-Windows.bat startest!
    echo.
    pause
    exit /b 1
)

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set "NODE_BIN=node"
    goto :run_loop
)

if exist "runtimes\node\node.exe" (
    set "NODE_BIN=runtimes\node\node.exe"
    goto :run_loop
)

echo [MineHost] Lade portable Laufzeitumgebung (Node.js 22 LTS) herunter ...
mkdir "runtimes\node" 2>nul
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip' -OutFile 'runtimes\node.zip'; Expand-Archive -Path 'runtimes\node.zip' -DestinationPath 'runtimes\node_tmp' -Force; Move-Item 'runtimes\node_tmp\node-v22.14.0-win-x64\*' 'runtimes\node\' -Force; Remove-Item 'runtimes\node.zip' -Force; Remove-Item 'runtimes\node_tmp' -Recurse -Force"
set "NODE_BIN=runtimes\node\node.exe"

:run_loop
"%NODE_BIN%" --experimental-strip-types src/index.ts
if %ERRORLEVEL% EQU 42 (
    echo.
    echo [Auto-Update] Starte aktualisierte MineHost-Version ...
    timeout /t 1 /nobreak >nul
    goto :run_loop
)
echo.
pause
