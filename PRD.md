# Dotco - Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-26
**Author:** AoM Product Team
**Status:** Draft

---

## 1. Overview

### 1.1 Product Name

**Dotco** - Corporate Project Management & Collaboration Platform

### 1.2 Vision

Dotco is a corporate application built for Army of Me (AoM) to centralize project management, team collaboration, and meeting documentation in a single, intuitive platform.

### 1.3 Target Users

- AoM internal teams (owners, managers, team members)
- Project stakeholders and collaborators

---

## 2. User Management

### 2.1 Roles

| Role | Description |
|------|-------------|
| **Owner** | Organization administrator. Can invite users, manage settings, and has full access to all features. |
| **Member** | Standard user invited by the Owner. Can participate in projects, tasks, and meetings. |

### 2.2 Invitation Flow

1. Owner navigates to User Management and enters the invitee's email address.
2. System sends an invitation email with a unique, time-limited invitation link.
3. Invitee clicks the link, lands on a registration page, and sets their password.
4. Upon completion, the user is active and can access the platform.

### 2.3 User Profile

Each user has a profile containing:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | Text | Yes | Full name |
| Username | Text | Yes | Unique, alphanumeric + underscores |
| Email | Email | Yes | Unique, set at invitation time |
| Avatar | Image | No | Upload (JPEG, PNG, WebP). Max 5 MB. System generates initials-based avatar as default. |
| Password | Password | Yes | Min 8 characters, must include uppercase, lowercase, number, and special character |

### 2.4 Authentication

- Email + password login
- Password reset via email link
- Session management with JWT tokens
- Automatic session expiration after inactivity (configurable in settings)

---

## 3. Projects

### 3.1 Projects List Page

The main dashboard after login. Displays all projects the user has access to.

#### 3.1.1 List View (Default)

- Table/card layout showing each project's name, status, participant count, and task progress
- Sorting by name, status, creation date, or last updated
- Filtering by status
- Search by project name

#### 3.1.2 Kanban View

- Toggle between List View and Kanban View
- Each column represents a project status
- Project cards can be dragged between columns to update status
- Columns (statuses):

| Status | Description |
|--------|-------------|
| **Backlog** | Not yet started, pending prioritization |
| **Planning** | In the planning/scoping phase |
| **In Progress** | Actively being worked on |
| **On Hold** | Paused temporarily |
| **In Review** | Work completed, under review |
| **Completed** | Finished and delivered |
| **Archived** | No longer active, kept for reference |

### 3.2 Project Detail Page

Accessed by clicking a project from the list.

#### 3.2.1 Project Information

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | Text | Yes | Max 120 characters |
| Description | Rich Text | No | Supports markdown formatting |
| Status | Enum | Yes | One of the statuses defined above |
| Created At | DateTime | Auto | System-generated |
| Updated At | DateTime | Auto | System-generated |

#### 3.2.2 Participants

- List of users assigned to the project
- Owner can add/remove participants from any project
- Participants are selectable from existing platform users

#### 3.2.3 Tabs / Sections

The project detail page is organized into the following sections:

1. **Overview** - Project info, status, participant list
2. **Tasks** - Task list and management
3. **Meetings** - Meeting list and management

---

## 4. Tasks

Tasks belong to a project and represent units of work.

### 4.1 Task Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Title | Text | Yes | Max 200 characters |
| Description | Rich Text | No | Supports markdown |
| Status | Enum | Yes | To Do, In Progress, In Review, Done |
| Start Date | Date | Yes | Must be before or equal to End Date |
| End Date | Date | Yes | Must be after or equal to Start Date |
| Participants | User[] | No | Assigned team members |
| Created At | DateTime | Auto | System-generated |
| Updated At | DateTime | Auto | System-generated |

### 4.2 Task Features

- Create, edit, and delete tasks within a project
- Assign/unassign participants to tasks (from project participants)
- Filter tasks by status, participant, or date range
- Visual indicators for overdue tasks (End Date < today and status != Done)

---

## 5. Meetings

Meetings belong to a project and represent scheduled team sessions.

### 5.1 Meeting Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | Text | Yes | Max 200 characters |
| Date | Date | Yes | Calendar date of the meeting |
| Start Time | Time | Yes | Must be before End Time |
| End Time | Time | Yes | Must be after Start Time |
| Participants | User[] | Yes | At least 1 participant required |
| Agenda | Rich Text | No | Pre-meeting agenda items |
| Media Uploads | File[] | No | Photos (JPEG, PNG, WebP) and audio files (MP3, WAV, M4A). Max 50 MB per file. |
| Transcription | Rich Text | No | Meeting transcription (manual entry or auto-generated from audio) |
| Summary | Rich Text | No | High-level meeting summary |
| Meeting Points | List | No | Key discussion points and decisions made |
| Next Steps | List | No | Action items with optional assignee |

### 5.2 Meeting Features

- Create, edit, and delete meetings within a project
- Add/remove participants (from project participants)
- Upload multiple photos and audio recordings per meeting
- Audio playback directly in the app
- Photo gallery/lightbox view
- Editable transcription field (supports paste from external transcription services)
- Structured next steps with optional assignee linking

### 5.3 Next Steps Item Structure

| Field | Type | Required |
|-------|------|----------|
| Description | Text | Yes |
| Assignee | User | No |
| Due Date | Date | No |
| Completed | Boolean | No |

### 5.4 Meeting Points Item Structure

| Field | Type | Required |
|-------|------|----------|
| Title | Text | Yes |
| Description | Text | No |

---

## 6. Dotco Settings

Organization-level settings managed by the Owner.

### 6.1 General Settings

