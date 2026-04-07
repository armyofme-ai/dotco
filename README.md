# Dotco

Open-source meeting intelligence platform for teams. Record meetings, transcribe with speaker diarization, generate AI-powered summaries and action items, and connect your team's knowledge to AI assistants via MCP.

## Features

- Meeting recording & transcription (Deepgram Nova-3, auto language detection)
- AI-powered meeting summaries with strategic analysis (GPT-4o)
- Automatic action item extraction with assignee detection
- Calendar integration (.ics invites for Google Calendar, Outlook, Apple Calendar)
- Project & task management
- Email notifications for meetings, tasks, and transcripts
- MCP server for Claude integration (10 read-only tools)
- Speaker diarization with member assignment and voice memory
- Multi-language support (auto-detected)

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+ (or use Docker)
- API keys for: [OpenAI](https://platform.openai.com/api-keys), [Deepgram](https://console.deepgram.com)
- Optional: [Resend](https://resend.com/api-keys) for email notifications

### Setup

1. Clone and install:
   ```bash
   git clone https://github.com/dotco-ai/dotco.git
   cd dotco
   npm install
   ```

2. Start PostgreSQL:
   ```bash
   docker compose up -d
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

4. Initialize database:
   ```bash
   npx prisma migrate deploy
   ```

5. Start dev server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:3001 -- complete the setup wizard to create your admin account.

> Alternatively, for automated/headless setups, you can use `npx prisma db seed` with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ORG_NAME` environment variables.

> API keys can also be configured in Settings > AI Providers after first login.

## MCP Integration

Dotco includes a built-in MCP server that lets AI assistants (like Claude) access your team's knowledge.

### Claude Code
Add to your `.mcp.json`:
```json
{
  "mcpServers": {
    "dotco": {
      "type": "url",
      "url": "https://your-dotco-instance.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Claude Desktop
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "dotco": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-dotco-instance.com/api/mcp",
        "--header",
        "Authorization: Bearer YOUR_API_KEY"
      ]
    }
  }
}
```

Generate API keys in Settings > API Keys.

## Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Farmyofme-ai%2Fdotco&env=DATABASE_URL,AUTH_SECRET,AUTH_URL,NEXT_PUBLIC_APP_URL&envDescription=See%20DEPLOYMENT.md%20for%20details&project-name=dotco)

Dotco runs anywhere that supports Node.js 20+ and PostgreSQL. See **[DEPLOYMENT.md](DEPLOYMENT.md)** for full instructions covering:

- **Vercel** (one-click or CLI)
- **Railway**
- **Render**
- **Fly.io**
- **Docker Compose** (any VPS — DigitalOcean, Hetzner, Linode, AWS EC2)
- **Coolify** (self-hosted PaaS)
- **AWS** (App Runner / ECS)
- **DigitalOcean App Platform**

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js (credentials)
- **UI**: shadcn/ui, Tailwind CSS
- **Transcription**: Deepgram Nova-3
- **AI**: OpenAI GPT-4o (configurable)
- **Email**: Resend
- **Storage**: Vercel Blob / local filesystem
- **Deployment**: Vercel (recommended) or any Node.js host

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth secret (`openssl rand -base64 32`) |
| `AUTH_URL` | Yes | App URL (e.g. `http://localhost:3001`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL |
| `OPENAI_API_KEY` | No* | OpenAI API key for summaries |
| `DEEPGRAM_API_KEY` | No* | Deepgram API key for transcription |
| `RESEND_API_KEY` | No | Resend API key for emails |
| `BLOBPRO_READ_WRITE_TOKEN` | No | Vercel Blob token (production only) |

*Can be configured via Settings > AI Providers instead of env vars.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
