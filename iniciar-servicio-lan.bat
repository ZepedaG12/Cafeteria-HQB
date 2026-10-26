@echo off
title VitaliMarket y Cafe - Servicio Web en Red Local (LAN)
cd /d "%~dp0"
echo =========================================================
echo   VITALIMARKET ^& CAFE - SERVICIO WEB HOSPITALARIO (LAN)
echo =========================================================
echo.
if not exist ".next\BUILD_ID" (
  echo Compilando version optimizada de produccion por primera vez...
  call npm run build
)
echo.
echo Direcciones IP de esta computadora para conectarse desde celulares/tablets en la misma red Wi-Fi/LAN:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=*" %%b in ("%%a") do (
    echo   -^> http://%%b:3000
  )
)
echo.
echo Iniciando servidor en el puerto 3000...
call npm run start
pause
