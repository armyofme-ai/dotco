import "dotenv/config";
import {
  notifyAddedToProject,
  notifyTaskAssigned,
  notifyMeetingInvite,
  notifyMeetingTranscriptReady,
  notifyMeetingCancelled,
} from "../src/lib/email";

const EMAIL = "marcos.cuevas@me.com";
const NAME = "Marcos";

async function main() {
  console.log(`Sending all notification types to ${EMAIL}...\n`);

  // 1. Added to project
  console.log("1/5 — Added to project...");
  await notifyAddedToProject(
    EMAIL, NAME, "Tiresias", "proj-123", "Bernat"
  );
  console.log("     ✓ Sent\n");

  // 2. Task assigned (with .ics due date)
  console.log("2/5 — Task assigned (with due date)...");
  await notifyTaskAssigned(
    EMAIL, NAME, "Prepare investor pitch deck",
    "Army of Me", "proj-456", "Bernat",
    "2026-04-10", "task-789"
  );
  console.log("     ✓ Sent\n");

  // 3. Meeting invite (with .ics calendar event)
  console.log("3/5 — Meeting invite...");
  await notifyMeetingInvite(
    EMAIL, NAME, "Weekly Standup",
    "Tiresias", "proj-123", "meet-456",
    "2026-04-02", "09:30", "10:00", "Bernat",
    "bernat@example.com", "Bernat",
    [
      { name: "Marcos", email: EMAIL },
      { name: "Bernat", email: "bernat@example.com" },
      { name: "Ana", email: "ana@example.com" },
    ]
  );
  console.log("     ✓ Sent\n");

  // 4. Transcript ready
  console.log("4/5 — Transcript ready...");
  await notifyMeetingTranscriptReady(
    EMAIL, NAME, "Weekly Standup",
    "Tiresias", "proj-123", "meet-456"
  );
  console.log("     ✓ Sent\n");

  // 5. Meeting cancelled (with .ics cancel)
  console.log("5/5 — Meeting cancelled...");
  await notifyMeetingCancelled(
    EMAIL, NAME, "Budget Review",
    "Army of Me", "meet-789",
    "2026-04-05", "14:00", "15:00",
    "bernat@example.com", "Bernat"
  );
  console.log("     ✓ Sent\n");

  console.log("All 5 emails sent! Check marcos.cuevas@me.com");
}

main().catch(console.error);
