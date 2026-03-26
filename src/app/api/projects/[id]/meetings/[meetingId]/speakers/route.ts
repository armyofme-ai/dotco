import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

// PATCH /api/projects/[id]/meetings/[meetingId]/speakers - Update speaker name mapping
export async function PATCH(
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
    const { speakerMap } = body;

    if (!speakerMap || typeof speakerMap !== "object") {
      return NextResponse.json(
        { error: "speakerMap is required and must be an object" },
        { status: 400 }
      );
    }

    // Regenerate plain text transcription using the new speaker names
    const transcriptSegments = meeting.transcriptSegments as
      | TranscriptSegment[]
      | null;

    let transcription = meeting.transcription;
    if (transcriptSegments && transcriptSegments.length > 0) {
      transcription = transcriptSegments
        .map((seg) => {
          const displayName =
            (speakerMap as Record<string, string>)[seg.speaker] ?? seg.speaker;
          return `${displayName}: ${seg.text}`;
        })
        .join("\n\n");
    }

    const updatedMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        speakerMap: speakerMap as unknown as undefined,
        transcription,
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
    console.error("Error updating speaker map:", error);
    return NextResponse.json(
      { error: "Failed to update speaker map" },
      { status: 500 }
    );
  }
}
