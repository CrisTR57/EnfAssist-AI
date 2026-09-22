@echo off
title EnfAssist-AI - Vista previa local
set "PYTHON=C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

echo.
echo Iniciando EnfAssist-AI...
echo.
if not exist "%PYTHON%" (
  echo No se encontro Python para iniciar la app.
  echo Instala Python desde https://www.python.org/downloads/
  pause
  exit /b 1
)

echo Abre esta direccion en el navegador: http://localhost:4174
echo Mantenga esta ventana abierta mientras use la aplicacion.
echo.
"%PYTHON%" -m http.server 4174 --bind 127.0.0.1
echo.
echo El servidor se detuvo o no pudo iniciar.
pause
