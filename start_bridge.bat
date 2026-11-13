@echo off
title GomLink Spatial - Local AI Agent Bridge
set PYTHONDONTWRITEBYTECODE=1
echo Dang khoi dong GomLink Bridge Server ngam tai http://127.0.0.1:18999 ...
start "" pythonw -B "%~dp0bridge_server.py"
echo Da kich hoat thanh cong! Moi link ban luu se tu dong ghi vao inbox_links.md.
timeout /t 3
