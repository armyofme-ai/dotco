import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id]/meetings/[meetingId]/points - List meeting points
export async function GET(
  _request: NextRequest,
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
    if (!meeting || meeting.projectId !== id) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    const points = await prisma.meetingPoint.findMany({
      where: { meetingId },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(points);
  } catch (error) {
    console.error("Error fetching meeting points:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting points" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/meetings/[meetingId]/points - Create a meeting point
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
    if (!meeting || meeting.projectId !== id) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, description, order } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const point = await prisma.meetingPoint.create({
      data: {
        title,
        description: description || null,
        order: order ?? 0,
        meetingId,
      },
    });

    return NextResponse.json(point, { status: 201 });
  } catch (error) {
    console.error("Error creating meeting point:", error);
    return NextResponse.json(
      { error: "Failed to create meeting point" },
      { status: 500 }
    );
  }
}
