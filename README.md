![cyberia](assets/cyberia.gif)

# Cyberia

3D multiplayer browser game. Live at [cyberia.drawvid.com](https://cyberia.drawvid.com).

## Quick Start

```bash
npm install
npm run dev:local   # connects to ws://localhost:7777
```

The worldserver must be running separately. From the `drawvidverse` repo:

```bash
npm run dev:cyberia --workspace=worldserver
```

## Scripts

- `npm run dev:local` — Vite dev server, connects to `ws://localhost:7777`
- `npm run dev:prod` — Vite dev server, connects to `wss://world-cyberia.drawvid.com`
- `npm run build` — Production Vite build to `dist/`

## Deploy

```bash
./deploy.sh
```

Builds with Vite, uploads to S3 (`cyberia-drawvid-frontend-593615615124`), invalidates CloudFront (`EJDZHTYPQ4BNP`).

## Architecture

- **Framework**: Phaser 3 + Three.js (3D rendering)
- **Bundler**: Vite
- **Frontend CDN**: CloudFront → cyberia.drawvid.com
- **World server**: wss://world-cyberia.drawvid.com (nginx → PM2 on Lightsail, port 7777)
- **Auth**: Open access — no JWT required
