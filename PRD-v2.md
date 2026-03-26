# Dotco v2 — My Meetings & My Tasks

**Version:** 2.0
**Date:** 2026-03-26
**Status:** Draft

---

## 1. Overview

Two new top-level pages accessible from the sidebar: **My Meetings** and **My Tasks**. These give each user a personal, cross-project view of their upcoming work without needing to navigate into individual projects.

---

## 2. Sidebar Navigation (updated)

| Order | Label | Icon | Route | Visibility |
|-------|-------|------|-------|------------|
| 1 | Projects | FolderKanban | `/projects` | All users |
| 2 | My Meetings | Calendar | `/meetings` | All users |
| 3 | My Tasks | CheckSquare | `/tasks` | All users |
| 4 | Settings | Settings | `/settings` | Owner only |

---

## 3. My Meetings (`/meetings`)

A chronological, vertically-scrolling list of all meetings where the current user is an attendee — past and upcoming — grouped by month and day.

### 3.1 Layout

```
March 2026
─────────────────────────────────
  26  Wed   AoM Follow up          10:00–11:00   Tiresias
            Sprint Review          14:00–15:30   Tiresias

April 2026
─────────────────────────────────
   2  Wed   Client Kickoff         09:00–10:00   Project Alpha
   8  Tue   Weekly Standup         09:30–09:45   Tiresias
```

### 3.2 Meeting Card Fields

| Field | Description |
|-------|-------------|
| Day number | Numeric day of the month |
| Day name | Abbreviated weekday (Mon, Tue, ...) |
| Meeting name | Clickable, links to `/projects/[projectId]/meetings/[meetingId]` |
| Time range | `startTime – endTime` |
| Project name | Which project this meeting belongs to, clickable link to `/projects/[projectId]` |

### 3.3 Behavior

- Fetches all meetings where the user is an attendee
- Sorted ascending by date (upcoming first by default)
- Grouped by month (header: "March 2026"), then by day within the month
- Past meetings shown in muted/faded style
- Today's meetings highlighted with a subtle indicator
- Empty state: "No meetings scheduled"
- **"New Meeting" button** in the page header
  - Opens a dialog identical to the project-level create meeting dialog, but with an additional **Project selector** dropdown at the top (user must pick which project the meeting belongs to)
  - Project dropdown only shows projects the user is a member of
  - After creation, the meeting appears in the list immediately

### 3.4 API

**`GET /api/meetings`** — Returns all meetings for the current user (across all projects in the org)
- Joins through `MeetingAttendee` where `userId = session.user.id`
- Includes: meeting fields + project `{id, name}` + attendee count
- Ordered by `date ASC, startTime ASC`

---

## 4. My Tasks (`/tasks`)

A personal task list showing all tasks assigned to the current user across all projects, styled as a to-do checklist.

### 4.1 Layout

```
My Tasks (12)
─────────────────────────────────────────────────────────
☐  Design landing page          Apr 2     Tiresias
☐  API integration docs         Apr 5     Project Alpha
☐  Review PR #42                Apr 8     Tiresias
☑  Set up CI pipeline           Mar 25    Tiresias       ← completed, strikethrough
```

### 4.2 Task Row Fields

| Field | Description |
|-------|-------------|
| Checkbox | Toggle completion (updates task status TODO ↔ DONE) |
| Task title | Name of the task |
| End date | Due date, shown in red if overdue and not completed |
| Project name | Which project this task belongs to, clickable link to `/projects/[projectId]` |

### 4.3 Behavior

- Fetches all tasks where the user is an assignee (via `TaskAssignee`)
- Default sort: incomplete first (by end date ascending), then completed at the bottom
- Completed tasks shown with strikethrough and muted styling
- Overdue indicator: if `endDate < today` and status ≠ DONE, show date in red
- Clicking the task title navigates to the project detail page (Tasks tab)
- Clicking the checkbox toggles status between TODO and DONE via `PATCH /api/projects/[projectId]/tasks/[taskId]`
- Empty state: "No tasks assigned to you"
- **"New Task" button** in the page header
  - Opens a dialog identical to the project-level create task dialog, but with an additional **Project selector** dropdown at the top (user must pick which project the task belongs to)
  - Project dropdown only shows projects the user is a member of
  - The current user is auto-assigned to the task
  - After creation, the task appears in the list immediately

### 4.4 Filters

- **Status filter**: All / Active / Completed
- Shown as simple text toggle buttons above the list

### 4.5 API

**`GET /api/my-tasks`** — Returns all tasks assigned to the current user
- Joins through `TaskAssignee` where `userId = session.user.id`
- Includes: task fields + project `{id, name}`
- Ordered by `status ASC (TODO first), endDate ASC`

---

## 5. Data Model

No schema changes needed. Both features query existing models through their join tables:

- **My Meetings**: `Meeting` → `MeetingAttendee` → `User`
- **My Tasks**: `Task` → `TaskAssignee` → `User`

---

## 6. Files to Create/Modify

### New Files

| File | Description |
|------|-------------|
| `src/app/(dashboard)/meetings/page.tsx` | My Meetings page |
| `src/components/meetings/my-meetings-view.tsx` | Meetings list component |
| `src/app/(dashboard)/tasks/page.tsx` | My Tasks page |
| `src/components/tasks/my-tasks-view.tsx` | Tasks list component |
| `src/app/api/meetings/route.ts` | GET all user's meetings |
| `src/app/api/my-tasks/route.ts` | GET all user's tasks |

### Modified Files

| File | Change |
|------|--------|
| `src/components/sidebar.tsx` | Add Meetings and Tasks nav items |
| `src/components/mobile-sidebar.tsx` | Add Meetings and Tasks nav items |

---

## 7. Design Guidelines

- Follow the existing warm cream/beige theme
- Month headers: uppercase, small, muted text with a thin separator line
- Day grouping: day number prominent, weekday abbreviated and muted
- Meeting cards: minimal, single-line rows — not heavy cards
- Task rows: clean checklist style, no card borders — just subtle row separators
- Both pages should feel lightweight and scannable
- Match font sizes and spacing from the rest of the app (`text-sm` body, `text-lg` headings)
