import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeepgramClient } from "@deepgram/sdk";

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

export const maxDuration = 300;

async function runTranscription(meetingId: string, mediaId: string, audioUrl: string) {
  try {
    // Mark meeting as "transcribing"
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { transcription: "__TRANSCRIBING__" },
    });

    // Download file and send buffer to Deepgram (more reliable than URL for large files)
    console.log(`Downloading audio from ${audioUrl}...`);
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    console.log(`Downloaded ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB, sending to Deepgram...`);

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
    const resultAny = result as any;
    const utterances = resultAny?.results?.utterances ?? [];
    console.log(`Deepgram returned ${utterances.length} utterances`);

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

    console.log(`Transcription complete for meeting ${meetingId}: ${transcriptSegments.length} segments`);
  } catch (error) {
    console.error(`Transcription failed for meeting ${meetingId}:`, error);
    // Clear the transcribing marker on failure
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { transcription: null },
    }).catch(() => {});
  }
}

// POST - Start transcription (returns immediately, runs in background)
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

    // Run transcription in the background after response is sent
    after(() => runTranscription(meetingId, mediaId, media.url));

    return NextResponse.json({ status: "transcribing" });
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

    if (meeting.transcription === "__TRANSCRIBING__") {
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
