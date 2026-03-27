import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

// POST /api/projects/[id]/meetings/[meetingId]/media - Upload media via server-side streaming
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

    // Get filename and content type from headers (sent by client)
    const filename = request.headers.get("x-filename") || "file";
    const contentType = request.headers.get("content-type") || "application/octet-stream";

    if (!contentType.startsWith("image/") && !contentType.startsWith("audio/")) {
      return NextResponse.json(
        { error: "Only image and audio files are accepted" },
        { status: 400 }
      );
    }

    const type = contentType.startsWith("image/") ? "photo" : "audio";

    // Stream the request body directly to Vercel Blob (bypasses body size limit)
    const blob = await put(`${type}/${filename}`, request.body!, {
      access: "public",
      contentType,
    });

    const media = await prisma.media.create({
      data: {
        filename,
        url: blob.url,
        type,
        size: 0,
        mimeType: contentType,
        meetingId,
      },
    });

    return NextResponse.json(media, { status: 201 });
  } catch (error) {
    console.error("Error uploading media:", error);
    return NextResponse.json(
      { error: "Failed to upload media" },
      { status: 500 }
    );
  }
}
