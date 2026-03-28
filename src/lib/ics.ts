function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toLocalDateTime(date: string, time: string): string {
  // date is "YYYY-MM-DD", time is "HH:mm" — local time, NOT UTC
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

function nowStamp(): string {
  const d = new Date();
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

interface MeetingIcsParams {
  uid: string;
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  organizer: { name: string; email: string };
  attendees: { name: string; email: string }[];
  url: string;
}

export function generateMeetingIcs(params: MeetingIcsParams): string {
  const {
    uid,
    title,
    description,
    startDate,
    startTime,
    endTime,
    timezone,
    organizer,
    attendees,
    url,
  } = params;

  const dt = toLocalDateTime(startDate, startTime);
  const dtEnd = toLocalDateTime(startDate, endTime);
  const stamp = nowStamp();
  const tz = timezone || "Europe/Madrid";

  const attendeeLines = attendees
    .map(
      (a) =>
        `ATTENDEE;CN=${a.name};RSVP=TRUE:mailto:${a.email}`
    )
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dotco//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${tz}:${dt}`,
    `DTEND;TZID=${tz}:${dtEnd}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `ORGANIZER;CN=${organizer.name}:mailto:${organizer.email}`,
    attendeeLines,
    `URL:${url}`,
    "SEQUENCE:0",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

interface MeetingCancelIcsParams {
  uid: string;
  title: string;
  startDate: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  organizer: { name: string; email: string };
  attendees: { name: string; email: string }[];
}

export function generateMeetingCancelIcs(
  params: MeetingCancelIcsParams
): string {
  const { uid, title, startDate, startTime, endTime, timezone, organizer, attendees } =
    params;

  const dt = toLocalDateTime(startDate, startTime);
  const dtEnd = toLocalDateTime(startDate, endTime);
  const stamp = nowStamp();
  const tz = timezone || "Europe/Madrid";

  const attendeeLines = attendees
    .map(
      (a) =>
        `ATTENDEE;CN=${a.name}:mailto:${a.email}`
    )
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dotco//EN",
    "METHOD:CANCEL",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${tz}:${dt}`,
    `DTEND;TZID=${tz}:${dtEnd}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `ORGANIZER;CN=${organizer.name}:mailto:${organizer.email}`,
    attendeeLines,
    "SEQUENCE:1",
    "STATUS:CANCELLED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

interface TaskIcsParams {
  uid: string;
  title: string;
  description: string;
  dueDate: string;
  url: string;
}

export function generateTaskIcs(params: TaskIcsParams): string {
  const { uid, title, description, dueDate, url } = params;

  const stamp = nowStamp();
  // All-day event: use DATE value type (YYYYMMDD)
  const dtStart = dueDate.replace(/-/g, "");
  // All-day event ends the next day
  const nextDay = new Date(dueDate + "T00:00:00Z");
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const dtEnd = nextDay.toISOString().slice(0, 10).replace(/-/g, "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dotco//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
