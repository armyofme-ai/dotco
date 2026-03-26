import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

// GET /api/settings - Get organization settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        logo: true,
        timezone: true,
        sessionTimeout: true,
        invitationExpiry: true,
        defaultProjectStatus: true,
        kanbanColumns: true,
        kanbanLabels: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PATCH /api/settings - Update organization settings (owner only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only owners can update settings" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, logo, timezone, sessionTimeout, invitationExpiry, defaultProjectStatus } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (logo !== undefined) data.logo = logo;
    if (timezone !== undefined) data.timezone = timezone;
    if (sessionTimeout !== undefined) data.sessionTimeout = sessionTimeout;
    if (invitationExpiry !== undefined) data.invitationExpiry = invitationExpiry;
    if (defaultProjectStatus !== undefined) data.defaultProjectStatus = defaultProjectStatus;
    if (body.kanbanColumns !== undefined) {
      data.kanbanColumns = body.kanbanColumns === null ? Prisma.DbNull : body.kanbanColumns;
    }
    if (body.kanbanLabels !== undefined) {
      data.kanbanLabels = body.kanbanLabels === null || Object.keys(body.kanbanLabels).length === 0
        ? Prisma.DbNull
        : body.kanbanLabels;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const organization = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data,
      select: {
        id: true,
        name: true,
        logo: true,
        timezone: true,
        sessionTimeout: true,
        invitationExpiry: true,
        defaultProjectStatus: true,
        kanbanColumns: true,
        kanbanLabels: true,
      },
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
