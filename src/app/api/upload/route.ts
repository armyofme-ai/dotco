import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// POST /api/upload - Upload a file (photos and audio) via storage abstraction
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        { error: "Only image/* and audio/* mime types are accepted" },
        { status: 400 }
      );
    }

    const type = mimeType.startsWith("image/") ? "photos" : "audio";
    const pathname = `${type}/${Date.now()}-${file.name}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await uploadFile(pathname, buffer, {
      contentType: mimeType,
    });

    return NextResponse.json(
      {
        url: result.url,
        filename: file.name,
        size: file.size,
        mimeType,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
