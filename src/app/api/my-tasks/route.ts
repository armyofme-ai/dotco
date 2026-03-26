import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/my-tasks - List all tasks assigned to the current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasks = await prisma.task.findMany({
      where: {
        assignees: {
          some: { userId: session.user.id },
        },
        project: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ status: "asc" }, { endDate: "asc" }],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching my tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
