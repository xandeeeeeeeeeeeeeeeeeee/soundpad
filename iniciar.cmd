@echo off
cd /d "%~dp0"
start "Grimoire" http://127.0.0.1:3210
node server.mjs
pause
