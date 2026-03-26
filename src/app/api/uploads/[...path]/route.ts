import { NextRequest } from "next/server";
import { stat, open } from "fs/promises";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".avif": "image/avif",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

// GET /api/uploads/[...path] - Serve uploaded files with range request support
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const segments = await params;
    const filePath = path.join(process.cwd(), "uploads", ...segments.path);

    // Prevent directory traversal
    const resolved = path.resolve(filePath);
    const uploadsDir = path.resolve(path.join(process.cwd(), "uploads"));
    if (!resolved.startsWith(uploadsDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    let fileStat;
    try {
      fileStat = await stat(resolved);
    } catch {
      return new Response("Not found", { status: 404 });
    }

    if (!fileStat.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    const contentType = getMimeType(resolved);
    const fileSize = fileStat.size;

    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      // Parse range header (e.g., "bytes=0-1023")
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (!match) {
        return new Response("Invalid range", { status: 416 });
      }

      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        return new Response("Range not satisfiable", {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const fileHandle = await open(resolved, "r");
      const buffer = Buffer.alloc(chunkSize);
      await fileHandle.read(buffer, 0, chunkSize, start);
      await fileHandle.close();

      return new Response(buffer, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": contentType,
        },
      });
    }

    // Full file response
    const fileHandle = await open(resolved, "r");
    const buffer = Buffer.alloc(fileSize);
    await fileHandle.read(buffer, 0, fileSize, 0);
    await fileHandle.close();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
