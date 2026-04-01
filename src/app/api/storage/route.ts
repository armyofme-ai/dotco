import { NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/storage";

// GET /api/storage — returns the active storage provider name
export async function GET() {
  return NextResponse.json({ provider: getStorageProvider() });
}
