@echo off
title Configurar Red Local (LAN) y Firewall - VitaliMarket
echo Configurando Firewall de Windows y Red Privada para celulares y tablets...
echo.

netsh advfirewall firewall delete rule name="VitaliMarket Cafeteria LAN 3000" >nul 2>&1
netsh advfirewall firewall add rule name="VitaliMarket Cafeteria LAN 3000" dir=in action=allow protocol=TCP localport=3000 profile=any
set FW_RESULT=%errorlevel%

if %FW_RESULT% equ 0 (
  if exist "D:\node.exe" (
    netsh advfirewall firewall delete rule name="VitaliMarket Node LAN" >nul 2>&1
    netsh advfirewall firewall add rule name="VitaliMarket Node LAN" dir=in action=allow program="D:\node.exe" profile=any >nul 2>&1
  )
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetConnectionProfile -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' -or $_.InterfaceAlias -like '*Ethernet*' } | Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue" >nul 2>&1
  echo.
  echo =================================================================
  echo [OK] Firewall y Red Privada configurados exitosamente.
  echo Ya puedes ingresar desde tu celular a: http://192.168.0.24:3000
  echo *(Recuerda estar conectado en el celular a la misma red Wi-Fi)*
  echo =================================================================
) else (
  echo.
  echo [IMPORTANTE] Cierra esta ventana, haz clic derecho sobre:
  echo   abrir-puerto-firewall-lan.bat
  echo y selecciona "Ejecutar como administrador".
)
echo.
pause
