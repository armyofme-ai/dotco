import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - list media (used by frontend after upload to refresh)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { meetingId } = await params;
  const media = await prisma.media.findMany({
    where: { meetingId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(media);
}

// POST - register an uploaded blob as a media record
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
    const { url, filename, mimeType } = body;

    if (!url || !filename || !mimeType) {
      return NextResponse.json({ error: "url, filename, and mimeType are required" }, { status: 400 });
    }

    const type = mimeType.startsWith("image/") ? "photo" : "audio";

    const media = await prisma.media.create({
      data: {
        filename,
        url,
        type,
        size: 0,
        mimeType,
        meetingId,
      },
    });

    return NextResponse.json(media, { status: 201 });
  } catch (error) {
    console.error("Error creating media record:", error);
    return NextResponse.json({ error: "Failed to create media record" }, { status: 500 });
  }
}
