import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyMeetingInvite } from "@/lib/email";

// GET /api/projects/[id]/meetings - List meetings for a project
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

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

    const meetings = await prisma.meeting.findMany({
      where: { projectId: id },
      include: {
        attendees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            media: true,
            meetingPoints: true,
            nextSteps: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(meetings);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/meetings - Create a meeting
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

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

    const body = await request.json();
    const { name, date, startTime, endTime, agenda, attendeeIds } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Meeting name is required" },
        { status: 400 }
      );
    }

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { error: "date, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    const meeting = await prisma.meeting.create({
      data: {
        name,
        date: new Date(date),
        startTime,
        endTime,
        agenda: agenda || null,
        projectId: id,
        attendees:
          attendeeIds && attendeeIds.length > 0
            ? {
                create: attendeeIds.map((userId: string) => ({
                  userId,
                })),
              }
            : undefined,
      },
      include: {
        attendees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // Notify attendees (excluding the creator)
    if (attendeeIds && attendeeIds.length > 0) {
      const usersToNotify = await prisma.user.findMany({
        where: {
          id: { in: attendeeIds.filter((uid: string) => uid !== session.user.id) },
        },
        select: { id: true, email: true, name: true },
      });
      const attendeesList = usersToNotify
        .filter((u) => u.email)
        .map((u) => ({ name: u.name || "there", email: u.email! }));
      for (const u of usersToNotify) {
        if (u.email) {
          notifyMeetingInvite(
            u.email,
            u.name || "there",
            name,
            project.name,
            id,
            meeting.id,
            date,
            startTime,
            endTime,
            session.user.name || "Someone",
            session.user.email || undefined,
            session.user.name || undefined,
            attendeesList
          ).catch(console.error);
        }
      }
    }

    return NextResponse.json(meeting, { status: 201 });
  } catch (error) {
    console.error("Error creating meeting:", error);
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 }
    );
  }
}
