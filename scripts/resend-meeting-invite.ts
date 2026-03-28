import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { notifyMeetingInvite } from "../src/lib/email";

async function main() {
  const prodUrl = process.env.DATABASE_URL;
  if (!prodUrl) throw new Error("DATABASE_URL not set");

  const adapter = new PrismaPg({ connectionString: prodUrl });
  const prisma = new PrismaClient({ adapter });

  // Get the meeting with attendees and project
  const meetings = await prisma.meeting.findMany({
    include: {
      attendees: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      project: {
        select: { name: true, organizationId: true },
      },
    },
  });

  for (const meeting of meetings) {
    const org = await prisma.organization.findUnique({
      where: { id: meeting.project.organizationId },
      select: { timezone: true },
    });

    const dateStr = meeting.date.toISOString();
    const attendeesList = meeting.attendees
      .filter((a) => a.user.email)
      .map((a) => ({ name: a.user.name || "there", email: a.user.email }));

    console.log(`\nMeeting: ${meeting.name}`);
    console.log(`  Date: ${dateStr} | ${meeting.startTime}-${meeting.endTime}`);
    console.log(`  Project: ${meeting.project.name}`);
    console.log(`  Timezone: ${org?.timezone}`);
    console.log(`  Attendees: ${attendeesList.map((a) => a.email).join(", ")}`);

    for (const attendee of meeting.attendees) {
      if (!attendee.user.email) continue;
      console.log(`  Sending to ${attendee.user.email}...`);
      await notifyMeetingInvite(
        attendee.user.email,
        attendee.user.name || "there",
        meeting.name,
        meeting.project.name,
        meeting.projectId,
        meeting.id,
        dateStr,
        meeting.startTime,
        meeting.endTime,
        "Dotco",
        attendee.user.email, // organizer = first attendee for now
        attendee.user.name || "Dotco",
        attendeesList,
        org?.timezone || undefined
      );
      console.log(`  ✓ Sent`);
    }
  }

  await prisma.$disconnect();
  console.log("\nDone!");
}

main().catch(console.error);
