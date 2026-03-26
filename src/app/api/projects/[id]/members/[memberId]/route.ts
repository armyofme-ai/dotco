import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/projects/[id]/members/[memberId] - Remove a member from the project
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, memberId } = await params;

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

    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.projectId !== id) {
      return NextResponse.json(
        { error: "Member does not belong to this project" },
        { status: 400 }
      );
    }

    await prisma.projectMember.delete({ where: { id: memberId } });

    return NextResponse.json({ message: "Member removed from project" });
  } catch (error) {
    console.error("Error removing project member:", error);
    return NextResponse.json(
      { error: "Failed to remove project member" },
      { status: 500 }
    );
  }
}
