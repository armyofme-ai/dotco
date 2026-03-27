import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log("=== ALL MEETINGS ===");
  const meetings = await prisma.meeting.findMany({
    include: { media: true, meetingPoints: true, nextSteps: true, attendees: true },
  });
  for (const m of meetings) {
    console.log(`  Meeting: "${m.name}" id=${m.id} project=${m.projectId}`);
    console.log(`    transcription: ${m.transcription ? `"${m.transcription.substring(0, 60)}..."` : 'null'}`);
    console.log(`    transcribedMediaId: ${m.transcribedMediaId}`);
    console.log(`    segments: ${(m.transcriptSegments as any[])?.length ?? 0}`);
    console.log(`    speakerMap: ${JSON.stringify(m.speakerMap)}`);
    console.log(`    summary: ${m.summary ? `"${m.summary.substring(0, 60)}..."` : 'null'}`);
    console.log(`    media: ${m.media.length}`);
    for (const media of m.media) {
      console.log(`      media: id=${media.id} type=${media.type} file="${media.filename}" url=${media.url.substring(0, 80)}`);
    }
    console.log(`    points: ${m.meetingPoints.length}, steps: ${m.nextSteps.length}, attendees: ${m.attendees.length}`);
  }

  console.log("\n=== ALL MEDIA (including orphaned) ===");
  const allMedia = await prisma.media.findMany();
  for (const m of allMedia) {
    const meetingExists = meetings.some(mt => mt.id === m.meetingId);
    console.log(`  media: id=${m.id} meeting=${m.meetingId} ${meetingExists ? '' : '*** ORPHANED ***'} type=${m.type} file="${m.filename}"`);
    console.log(`    url: ${m.url}`);
  }

  console.log("\n=== ALL PROJECTS ===");
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  for (const p of projects) {
    console.log(`  project: id=${p.id} name="${p.name}"`);
  }

  console.log("\n=== ALL TASKS (checking for orphaned meeting tasks) ===");
  const tasks = await prisma.task.findMany({ select: { id: true, title: true, description: true, projectId: true } });
  for (const t of tasks) {
    if (t.description?.startsWith("Generated from meeting")) {
      console.log(`  task: id=${t.id} title="${t.title.substring(0, 60)}" desc="${t.description}" project=${t.projectId}`);
    }
  }

  console.log("\n=== BLOB CHECK ===");
  // List all blob URLs referenced in media
  const blobUrls = allMedia.filter(m => m.url.includes("blob.vercel-storage.com")).map(m => m.url);
  console.log(`  Blob URLs in DB: ${blobUrls.length}`);
  for (const url of blobUrls) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      console.log(`  ${res.status} ${url.substring(0, 80)}`);
    } catch {
      console.log(`  FAILED ${url.substring(0, 80)}`);
    }
  }

  // Check for any local filesystem URLs (from old code)
  const localUrls = allMedia.filter(m => m.url.startsWith("/uploads/"));
  console.log(`  Local filesystem URLs in DB: ${localUrls.length}`);
  for (const m of localUrls) {
    console.log(`    ${m.url} (meeting=${m.meetingId}, file="${m.filename}")`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
