import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/ai-config";

// GET /api/settings/ai - Get AI config status (not actual keys)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        llmProvider: true,
        llmModel: true,
        llmApiKey: true,
        deepgramApiKey: true,
        deepgramModel: true,
        resendApiKey: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      llmProvider: org.llmProvider || "openai",
      llmModel: org.llmModel || "gpt-4o",
      llmApiKeySet: !!org.llmApiKey,
      deepgramApiKeySet: !!org.deepgramApiKey,
      deepgramModel: org.deepgramModel || "nova-3",
      resendApiKeySet: !!org.resendApiKey,
      // Also indicate if env vars are available as fallback
      llmEnvKeySet: !!process.env.OPENAI_API_KEY,
      deepgramEnvKeySet: !!process.env.DEEPGRAM_API_KEY,
      resendEnvKeySet: !!process.env.RESEND_API_KEY,
    });
  } catch (error) {
    console.error("Error fetching AI config:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI config" },
      { status: 500 }
    );
  }
}

// PATCH /api/settings/ai - Update AI config (owner only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only owners can update AI settings" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { llmProvider, llmModel, llmApiKey, deepgramApiKey, deepgramModel, resendApiKey } =
      body;

    const data: Record<string, unknown> = {};

    if (llmProvider !== undefined) data.llmProvider = llmProvider;
    if (llmModel !== undefined) data.llmModel = llmModel;
    if (deepgramModel !== undefined) data.deepgramModel = deepgramModel;

    // For API keys: encrypt if provided, set to null if empty string, skip if undefined
    if (llmApiKey !== undefined) {
      data.llmApiKey = llmApiKey === "" ? null : encrypt(llmApiKey);
    }
    if (deepgramApiKey !== undefined) {
      data.deepgramApiKey =
        deepgramApiKey === "" ? null : encrypt(deepgramApiKey);
    }
    if (resendApiKey !== undefined) {
      data.resendApiKey = resendApiKey === "" ? null : encrypt(resendApiKey);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data,
    });

    // Return updated status (not actual keys)
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        llmProvider: true,
        llmModel: true,
        llmApiKey: true,
        deepgramApiKey: true,
        deepgramModel: true,
        resendApiKey: true,
      },
    });

    return NextResponse.json({
      llmProvider: org?.llmProvider || "openai",
      llmModel: org?.llmModel || "gpt-4o",
      llmApiKeySet: !!org?.llmApiKey,
      deepgramApiKeySet: !!org?.deepgramApiKey,
      deepgramModel: org?.deepgramModel || "nova-3",
      resendApiKeySet: !!org?.resendApiKey,
      llmEnvKeySet: !!process.env.OPENAI_API_KEY,
      deepgramEnvKeySet: !!process.env.DEEPGRAM_API_KEY,
      resendEnvKeySet: !!process.env.RESEND_API_KEY,
    });
  } catch (error) {
    console.error("Error updating AI config:", error);
    return NextResponse.json(
      { error: "Failed to update AI config" },
      { status: 500 }
    );
  }
}
