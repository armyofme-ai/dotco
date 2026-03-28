import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyTaskAssigned } from "@/lib/email";

// PATCH /api/projects/[id]/meetings/[meetingId]/next-steps/[stepId] - Update a next step
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; meetingId: string; stepId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, meetingId, stepId } = await params;

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

    const existingStep = await prisma.nextStep.findUnique({
      where: { id: stepId },
    });
    if (!existingStep) {
      return NextResponse.json(
        { error: "Next step not found" },
        { status: 404 }
      );
    }

    if (existingStep.meetingId !== meetingId) {
      return NextResponse.json(
        { error: "Next step does not belong to this meeting" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { description, dueDate, completed, assigneeId, order } = body;

    const data: Record<string, unknown> = {};
    if (description !== undefined) data.description = description;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (completed !== undefined) data.completed = completed;
    if (assigneeId !== undefined) data.assigneeId = assigneeId || null;
    if (order !== undefined) data.order = order;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const nextStep = await prisma.nextStep.update({
      where: { id: stepId },
      data,
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

    // Sync changes to the corresponding project Task
    const matchingTask = await prisma.task.findFirst({
      where: {
        title: existingStep.description,
        projectId: id,
      },
    });

    if (matchingTask) {
      const taskUpdate: Record<string, unknown> = {};

      if (completed !== undefined) {
        taskUpdate.status = completed ? "DONE" : "TODO";
      }
      if (description !== undefined) {
        taskUpdate.title = description;
      }
      if (dueDate !== undefined) {
        taskUpdate.endDate = dueDate ? new Date(dueDate) : matchingTask.endDate;
      }

      if (Object.keys(taskUpdate).length > 0) {
        await prisma.task.update({
          where: { id: matchingTask.id },
          data: taskUpdate,
        });
      }

      // Sync assignee
      if (assigneeId !== undefined) {
        // Remove old assignees
        await prisma.taskAssignee.deleteMany({
          where: { taskId: matchingTask.id },
        });
        // Add new assignee if provided
        if (assigneeId) {
          await prisma.taskAssignee.create({
            data: { userId: assigneeId, taskId: matchingTask.id },
          });
        }
      }
    }

    // Notify new assignee (only if changed to a different person)
    if (assigneeId && assigneeId !== existingStep.assigneeId && assigneeId !== session.user.id) {
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { email: true, name: true },
      });
      if (assignee?.email) {
        const taskTitle = description ?? existingStep.description;
        const taskDue = dueDate ?? (existingStep.dueDate ? existingStep.dueDate.toISOString().split("T")[0] : undefined);
        notifyTaskAssigned(
          assignee.email,
          assignee.name || "there",
          taskTitle,
          project.name,
          id,
          session.user.name || "Someone",
          taskDue || undefined
        ).catch(console.error);
      }
    }

    return NextResponse.json(nextStep);
  } catch (error) {
    console.error("Error updating next step:", error);
    return NextResponse.json(
      { error: "Failed to update next step" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/meetings/[meetingId]/next-steps/[stepId] - Delete a next step
export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; meetingId: string; stepId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, meetingId, stepId } = await params;

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

    const step = await prisma.nextStep.findUnique({ where: { id: stepId } });
    if (!step) {
      return NextResponse.json(
        { error: "Next step not found" },
        { status: 404 }
      );
    }

    if (step.meetingId !== meetingId) {
      return NextResponse.json(
        { error: "Next step does not belong to this meeting" },
        { status: 400 }
      );
    }

    await prisma.nextStep.delete({ where: { id: stepId } });

    return NextResponse.json({ message: "Next step deleted" });
  } catch (error) {
    console.error("Error deleting next step:", error);
    return NextResponse.json(
      { error: "Failed to delete next step" },
      { status: 500 }
    );
  }
}