| Setting | Description |
|---------|-------------|
| Organization Name | Display name for the organization (default: "AoM") |
| Logo | Organization logo upload |
| Timezone | Default timezone for dates and times |

### 6.2 User Management Settings

| Setting | Description |
|---------|-------------|
| Session Timeout | Inactivity period before auto-logout (default: 30 minutes) |
| Invitation Expiry | Time before invitation links expire (default: 7 days) |

### 6.3 Project Settings

| Setting | Description |
|---------|-------------|
| Default Project Status | Status assigned to newly created projects (default: Backlog) |
| Custom Statuses | Ability to rename or reorder project statuses |

---

## 7. Non-Functional Requirements

### 7.1 Performance

- Page load time < 2 seconds on standard connections
- API response time < 500ms for standard operations
- Support up to 100 concurrent users
- File uploads up to 50 MB with progress indicator

### 7.2 Security

- HTTPS enforced on all connections
- Passwords hashed with bcrypt (cost factor 12)
- JWT-based authentication with refresh token rotation
- CSRF protection on all state-changing endpoints
- Rate limiting on authentication endpoints (5 attempts per minute)
- Input sanitization and XSS prevention
- CORS restricted to the application domain

### 7.3 Availability

- 99.9% uptime SLA
- Automated backups (daily database, real-time for file storage)
- Health check endpoint for monitoring

### 7.4 Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatible
- Responsive design (desktop-first, mobile-friendly)

### 7.5 Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

---

## 8. Technical Architecture (Recommended)

### 8.1 Frontend

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui component library
- **State Management:** React Server Components + TanStack Query for client state
- **Forms:** React Hook Form + Zod validation
- **Drag & Drop:** dnd-kit (for Kanban board)
- **Rich Text:** Tiptap editor

### 8.2 Backend

- **Runtime:** Next.js API Routes / Server Actions
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** NextAuth.js (Credentials provider)
- **File Storage:** AWS S3 (or compatible object storage)
- **Email:** Resend (transactional emails for invitations, password resets)

### 8.3 Hosting

- **Platform:** Vercel (optimized for Next.js)
- **Database:** Vercel Postgres or Neon (serverless PostgreSQL)
- **File Storage:** AWS S3 / Cloudflare R2
- **CDN:** Vercel Edge Network (included)
- **Domain:** Custom domain via Vercel

### 8.4 DevOps

- Git-based deployments (push to main = production deploy)
- Preview deployments for pull requests
- Environment variables managed via Vercel dashboard
- Error tracking: Sentry
- Analytics: Vercel Analytics

---

## 9. Data Model (High-Level)

```
Organization
├── Settings
└── Users (Owner, Members)

User
├── Profile (name, username, email, avatar, password)
└── ProjectMemberships

Project
├── name, description, status
├── Participants (Users)
├── Tasks
│   ├── title, description, status, startDate, endDate
│   └── Participants (Users)
└── Meetings
    ├── name, date, startTime, endTime
    ├── Participants (Users)
    ├── agenda
    ├── Media (photos, audio files)
    ├── transcription
    ├── summary
    ├── MeetingPoints (title, description)
    └── NextSteps (description, assignee, dueDate, completed)
```

---

## 10. Pages & Navigation

| Page | Route | Access |
|------|-------|--------|
| Login | `/login` | Public |
| Register (via invite) | `/invite/[token]` | Public |
| Forgot Password | `/forgot-password` | Public |
| Reset Password | `/reset-password/[token]` | Public |
| Projects List | `/projects` | Authenticated |
| Project Detail | `/projects/[id]` | Authenticated (project participant or Owner) |
| Project Tasks | `/projects/[id]/tasks` | Authenticated |
| Project Meetings | `/projects/[id]/meetings` | Authenticated |
| Meeting Detail | `/projects/[id]/meetings/[meetingId]` | Authenticated |
| User Profile | `/profile` | Authenticated |
| Settings | `/settings` | Owner only |
| User Management | `/settings/users` | Owner only |

---

## 11. MVP Scope

### Phase 1 - Core (MVP)

- [x] User authentication (login, registration via invite)
- [x] User profiles
- [x] Owner can invite users
- [x] Projects CRUD
- [x] Projects list view
- [x] Projects Kanban view
- [x] Tasks CRUD with dates and participants
- [x] Meetings CRUD with core fields (name, date, time, participants, agenda)
- [x] Meeting media uploads (photos, audio)
- [x] Meeting transcription, summary, meeting points, next steps
- [x] Organization settings

### Phase 2 - Enhancements (Post-MVP)

- [ ] Real-time notifications (new tasks, meeting invites)
- [ ] Activity log / audit trail
- [ ] Calendar view for tasks and meetings
- [ ] Automatic audio transcription (AI-powered)
- [ ] AI-generated meeting summaries
- [ ] Comments/discussion threads on tasks
- [ ] File attachments on tasks
- [ ] Mobile-optimized PWA
- [ ] Role-based permissions (Admin, Editor, Viewer)
- [ ] Project templates

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| User adoption | 100% of AoM team onboarded within 2 weeks |
| Project visibility | All active projects tracked in Dotco |
| Meeting documentation | 90%+ of meetings have transcriptions/summaries within 24h |
| Task tracking | 80%+ of tasks have accurate status and dates |

---

## 13. Open Questions

1. Should Members be able to create projects, or only the Owner?
2. Are there any integrations needed (Google Calendar, Slack, etc.)?
3. Should there be granular permissions (e.g., some members can only view certain projects)?
4. Is there a preferred language/locale besides English?
5. Should meeting audio transcription be automated (AI) from launch, or manual-first?
