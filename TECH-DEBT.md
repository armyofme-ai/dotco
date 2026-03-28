# Tech Debt

## Calendar RSVP & "Respuesta no válida" Gmail warning

**Status:** Open
**Priority:** Medium
**Added:** 2026-03-28

### Problem
Gmail shows "Respuesta no válida" (Invalid response) on meeting invite emails because the sender (`notifications@armyofme.ai`) doesn't match the ORGANIZER field in the .ics file (the actual meeting creator's email). Gmail can't route RSVP replies (Accept/Decline/Maybe) back to the organizer through our notification address.

### Current behavior
- Calendar events are created correctly with proper times, attendees, and organizer
- The warning is cosmetic — no functional impact on event creation
- Attendees can't RSVP through their email client

### Ideal solution
Set up **Resend Inbound** to receive emails at `notifications@armyofme.ai`:
1. Configure Resend inbound webhook for `notifications@armyofme.ai`
2. Create a webhook endpoint in Dotco (`/api/webhooks/rsvp`) to process incoming RSVP emails
3. Parse the iCalendar RSVP response to extract acceptance status
4. Update the meeting attendance status in the database
5. Optionally notify the organizer of accepted/declined responses

### Quick alternative
Use the meeting creator's actual email as ORGANIZER in the .ics. Gmail will send RSVPs directly to them (bypassing Dotco). The "Respuesta no válida" warning disappears, but Dotco won't track attendance status.

### Files involved
- `src/lib/ics.ts` — ORGANIZER field generation
- `src/lib/email.ts` — `notifyMeetingInvite`, `notifyMeetingCancelled`
- `src/app/api/projects/[id]/meetings/route.ts` — passes organizer info
- `src/app/api/projects/[id]/meetings/[meetingId]/route.ts` — passes organizer info
