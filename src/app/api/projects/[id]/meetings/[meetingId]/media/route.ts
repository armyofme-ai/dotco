import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  const { id, meetingId } = await params;

  // Parse body for handleUpload
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
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
          maximumSizeInBytes: 50 * 1024 * 1024,
          tokenPayload: JSON.stringify({
            meetingId,
            userId: session.user.id,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const payload = JSON.parse(tokenPayload || "{}");
          const contentType = blob.contentType || "application/octet-stream";
          const type = contentType.startsWith("image/") ? "photo" : "audio";
          const filename = blob.pathname.split("/").pop() || "file";

          await prisma.media.create({
            data: {
              filename,
              url: blob.url,
              type,
              size: 0,
              mimeType: contentType,
              meetingId: payload.meetingId,
            },
          });
        } catch (error) {
          console.error("Error in onUploadCompleted:", error);
          throw error;
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("Upload error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
