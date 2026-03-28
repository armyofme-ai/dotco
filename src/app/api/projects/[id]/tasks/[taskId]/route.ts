import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { notifyTaskAssigned } from "@/lib/email";

// GET /api/projects/[id]/tasks/[taskId] - Get a single task
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, taskId } = await params;

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

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.projectId !== id) {
      return NextResponse.json(
        { error: "Task does not belong to this project" },
        { status: 400 }
      );
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/tasks/[taskId] - Update a task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, taskId } = await params;

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

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (existingTask.projectId !== id) {
      return NextResponse.json(
        { error: "Task does not belong to this project" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { title, description, status, startDate, endDate, assigneeIds } =
      body;

    if (status && !Object.values(TaskStatus).includes(status)) {
      return NextResponse.json(
        { error: "Invalid task status" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);

    // Handle assignees update: delete all existing and re-create
    let newAssigneeIds: string[] = [];
    if (assigneeIds !== undefined) {
      const oldAssignees = await prisma.taskAssignee.findMany({
        where: { taskId },
        select: { userId: true },
      });
      const oldIds = new Set(oldAssignees.map((a) => a.userId));

      await prisma.taskAssignee.deleteMany({ where: { taskId } });
      if (assigneeIds.length > 0) {
        await prisma.taskAssignee.createMany({
          data: assigneeIds.map((userId: string) => ({
            userId,
            taskId,
          })),
        });
      }

      newAssigneeIds = assigneeIds.filter(
        (uid: string) => !oldIds.has(uid) && uid !== session.user.id
      );
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data,
      include: {
        assignees: {
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

    // Notify newly added assignees
    if (newAssigneeIds.length > 0) {
      const usersToNotify = await prisma.user.findMany({
        where: { id: { in: newAssigneeIds } },
        select: { id: true, email: true, name: true },
      });
      const taskTitle = title ?? existingTask.title;
      const dueDate = endDate ?? existingTask.endDate?.toISOString();
      for (const u of usersToNotify) {
        if (u.email) {
          notifyTaskAssigned(
            u.email,
            u.name || "there",
            taskTitle,
            project.name,
            id,
            session.user.name || "Someone",
            dueDate,
            taskId
          ).catch(console.error);
        }
      }
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/tasks/[taskId] - Delete a task
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, taskId } = await params;

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

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.projectId !== id) {
      return NextResponse.json(
        { error: "Task does not belong to this project" },
        { status: 400 }
      );
    }

    await prisma.task.delete({ where: { id: taskId } });

    return NextResponse.json({ message: "Task deleted" });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
