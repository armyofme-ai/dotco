import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Clear ALL transcript data from all meetings
  const result = await prisma.meeting.updateMany({
    data: {
      transcription: null,
      transcriptSegments: Prisma.DbNull,
      speakerMap: Prisma.DbNull,
      transcribedMediaId: null,
      summary: null,
    },
  });

  console.log(`Cleared transcript data from ${result.count} meetings`);

  // Also clear meeting points and next steps
  const points = await prisma.meetingPoint.deleteMany({});
  const steps = await prisma.nextStep.deleteMany({});
  console.log(`Deleted ${points.count} meeting points, ${steps.count} next steps`);

  await prisma.$disconnect();
}

main().catch(console.error);
