# Online Students ID Replacement System

This repository contains the production web client and the in-progress Windows Electron desktop build.

## Desktop prerequisites

- Node.js 22+
- Windows 10/11 x64 for native packaging

## Desktop commands

```bash
npm install
npm test
npm run prepare:icon
npm start
npm run build:win
```

The desktop renderer is bundled locally and continues using the existing Supabase backend. Staff verification remains protected by Cloudflare Turnstile through the production GitHub Pages hostname.
