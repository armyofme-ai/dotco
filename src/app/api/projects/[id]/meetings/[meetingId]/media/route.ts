import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

// POST /api/projects/[id]/meetings/[meetingId]/media - Handle client upload callback
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  const { id, meetingId } = await params;

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await auth();
        if (!session?.user) {
          throw new Error("Unauthorized");
        }

        const project = await prisma.project.findUnique({ where: { id } });
        if (!project || project.organizationId !== session.user.organizationId) {
          throw new Error("Forbidden");
        }

        const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
        if (!meeting || meeting.projectId !== id) {
          throw new Error("Meeting not found");
        }

        return {
          allowedContentTypes: ["image/*", "audio/*"],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
          tokenPayload: JSON.stringify({
            meetingId,
            userId: session.user.id,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = JSON.parse(tokenPayload || "{}");
        const mimeType = blob.contentType || "application/octet-stream";
        const type = mimeType.startsWith("image/") ? "photo" : "audio";

        await prisma.media.create({
          data: {
            filename: blob.pathname.split("/").pop() || "file",
            url: blob.url,
            type,
            size: 0,
            mimeType,
            meetingId: payload.meetingId,
          },
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
