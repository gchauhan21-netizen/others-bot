# Discord hosting bot source bundle

This archive contains the Discord bot service source, its database/API workspace packages, build configuration, and workspace lockfile.

## Required environment variables

Set these through your hosting provider's secret/environment-variable manager. Do not commit their values in source files:

- `DISCORD_BOT_TOKEN`
- `DISCORD_APPLICATION_ID`
- `DATABASE_URL`
- `PORT` (the hosting provider should supply this; use `8080` for local runs)

Optional: set `DISCORD_SERVER_MEMBERS_INTENT_ENABLED=true` only after enabling Server Members Intent in the Discord Developer Portal. This enables partnership representative departure notices.

## Install and run

Use Node.js and pnpm at the workspace root:

```sh
pnpm install
pnpm start
```

The root start script builds and launches the API server and Discord bot. The bot registers `/say`, `/partnership`, and `/free-assets` in the configured Discord server when it starts. Role, server, and destination channel IDs are set in the source files under `artifacts/api-server/src/lib/`.

Never share or upload your bot token. If a token is exposed, reset it in the Discord Developer Portal and update the host's secret.
