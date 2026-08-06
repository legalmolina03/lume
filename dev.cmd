@echo off
rem Launches the Vite dev server from this directory regardless of where it is
rem invoked from. Used by .claude/launch.json.
cd /d "%~dp0"
call npm run dev -- --port 5173 --strictPort
