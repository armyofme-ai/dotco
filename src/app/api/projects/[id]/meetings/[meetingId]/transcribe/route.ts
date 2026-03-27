import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { DeepgramClient } from "@deepgram/sdk";

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

export const maxDuration = 300;

// Generate a unique run ID to prevent zombie writes from old deployments
function generateRunId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function runTranscription(meetingId: string, mediaId: string, audioUrl: string, runId: string) {
  try {
    // Mark meeting as transcribing with this run's ID
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { transcription: `__TRANSCRIBING__${runId}` },
    });

    // Download file and send buffer to Deepgram
    console.log(`[${runId}] Downloading audio from ${audioUrl}...`);
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    console.log(`[${runId}] Downloaded ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB, sending to Deepgram...`);

    const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY! });
    const result = await deepgram.listen.v1.media.transcribeFile(
      audioBuffer,
      {
        model: "nova-3",
        diarize: true,
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        utterances: true,
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const utterances = (result as any)?.results?.utterances ?? [];
    console.log(`[${runId}] Deepgram returned ${utterances.length} utterances`);

    // Reject partial results — an 83-min file should have hundreds of utterances
    if (utterances.length < 5) {
      console.error(`[${runId}] Deepgram returned suspiciously few utterances (${utterances.length}). Rejecting.`);
      // Check we still own this run before clearing
      const current = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { transcription: true } });
      if (current?.transcription === `__TRANSCRIBING__${runId}`) {
        await prisma.meeting.update({
          where: { id: meetingId },
          data: {
            transcription: null,
            transcriptSegments: Prisma.DbNull,
            speakerMap: Prisma.DbNull,
            transcribedMediaId: null,
          },
        });
      }
      return;
    }

    // Verify this run still owns the transcription (prevent zombie writes)
    const current = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { transcription: true },
    });
    if (!current?.transcription?.includes(runId)) {
      console.log(`[${runId}] Another transcription run took over. Aborting save.`);
      return;
    }

    const transcriptSegments: TranscriptSegment[] = utterances.map(
      (u: { speaker: number; transcript: string; start: number; end: number }) => ({
        speaker: `Speaker ${u.speaker}`,
        text: u.transcript,
        startTime: u.start,
        endTime: u.end,
      })
    );

    const transcription = transcriptSegments
      .map((seg) => `${seg.speaker}: ${seg.text}`)
      .join("\n\n");

    const uniqueSpeakers = [...new Set(transcriptSegments.map((seg) => seg.speaker))];
    const speakerMap: Record<string, string> = {};
    uniqueSpeakers.forEach((speaker, index) => {
      speakerMap[speaker] = `Speaker ${index + 1}`;
    });

    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        transcription,
        transcriptSegments: transcriptSegments as unknown as undefined,
        speakerMap: speakerMap as unknown as undefined,
        transcribedMediaId: mediaId,
      },
    });

    console.log(`[${runId}] Transcription complete: ${transcriptSegments.length} segments`);
  } catch (error) {
    console.error(`[${runId}] Transcription failed:`, error);
    // Only clear if we still own this run
    try {
      const current = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { transcription: true } });
      if (current?.transcription?.includes(runId)) {
        await prisma.meeting.update({
          where: { id: meetingId },
          data: {
            transcription: null,
            transcriptSegments: Prisma.DbNull,
            speakerMap: Prisma.DbNull,
            transcribedMediaId: null,
          },
        });
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

// POST - Start transcription
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, meetingId } = await params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting || meeting.projectId !== id) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const body = await request.json();
    const { mediaId } = body;
    if (!mediaId) {
      return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
    }

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media || media.type !== "audio" || media.meetingId !== meetingId) {
      return NextResponse.json({ error: "Invalid audio media" }, { status: 400 });
    }

    const runId = generateRunId();
    after(() => runTranscription(meetingId, mediaId, media.url, runId));

    return NextResponse.json({ status: "transcribing", runId });
  } catch (error) {
    console.error("Error starting transcription:", error);
    return NextResponse.json({ error: "Failed to start transcription" }, { status: 500 });
  }
}

// GET - Check transcription status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { meetingId } = await params;
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { transcription: true, transcriptSegments: true },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (meeting.transcription?.startsWith("__TRANSCRIBING__")) {
      return NextResponse.json({ status: "transcribing" });
    }

    if (meeting.transcriptSegments) {
      return NextResponse.json({ status: "complete" });
    }

    return NextResponse.json({ status: "none" });
  } catch (error) {
    console.error("Error checking transcription:", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
