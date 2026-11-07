# Custom Discord Bot

This service runs the Discord bot and the API server together. The bot registers
`/say` and `/partnership` directly in the configured SHR server when it starts.

## Start on an external host

Run `pnpm start` from the workspace root. The root start script builds this
service and then launches its compiled entry point. The host must install the
workspace dependencies and provide the required environment variables below.

## Required secrets

Add these in Replit Secrets:

- `DISCORD_BOT_TOKEN` — the token from your Discord Developer Portal bot page
- `DISCORD_APPLICATION_ID` — the application ID from General Information

Never paste the bot token into source files, chat, or logs. If it is exposed,
reset it in the Discord Developer Portal and update the Replit Secret.

## Invite the bot to a server

In the Discord Developer Portal, open your application’s Installation settings.
Enable the **Guild Install** context and generate an install link with both
`bot` and `applications.commands` scopes and the `Send Messages` bot
permission. Open the link and select your server. Confirm that the bot account
appears in the server’s member list. The bot needs permission to send messages
in any channel where `/say` will be used.

No privileged message-content intent is required.

## Use `/say`

After the service starts, Discord receives a server-install `/say` command with
a required `message` field. Command updates can take a little while to appear.
Only members who have the `[SHR] Management Team` role can use it. Access is
checked by role ID, so only that exact server role is accepted.
The bot sends the requested text in the current channel, with mention parsing
disabled so `@everyone` and role names do not ping people.

The message is limited to Discord’s 2,000-character message size.

## Partnership logs

Use `/partnership` and provide the representative from the Discord user picker
and the advertisement text. The advertisement is posted in an embed to
the configured partnership channel, pinging role `1563817849993039981` and the
selected representative. The representative ID and advertisement are stored
internally in PostgreSQL for tracking, but numeric IDs aren't displayed in
channel messages. Members with either the management role or the Staff Team
role can use this command.

When a tracked representative leaves, the bot posts one notice in
the channel where that partnership was logged and pings the management role.
The bot must be able to view and send messages in the configured partnership
channel. For either role ping to notify members, the target role must be
mentionable or the bot must have permission to mention roles.

Departure detection is disabled until both of these are done:

1. Enable **Server Members Intent** in the Discord Developer Portal under
   **Bot → Privileged Gateway Intents**.
2. Set `DISCORD_SERVER_MEMBERS_INTENT_ENABLED=true` in the Replit environment
   and restart the API Server workflow.
