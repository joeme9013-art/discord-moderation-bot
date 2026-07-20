# Discord Moderation Bot

A fully-featured Discord moderation bot with an automatic credit system, role promotion/demotion, inactivity detection, mod logging, and user feedback.

## Features

- **Moderation Logging** — all bans, kicks, timeouts, and manual warns are automatically logged with credits awarded
- **Credit System** — moderators earn credits per action (ban: 10, kick: 5, timeout: 3, warn: 2, positive feedback: 5)
- **Auto Role Promotion** — when a mod hits a credit threshold, the bot automatically assigns the next role
- **Auto Demotion** — inactive moderators receive warnings and are eventually demoted if they stay inactive
- **Moderator Profiles** — full stats per moderator (credits, rank, action history, feedback)
- **User Feedback** — users can submit positive/negative feedback about moderators

## Role Hierarchy (configure with `/setuproles`)

| Tier | Role Name | Default Credits |
|------|-----------|----------------|
| 0 | Trial Moderator | 0 |
| 1 | Moderator | 50 |
| 2 | Senior Moderator | 150 |
| 3 | Head Moderator | 300 |
| 4 | Trial Admin | 500 |
| 5 | Admin | 750 |
| 6 | Senior Admin | 1000 |
| 7 | Head Admin | 1500 |
| 8 | Assistant Server Manager | 2000 |
| 9 | Server Manager | 3000 |

## Slash Commands

| Command | Permission | Description |
|---------|-----------|-------------|
| `/warn @user reason` | Moderator | Warn a user (+2 credits) |
| `/feedback @mod message type` | Everyone | Submit feedback about a moderator |
| `/modlogs [@user]` | Moderator | View moderation log |
| `/warnings view @user` | Moderator | View warnings for a user |
| `/warnings clear id` | Moderator | Clear a warning |
| `/credits [@user]` | Everyone | View credit balance |
| `/leaderboard` | Everyone | Top 10 moderators |
| `/modprofile [@user]` | Moderator | Full moderator stats profile |
| `/demote @user reason` | Admin | Manually demote one tier |
| `/addcredits @user amount` | Admin | Add credits manually |
| `/removecredits @user amount` | Admin | Remove credits manually |
| `/setuproles add/list/remove/clear` | Admin | Configure role thresholds |
| `/setinactivity configure/toggle/status` | Admin | Configure inactivity system |

## Required Bot Permissions

In the Discord Developer Portal, the bot needs:
- **View Audit Log** — to detect bans/kicks/timeouts automatically
- **Manage Roles** — to assign and promote/demote roles
- **Send Messages + Embed Links** — to post log embeds
- **Moderate Members** — to timeout users

**Invite URL:**
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=1099780081798
```
Replace `YOUR_CLIENT_ID` with your bot's application ID.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Your bot token from the Discord Developer Portal |
| `DISCORD_GUILD_ID` | Your server's ID (for slash command registration) |
| `DISCORD_LOG_CHANNEL_ID` | Channel ID where mod logs are posted |
| `DATABASE_URL` | PostgreSQL connection string |

## Running Locally

```bash
# 1. Install dependencies
pnpm install

# 2. Create a .env file (or set env vars) with the variables above

# 3. Push the database schema
pnpm --filter @workspace/db run push

# 4. Start the bot
pnpm --filter @workspace/discord-bot run dev
```

## Deploying on Render

### Step 1: Create a new Web Service on Render
1. Go to [render.com](https://render.com) and sign up / log in
2. Click **New → Web Service**
3. Connect your GitHub repository

### Step 2: Configure the service
- **Name:** `discord-moderation-bot`
- **Runtime:** Node
- **Build Command:** `npm install -g pnpm && pnpm install`
- **Start Command:** `pnpm --filter @workspace/discord-bot run start`
- **Instance Type:** Free (or Starter for always-on)

### Step 3: Add environment variables
In the Render dashboard, go to **Environment** and add:
- `DISCORD_BOT_TOKEN` — your bot token
- `DISCORD_GUILD_ID` — your server ID
- `DISCORD_LOG_CHANNEL_ID` — your log channel ID
- `DATABASE_URL` — your PostgreSQL URL (see Step 4)

### Step 4: Create a PostgreSQL database
1. In Render, click **New → PostgreSQL**
2. Name it `discord-bot-db`, use the **Free** plan
3. Copy the **External Database URL** and paste it as `DATABASE_URL`

### Step 5: Run database migrations
After your first deploy, open the Render shell and run:
```bash
pnpm --filter @workspace/db run push
```
Or add it to the build command: `npm install -g pnpm && pnpm install && pnpm --filter @workspace/db run push`

### Step 6: Invite the bot
Use the invite URL in the "Required Bot Permissions" section above, replacing `YOUR_CLIENT_ID` with your app's ID from the Discord Developer Portal.

### Important: Privileged Intents
If you want the bot to cache server members (optional, for better performance), go to the **Discord Developer Portal → Your App → Bot → Privileged Gateway Intents** and enable **Server Members Intent**.

### Free Tier Note
Render's free tier spins down web services after 15 minutes of inactivity. The bot includes a health-check HTTP server on `PORT` to help keep it alive. For 24/7 uptime, upgrade to the **Starter** plan (~$7/month).
