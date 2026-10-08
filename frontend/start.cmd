@echo off
rem Запуск дев-сервера реестра архитектуры (Vite 5, Node 20).
rem Используется npm.cmd — чтобы не зависеть от политики выполнения PowerShell.
cd /d "%~dp0"
call nvm use 20.18.0 >nul 2>&1
echo Node: & node --version
call npm.cmd run dev
