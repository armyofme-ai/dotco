import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Find meetings with orphaned transcript data
  const meetings = await prisma.meeting.findMany({
    include: { media: true },
  });

  for (const meeting of meetings) {
    const hasTranscript = meeting.transcriptSegments !== null;
    const hasAudio = meeting.media.some((m) => m.type === "audio");
    const transcribedMedia = meeting.transcribedMediaId
      ? meeting.media.find((m) => m.id === meeting.transcribedMediaId)
      : null;

    console.log(`Meeting: ${meeting.name}`);
    console.log(`  Audio files: ${meeting.media.filter(m => m.type === "audio").length}`);
    console.log(`  Has transcript: ${hasTranscript}`);
    console.log(`  TranscribedMediaId: ${meeting.transcribedMediaId}`);
    console.log(`  Transcribed media exists: ${!!transcribedMedia}`);

    // If transcript references a media that doesn't exist, clear it
    if (hasTranscript && meeting.transcribedMediaId && !transcribedMedia) {
      console.log(`  → Clearing orphaned transcript`);
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          transcription: null,
          transcriptSegments: Prisma.DbNull,
          speakerMap: Prisma.DbNull,
          transcribedMediaId: null,
          summary: null,
        },
      });
      await prisma.meetingPoint.deleteMany({ where: { meetingId: meeting.id } });
      await prisma.nextStep.deleteMany({ where: { meetingId: meeting.id } });
      console.log(`  → Cleaned`);
    }

    // If has transcript but no transcribedMediaId set, also clear (old data)
    if (hasTranscript && !meeting.transcribedMediaId) {
      console.log(`  → Clearing legacy transcript (no transcribedMediaId)`);
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          transcription: null,
          transcriptSegments: Prisma.DbNull,
          speakerMap: Prisma.DbNull,
          transcribedMediaId: null,
          summary: null,
        },
      });
      await prisma.meetingPoint.deleteMany({ where: { meetingId: meeting.id } });
      await prisma.nextStep.deleteMany({ where: { meetingId: meeting.id } });
      console.log(`  → Cleaned`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
