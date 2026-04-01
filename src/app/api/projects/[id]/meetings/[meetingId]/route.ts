import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFiles } from "@/lib/storage";
import { notifyMeetingInvite, notifyMeetingUpdated, notifyMeetingCancelled } from "@/lib/email";

// GET /api/projects/[id]/meetings/[meetingId] - Get full meeting with all relations
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
      include: {
        attendees: {
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
        media: {
          orderBy: { createdAt: "desc" },
        },
        meetingPoints: {
          orderBy: { order: "asc" },
        },
        nextSteps: {
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
        },
      },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    if (meeting.projectId !== id) {
      return NextResponse.json(
        { error: "Meeting does not belong to this project" },
        { status: 400 }
      );
    }

    return NextResponse.json(meeting);
  } catch (error) {
    console.error("Error fetching meeting:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/meetings/[meetingId] - Update a meeting
export async function PATCH(
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

    const existingMeeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    if (!existingMeeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    if (existingMeeting.projectId !== id) {
      return NextResponse.json(
        { error: "Meeting does not belong to this project" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      date,
      startTime,
      endTime,
      agenda,
      transcription,
      summary,
      attendeeIds,
    } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (date !== undefined) data.date = new Date(date);
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;
    if (agenda !== undefined) data.agenda = agenda;
    if (transcription !== undefined) data.transcription = transcription;
    if (summary !== undefined) data.summary = summary;

    // Handle attendees update: delete all existing and re-create
    let newAttendeeIds: string[] = [];
    let removedAttendeeIds: string[] = [];
    if (attendeeIds !== undefined) {
      const oldAttendees = await prisma.meetingAttendee.findMany({
        where: { meetingId },
        select: { userId: true },
      });
      const oldIds = new Set(oldAttendees.map((a) => a.userId));
      const newIds = new Set(attendeeIds as string[]);

      await prisma.meetingAttendee.deleteMany({ where: { meetingId } });
      if (attendeeIds.length > 0) {
        await prisma.meetingAttendee.createMany({
          data: attendeeIds.map((userId: string) => ({
            userId,
            meetingId,
          })),
        });
      }

      newAttendeeIds = attendeeIds.filter(
        (uid: string) => !oldIds.has(uid)
      );
      removedAttendeeIds = [...oldIds].filter(
        (uid) => !newIds.has(uid)
      );
    }

    // Check if date/time changed
    const dateTimeChanged =
      (date !== undefined && new Date(date).toISOString() !== existingMeeting.date.toISOString()) ||
      (startTime !== undefined && startTime !== existingMeeting.startTime) ||
      (endTime !== undefined && endTime !== existingMeeting.endTime);

    const meeting = await prisma.meeting.update({
      where: { id: meetingId },
      data,
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
        media: true,
        meetingPoints: { orderBy: { order: "asc" } },
        nextSteps: {
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
        },
      },
    });

    // Fetch org timezone for notifications
    const org = await prisma.organization.findUnique({
      where: { id: project.organizationId },
      select: { timezone: true },
    });
    const meetingName = name ?? existingMeeting.name;
    const meetingDate = date ?? existingMeeting.date.toISOString();
    const meetingStart = startTime ?? existingMeeting.startTime;
    const meetingEnd = endTime ?? existingMeeting.endTime;

    // Get all current attendees for the attendee list in .ics
    const allAttendeeUsers = await prisma.user.findMany({
      where: { id: { in: meeting.attendees.map((a: { userId: string }) => a.userId) } },
      select: { id: true, email: true, name: true },
    });
    const attendeesList = allAttendeeUsers
      .filter((u) => u.email)
      .map((u) => ({ name: u.name || "there", email: u.email }));

    // 1. Notify NEW attendees (invite)
    if (newAttendeeIds.length > 0) {
      const newUsers = allAttendeeUsers.filter((u) => newAttendeeIds.includes(u.id));
      for (const u of newUsers) {
        if (u.email) {
          notifyMeetingInvite(
            u.email, u.name || "there", meetingName, project.name, id, meetingId,
            meetingDate, meetingStart, meetingEnd, session.user.name || "Someone",
            session.user.email || undefined, session.user.name || undefined,
            attendeesList, org?.timezone || undefined
          ).catch(console.error);
        }
      }
    }

    // 2. Notify REMOVED attendees (cancel)
    if (removedAttendeeIds.length > 0) {
      const removedUsers = await prisma.user.findMany({
        where: { id: { in: removedAttendeeIds } },
        select: { id: true, email: true, name: true },
      });
      for (const u of removedUsers) {
        if (u.email) {
          notifyMeetingCancelled(
            u.email, u.name || "there", meetingName, project.name, meetingId,
            meetingDate, meetingStart, meetingEnd,
            session.user.email || "", session.user.name || "Someone",
            org?.timezone || undefined
          ).catch(console.error);
        }
      }
    }

    // 3. Notify EXISTING attendees if date/time changed (update)
    if (dateTimeChanged) {
      const existingAttendees = allAttendeeUsers.filter(
        (u) => !newAttendeeIds.includes(u.id) // new ones already got an invite
      );
      for (const u of existingAttendees) {
        if (u.email) {
          notifyMeetingUpdated(
            u.email, u.name || "there", meetingName, project.name, id, meetingId,
            meetingDate, meetingStart, meetingEnd, session.user.name || "Someone",
            session.user.email || "", session.user.name || "Someone",
            attendeesList, org?.timezone || undefined
          ).catch(console.error);
        }
      }
    }

    return NextResponse.json(meeting);
  } catch (error) {
    console.error("Error updating meeting:", error);
    return NextResponse.json(
      { error: "Failed to update meeting" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/meetings/[meetingId] - Delete a meeting
export async function DELETE(
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
      include: {
        attendees: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    if (meeting.projectId !== id) {
      return NextResponse.json(
        { error: "Meeting does not belong to this project" },
        { status: 400 }
      );
    }

    // Delete media files before deleting the meeting
    const mediaFiles = await prisma.media.findMany({
      where: { meetingId },
      select: { url: true },
    });

    if (mediaFiles.length > 0) {
      await deleteFiles(mediaFiles.map((m) => m.url));
    }

    // Delete generated tasks from this meeting
    await prisma.task.deleteMany({
      where: {
        projectId: id,
        description: `Generated from meeting: ${meeting.name}`,
      },
    });

    await prisma.meeting.delete({ where: { id: meetingId } });

    // Notify attendees about cancellation (excluding the deleter)
    const org = await prisma.organization.findUnique({
      where: { id: project.organizationId },
      select: { timezone: true },
    });
    const meetingDate = meeting.date.toISOString().split("T")[0];
    for (const attendee of meeting.attendees) {
      if (attendee.user.id !== session.user.id && attendee.user.email) {
        notifyMeetingCancelled(
          attendee.user.email,
          attendee.user.name || "there",
          meeting.name,
          project.name,
          meetingId,
          meetingDate,
          meeting.startTime,
          meeting.endTime,
          session.user.email || "",
          session.user.name || "Someone",
          org?.timezone || undefined
        ).catch(console.error);
      }
    }

    return NextResponse.json({ message: "Meeting deleted" });
  } catch (error) {
    console.error("Error deleting meeting:", error);
    return NextResponse.json(
      { error: "Failed to delete meeting" },
      { status: 500 }
    );
  }
}
