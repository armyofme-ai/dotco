import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { del } from "@vercel/blob";

// DELETE /api/projects/[id]/meetings/[meetingId]/media/[mediaId] - Delete media
export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; meetingId: string; mediaId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, meetingId, mediaId } = await params;

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

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    if (media.meetingId !== meetingId) {
      return NextResponse.json(
        { error: "Media does not belong to this meeting" },
        { status: 400 }
      );
    }

    // Verify meeting belongs to project
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    if (!meeting || meeting.projectId !== id) {
      return NextResponse.json(
        { error: "Meeting does not belong to this project" },
        { status: 400 }
      );
    }

    // Delete from Vercel Blob (or ignore if local/old URL)
    try {
      if (media.url.includes("blob.vercel-storage.com")) {
        await del(media.url);
      }
    } catch {
      console.warn("Could not delete blob:", media.url);
    }

    await prisma.media.delete({ where: { id: mediaId } });

    // If this was an audio file, check if any audio files remain
    if (media.type === "audio") {
      const remainingAudio = await prisma.media.count({
        where: { meetingId, type: "audio" },
      });

      // If no audio files left, clear transcript, summary, points, and next steps
      if (remainingAudio === 0) {
        // Delete generated tasks linked to this meeting's next steps
        await prisma.task.deleteMany({
          where: {
            projectId: id,
            description: `Generated from meeting: ${meeting.name}`,
          },
        });

        // Delete meeting points and next steps
        await prisma.meetingPoint.deleteMany({ where: { meetingId } });
        await prisma.nextStep.deleteMany({ where: { meetingId } });

        // Clear transcript and summary fields
        await prisma.meeting.update({
          where: { id: meetingId },
          data: {
            transcription: null,
            transcriptSegments: Prisma.DbNull,
            speakerMap: Prisma.DbNull,
            summary: null,
          },
        });
      }
    }

    return NextResponse.json({ message: "Media deleted" });
  } catch (error) {
    console.error("Error deleting media:", error);
    return NextResponse.json(
      { error: "Failed to delete media" },
      { status: 500 }
    );
  }
}
