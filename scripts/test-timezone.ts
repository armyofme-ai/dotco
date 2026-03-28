import "dotenv/config";
import { notifyMeetingInvite } from "../src/lib/email";

async function main() {
  console.log("Sending meeting invite with timezone fix...");
  await notifyMeetingInvite(
    "marcos.cuevas@me.com",
    "Marcos",
    "Timezone Test Meeting",
    "Tiresias",
    "proj-123",
    "meet-tz-test",
    "2026-04-02",
    "09:30",
    "10:00",
    "Bernat",
    "bernat@example.com",
    "Bernat",
    [
      { name: "Marcos", email: "marcos.cuevas@me.com" },
      { name: "Bernat", email: "bernat@example.com" },
    ]
  );
  console.log("Sent! Check calendar — should show 09:30-10:00 in your local time.");
}

main().catch(console.error);
