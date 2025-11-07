@echo off
cd server
if not exist .env (
    copy .env.example .env
)
echo Starting Nimbus Server...
node src/index.js

