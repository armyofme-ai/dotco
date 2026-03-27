import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Get all meetings with their media and transcript state
  const meetings = await prisma.meeting.findMany({
    include: { media: true },
  });

  for (const m of meetings) {
    console.log(`\n=== Meeting: ${m.name} (${m.id}) ===`);
    console.log(`  Date: ${m.date}`);
    console.log(`  Transcription: ${m.transcription ? m.transcription.substring(0, 80) + '...' : 'null'}`);
    console.log(`  TranscribedMediaId: ${m.transcribedMediaId}`);
    const segs = m.transcriptSegments as any[] | null;
    console.log(`  Segments: ${segs ? segs.length : 0}`);
    if (segs && segs.length > 0) {
      console.log(`  First seg time: ${segs[0].startTime}s`);
      console.log(`  Last seg time: ${segs[segs.length - 1].endTime}s`);
    }
    console.log(`  Media files:`);
    for (const media of m.media) {
      console.log(`    - ${media.filename} (${media.type}) id=${media.id}`);
      console.log(`      URL: ${media.url.substring(0, 80)}...`);

      // Test if the URL is accessible
      try {
        const res = await fetch(media.url, { method: 'HEAD' });
        console.log(`      Accessible: ${res.status} ${res.statusText}, Content-Length: ${res.headers.get('content-length')}`);
      } catch (e: any) {
        console.log(`      Accessible: FAILED - ${e.message}`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
