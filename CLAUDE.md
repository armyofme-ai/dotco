# Dotco Development Guide

## Stack
- Next.js 15 (App Router, TypeScript, src/ directory)
- PostgreSQL + Prisma ORM
- shadcn/ui + Tailwind CSS
- Deepgram (transcription), OpenAI (summarization), Resend (email)

## Key patterns
- Auth: `auth()` from `@/lib/auth`
- Database: `prisma` from `@/lib/prisma`
- AI config: `getAIConfig()`, `getDeepgramKey()` from `@/lib/ai-config`
- Background tasks: `after()` from `next/server` for async processing
- Email: fire-and-forget with `.catch(console.error)`
- Speaker utils: `resolveSpeakerName()`, `parseSpeakerMap()` from `@/lib/speaker-utils`

## Development
```bash
docker compose up -d    # Start PostgreSQL
npm run dev             # Start dev server on port 3001
npx prisma studio       # Database GUI
```

<!-- MEMORY:START -->
# dotco

_Last updated: 2026-03-31 | 0 active memories, 0 total_

_For deeper context, use memory_search, memory_related, or memory_ask tools._
<!-- MEMORY:END -->
