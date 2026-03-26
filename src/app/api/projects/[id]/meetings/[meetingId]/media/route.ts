import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// POST /api/projects/[id]/meetings/[meetingId]/media - Upload media
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit" },
        { status: 400 }
      );
    }

    const mimeType = file.type;
    if (!mimeType.startsWith("image/") && !mimeType.startsWith("audio/")) {
      return NextResponse.json(
        { error: "Only image and audio files are accepted" },
        { status: 400 }
      );
    }

    const type = mimeType.startsWith("image/") ? "photo" : "audio";
    const uploadDir = path.join(process.cwd(), "uploads", type);
    await mkdir(uploadDir, { recursive: true });

    const uniqueFilename = `${uuidv4()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const url = `/uploads/${type}/${uniqueFilename}`;

    const media = await prisma.media.create({
      data: {
        filename: file.name,
        url,
        type,
        size: file.size,
        mimeType,
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
