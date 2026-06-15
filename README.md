# BanCannon

A Discord bot that lets a user "fire" a ban command with daily usage limits and optional server upgrades.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with your bot token:

```env
BOT_TOKEN=your-discord-bot-token
PORT=3000
```

3. Start the bot:

```bash
npm start
```

## Commands

- `!bancannon @user`
- `!bantier redeem YOURCODE`
- `!bantier status`
- `!redneckcheck`

## Hosting

This bot should be hosted on an always-on Node.js service. Good options are:

- Railway
- Fly.io
- Render web service
- A small VPS like DigitalOcean, Hetzner, or AWS Lightsail

For the easiest deployment, use a host that supports a long-running Node process and exposes a `PORT`. This project now includes a small `/healthz` endpoint for platforms that want a web process.

## Notes

- Keep `BOT_TOKEN` private.
- The JSON files in the repo root store bans, extra codes, and extra guild access.
- Make sure the bot has the Discord permissions it needs, especially `Ban Members`.
