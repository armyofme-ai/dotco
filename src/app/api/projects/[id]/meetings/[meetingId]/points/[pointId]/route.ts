import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/projects/[id]/meetings/[meetingId]/points/[pointId] - Update a meeting point
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; meetingId: string; pointId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, meetingId, pointId } = await params;

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

    const existingPoint = await prisma.meetingPoint.findUnique({
      where: { id: pointId },
    });
    if (!existingPoint) {
      return NextResponse.json(
        { error: "Meeting point not found" },
        { status: 404 }
      );
    }

    if (existingPoint.meetingId !== meetingId) {
      return NextResponse.json(
        { error: "Meeting point does not belong to this meeting" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { title, description, order } = body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (order !== undefined) data.order = order;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const point = await prisma.meetingPoint.update({
      where: { id: pointId },
      data,
    });

    return NextResponse.json(point);
  } catch (error) {
    console.error("Error updating meeting point:", error);
    return NextResponse.json(
      { error: "Failed to update meeting point" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/meetings/[meetingId]/points/[pointId] - Delete a meeting point
export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; meetingId: string; pointId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, meetingId, pointId } = await params;

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

    const point = await prisma.meetingPoint.findUnique({
      where: { id: pointId },
    });
    if (!point) {
      return NextResponse.json(
        { error: "Meeting point not found" },
        { status: 404 }
      );
    }

    if (point.meetingId !== meetingId) {
      return NextResponse.json(
        { error: "Meeting point does not belong to this meeting" },
        { status: 400 }
      );
    }

    await prisma.meetingPoint.delete({ where: { id: pointId } });

    return NextResponse.json({ message: "Meeting point deleted" });
  } catch (error) {
    console.error("Error deleting meeting point:", error);
    return NextResponse.json(
      { error: "Failed to delete meeting point" },
      { status: 500 }
    );
  }
}
