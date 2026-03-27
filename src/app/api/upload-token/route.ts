import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pathname } = body;

  if (!pathname) {
    return NextResponse.json({ error: "pathname is required" }, { status: 400 });
  }

  const token = process.env.BLOBPRO_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Blob storage not configured" }, { status: 500 });
  }

  const clientToken = await generateClientTokenFromReadWriteToken({
    token,
    pathname,
    allowedContentTypes: ["image/*", "audio/*"],
    maximumSizeInBytes: 50 * 1024 * 1024,
  });

  return NextResponse.json({ clientToken });
}
