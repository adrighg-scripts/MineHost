@echo off
setlocal
chcp 65001 >nul
title MineHost - Windows Server Host
cd /d "%~dp0"

echo ===================================================================
echo   MineHost Server-Host (Windows 10/11)
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
    node --experimental-strip-types src/index.ts
    echo.
    pause
    goto :eof
)

if exist "runtimes\node\node.exe" (
    "runtimes\node\node.exe" --experimental-strip-types src/index.ts
    echo.
    pause
    goto :eof
)

echo [MineHost] Lade portable Laufzeitumgebung (Node.js 22 LTS) herunter ...
mkdir "runtimes\node" 2>nul
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip' -OutFile 'runtimes\node.zip'; Expand-Archive -Path 'runtimes\node.zip' -DestinationPath 'runtimes\node_tmp' -Force; Move-Item 'runtimes\node_tmp\node-v22.14.0-win-x64\*' 'runtimes\node\' -Force; Remove-Item 'runtimes\node.zip' -Force; Remove-Item 'runtimes\node_tmp' -Recurse -Force"

"runtimes\node\node.exe" --experimental-strip-types src/index.ts
echo.
pause
