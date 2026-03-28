import "dotenv/config";
import { notifyTaskAssigned, notifyMeetingInvite } from "../src/lib/email";

async function main() {
  // Test task assignment with .ics
  console.log("Sending task assignment email with .ics...");
  await notifyTaskAssigned(
    "m@armyofme.ai",
    "Marcos",
    "Review Q2 roadmap document",
    "Army of Me",
    "test-project-id",
    "Claude",
    "2026-04-05",
    "test-task-id"
  );
  console.log("Task email sent!");

  // Test meeting invite with .ics
  console.log("Sending meeting invite email with .ics...");
  await notifyMeetingInvite(
    "m@armyofme.ai",
    "Marcos",
    "Sprint Planning",
    "Army of Me",
    "test-project-id",
    "test-meeting-id",
    "2026-04-01",
    "10:00",
    "11:30",
    "Claude",
    "m@armyofme.ai",
    "Claude",
    [{ name: "Marcos", email: "m@armyofme.ai" }]
  );
  console.log("Meeting email sent!");
}

main().catch(console.error);
