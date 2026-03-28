import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyTaskAssigned } from "@/lib/email";

// GET /api/projects/[id]/meetings/[meetingId]/next-steps - List next steps
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

    const nextSteps = await prisma.nextStep.findMany({
      where: { meetingId },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(nextSteps);
  } catch (error) {
    console.error("Error fetching next steps:", error);
    return NextResponse.json(
      { error: "Failed to fetch next steps" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/meetings/[meetingId]/next-steps - Create a next step
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
    const { description, dueDate, assigneeId, order } = body;

    if (!description) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const today = new Date();
    const taskEndDate = dueDate
      ? new Date(dueDate)
      : new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [nextStep] = await prisma.$transaction(async (tx) => {
      const step = await tx.nextStep.create({
        data: {
          description,
          dueDate: dueDate ? new Date(dueDate) : null,
          assigneeId: assigneeId || null,
          order: order ?? 0,
          meetingId,
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
        },
      });

      // Create a corresponding Task in the project
      const task = await tx.task.create({
        data: {
          title: description,
          description: `Generated from meeting: ${meeting.name}`,
          status: "TODO",
          startDate: today,
          endDate: taskEndDate,
          projectId: id,
        },
      });

      // If the next step has an assignee, create a TaskAssignee record
      if (assigneeId) {
        await tx.taskAssignee.create({
          data: {
            userId: assigneeId,
            taskId: task.id,
          },
        });
      }

      return [step];
    });

    // Notify assignee
    if (assigneeId && assigneeId !== session.user.id) {
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { email: true, name: true },
      });
      if (assignee?.email) {
        notifyTaskAssigned(
          assignee.email,
          assignee.name || "there",
          description,
          project.name,
          id,
          session.user.name || "Someone",
          dueDate || undefined
        ).catch(console.error);
      }
    }

    return NextResponse.json(nextStep, { status: 201 });
  } catch (error) {
    console.error("Error creating next step:", error);
    return NextResponse.json(
      { error: "Failed to create next step" },
      { status: 500 }
    );
  }
}
