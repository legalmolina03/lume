@echo off
rem Serves the production build (including the real service worker) on :4173.
rem Use this to exercise PWA behaviour — the dev server does not register one.
cd /d "%~dp0"
call npm run preview -- --port 4173 --strictPort
