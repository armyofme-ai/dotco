import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeepgramClient } from "@deepgram/sdk";

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

export const maxDuration = 300; // 5 minutes for large audio files

// POST /api/projects/[id]/meetings/[meetingId]/transcribe - Transcribe audio via Deepgram
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
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (project.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    if (meeting.projectId !== id) {
      return NextResponse.json(
        { error: "Meeting does not belong to this project" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { mediaId } = body;

    if (!mediaId) {
      return NextResponse.json(
        { error: "mediaId is required" },
        { status: 400 }
      );
    }

    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      return NextResponse.json(
        { error: "Media not found" },
        { status: 404 }
      );
    }

    if (media.type !== "audio") {
      return NextResponse.json(
        { error: "Media is not an audio file" },
        { status: 400 }
      );
    }

    if (media.meetingId !== meetingId) {
      return NextResponse.json(
        { error: "Media does not belong to this meeting" },
        { status: 400 }
      );
    }

    // Send URL directly to Deepgram (avoids downloading large files into memory)
    const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY! });
    const result = await deepgram.listen.v1.media.transcribeUrl(
      {
        url: media.url,
        model: "nova-3",
        diarize: true,
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        utterances: true,
      }
    );

    // Extract utterances and build transcript segments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const utterances = (result as any)?.results?.utterances ?? [];

    const transcriptSegments: TranscriptSegment[] = utterances.map(
      (utterance: { speaker: number; transcript: string; start: number; end: number }) => ({
        speaker: `Speaker ${utterance.speaker}`,
        text: utterance.transcript,
        startTime: utterance.start,
        endTime: utterance.end,
      })
    );

    // Build plain text transcription from segments
    const transcription = transcriptSegments
      .map((seg) => `${seg.speaker}: ${seg.text}`)
      .join("\n\n");

    // Build speaker map with 1-indexed display names
    const uniqueSpeakers = [
      ...new Set(transcriptSegments.map((seg) => seg.speaker)),
    ];
    const speakerMap: Record<string, string> = {};
    uniqueSpeakers.forEach((speaker, index) => {
      speakerMap[speaker] = `Speaker ${index + 1}`;
    });

    // Update the meeting
    const updatedMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        transcription,
        transcriptSegments: transcriptSegments as unknown as undefined,
        speakerMap: speakerMap as unknown as undefined,
        transcribedMediaId: mediaId,
      },
      include: {
        attendees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        media: {
          orderBy: { createdAt: "desc" },
        },
        meetingPoints: {
          orderBy: { order: "asc" },
        },
        nextSteps: {
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(updatedMeeting);
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
