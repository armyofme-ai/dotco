import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { DeepgramClient } from "@deepgram/sdk";
import type { SpeakerEntry } from "@/lib/speaker-utils";
import { getDeepgramKey } from "@/lib/ai-config";

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

async function runTranscription(projectId: string, meetingId: string, mediaId: string, audioUrl: string, runId: string, organizationId: string) {
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

    const deepgramKey = await getDeepgramKey(organizationId);
    if (!deepgramKey) {
      console.error(`[${runId}] No Deepgram API key configured`);
      const current = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { transcription: true } });
      if (current?.transcription?.includes(runId)) {
        await prisma.meeting.update({
          where: { id: meetingId },
          data: {
            transcription: "__FAILED__No Deepgram API key configured. Please set one in Settings > AI Providers.",
            transcriptSegments: Prisma.DbNull,
            speakerMap: Prisma.DbNull,
            transcribedMediaId: null,
          },
        });
      }
      return;
    }
    const deepgram = new DeepgramClient({ apiKey: deepgramKey });
    const result = await deepgram.listen.v1.media.transcribeFile(
      audioBuffer,
      {
        model: "nova-3",
        diarize: true,
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        language: "multi",
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultAny = result as any;
    const words: { word: string; start: number; end: number; speaker: number; punctuated_word: string }[] =
      resultAny?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
    const audioDuration = resultAny?.metadata?.duration ?? 0;
    const detectedLang = resultAny?.results?.channels?.[0]?.detected_language;

    console.log(`[${runId}] Deepgram: ${words.length} words, duration=${audioDuration}s, language=${detectedLang}`);

    if (words.length < 20) {
      console.error(`[${runId}] Insufficient speech: ${words.length} words in ${audioDuration}s`);
      const current = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { transcription: true } });
      if (current?.transcription?.includes(runId)) {
        await prisma.meeting.update({
          where: { id: meetingId },
          data: {
            transcription: `__FAILED__Insufficient speech detected. Only ${words.length} words found in ${Math.round(audioDuration / 60)} minutes of audio. The recording may not contain enough speech.`,
            transcriptSegments: Prisma.DbNull,
            speakerMap: Prisma.DbNull,
            transcribedMediaId: null,
          },
        });
      }
      return;
    }

    // Verify this run still owns the transcription
    const current = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { transcription: true },
    });
    if (!current?.transcription?.includes(runId)) {
      console.log(`[${runId}] Another transcription run took over. Aborting save.`);
      return;
    }

    // Group consecutive words by speaker into segments
    const transcriptSegments: TranscriptSegment[] = [];
    let currentSpeaker = words[0].speaker;
    let currentWords: string[] = [words[0].punctuated_word || words[0].word];
    let segStart = words[0].start;
    let segEnd = words[0].end;

    for (let i = 1; i < words.length; i++) {
      const w = words[i];
      if (w.speaker === currentSpeaker) {
        currentWords.push(w.punctuated_word || w.word);
        segEnd = w.end;
      } else {
        transcriptSegments.push({
          speaker: `Speaker ${currentSpeaker}`,
          text: currentWords.join(" "),
          startTime: segStart,
          endTime: segEnd,
        });
        currentSpeaker = w.speaker;
        currentWords = [w.punctuated_word || w.word];
        segStart = w.start;
        segEnd = w.end;
      }
    }
    // Push last segment
    transcriptSegments.push({
      speaker: `Speaker ${currentSpeaker}`,
      text: currentWords.join(" "),
      startTime: segStart,
      endTime: segEnd,
    });

    const transcription = transcriptSegments
      .map((seg) => `${seg.speaker}: ${seg.text}`)
      .join("\n\n");

    const uniqueSpeakers = [...new Set(transcriptSegments.map((seg) => seg.speaker))];
    const speakerMap: Record<string, string | SpeakerEntry> = {};
    uniqueSpeakers.forEach((speaker, index) => {
      speakerMap[speaker] = `Speaker ${index + 1}`;
    });

    // Apply project speaker defaults
    const speakerDefaults = await prisma.projectSpeakerDefault.findMany({
      where: { projectId },
    });
    for (const def of speakerDefaults) {
      if (speakerMap[def.speakerLabel] !== undefined) {
        speakerMap[def.speakerLabel] = def.userId
          ? { name: def.name, userId: def.userId, status: "suggested" as const }
          : def.name;
      }
    }

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
    after(() => runTranscription(id, meetingId, mediaId, media.url, runId, project.organizationId));

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

    if (meeting.transcription?.startsWith("__FAILED__")) {
      const message = meeting.transcription.replace("__FAILED__", "");
      return NextResponse.json({ status: "failed", message });
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
