import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyMeetingTranscriptReady, notifyTaskAssigned } from "@/lib/email";
import OpenAI from "openai";

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

interface SummaryResponse {
  summary: string;
  meetingPoints: { title: string; description: string }[];
  nextSteps: {
    description: string;
    assignee: string | null;
    dueDate: string | null;
  }[];
}

// POST /api/projects/[id]/meetings/[meetingId]/summarize - Summarize meeting via Claude
export async function POST(
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
              },
            },
          },
        },
        meetingPoints: true,
        nextSteps: true,
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

    const transcriptSegments = meeting.transcriptSegments as
      | TranscriptSegment[]
      | null;

    if (!transcriptSegments || transcriptSegments.length === 0) {
      return NextResponse.json(
        { error: "No transcript available. Transcribe audio first." },
        { status: 400 }
      );
    }

    // Build formatted transcript using speaker map
    const speakerMap = (meeting.speakerMap as Record<string, string>) ?? {};
    const formattedTranscript = transcriptSegments
      .map((seg) => {
        const displayName = speakerMap[seg.speaker] ?? seg.speaker;
        return `${displayName}: ${seg.text}`;
      })
      .join("\n\n");

    // Build attendee list
    const attendeeList = meeting.attendees
      .map((a) => `- ${a.user.name} (username: ${a.user.username}, id: ${a.user.id})`)
      .join("\n");

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const meetingDateStr = meeting.date.toISOString().split("T")[0];

    const promptText = `You are analyzing a meeting transcript. The meeting is titled "${meeting.name}".

Today's date is ${todayStr}.
This meeting took place on ${meetingDateStr}.

Meeting attendees:
${attendeeList || "No attendees listed."}

Transcript:
${formattedTranscript}

Analyze this meeting transcript and return a JSON object with the following structure:
{
  "summary": "A 2-3 paragraph summary of the meeting, covering the main topics discussed, key decisions made, and overall outcomes.",
  "meetingPoints": [
    {"title": "Brief title of discussion point", "description": "Detailed description of what was discussed"}
  ],
  "nextSteps": [
    {"description": "Description of the action item", "assignee": "Name of the person responsible or null if unassigned", "dueDate": "YYYY-MM-DD format or null if no date mentioned"}
  ]
}

Important guidelines:
- For the summary, write clear and professional prose covering the key themes and outcomes.
- For meetingPoints, extract all significant discussion topics. Each should have a concise title and a fuller description.
- For nextSteps, identify all action items, tasks, and commitments made during the meeting. Match assignees to the actual meeting attendees listed above when possible. Use the attendee's exact name as it appears in the attendee list.
- If a next step doesn't have a clear assignee, set assignee to null.
- If a next step doesn't have a clear due date, set dueDate to null. When suggesting due dates, use dates relative to today (${todayStr}). All dates MUST be in the future (${todayStr} or later).

Return ONLY the JSON object, with no additional text or markdown formatting.`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a meeting analyst. Always respond with valid JSON." },
        { role: "user", content: promptText },
      ],
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      return NextResponse.json(
        { error: "Failed to get summary from AI" },
        { status: 500 }
      );
    }

    let parsed: SummaryResponse;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    // Build a lookup map from attendee names to user IDs (case-insensitive)
    const attendeeNameMap = new Map<string, string>();
    for (const attendee of meeting.attendees) {
      attendeeNameMap.set(attendee.user.name.toLowerCase(), attendee.user.id);
      attendeeNameMap.set(
        attendee.user.username.toLowerCase(),
        attendee.user.id
      );
    }

    // Update meeting summary, delete old points/steps, create new ones
    // Transaction returns assigned tasks for notification
    const assignedTasks = await prisma.$transaction(async (tx) => {
      // Update summary
      await tx.meeting.update({
        where: { id: meetingId },
        data: { summary: parsed.summary },
      });

      // Delete existing meeting points and next steps
      await tx.meetingPoint.deleteMany({ where: { meetingId } });
      await tx.nextStep.deleteMany({ where: { meetingId } });

      // Delete tasks that were previously generated from this meeting
      await tx.task.deleteMany({
        where: {
          projectId: id,
          description: `Generated from meeting: ${meeting.name}`,
        },
      });

      // Create new meeting points
      if (parsed.meetingPoints && parsed.meetingPoints.length > 0) {
        await tx.meetingPoint.createMany({
          data: parsed.meetingPoints.map((point, index) => ({
            title: point.title,
            description: point.description,
            order: index,
            meetingId,
          })),
        });
      }

      // Create new next steps and corresponding tasks
      const assignedTasks: { assigneeId: string; description: string; dueDate: string | null }[] = [];

      if (parsed.nextSteps && parsed.nextSteps.length > 0) {

        for (let index = 0; index < parsed.nextSteps.length; index++) {
          const step = parsed.nextSteps[index];

          // Try to match assignee name to a real user
          let assigneeId: string | null = null;
          if (step.assignee) {
            assigneeId =
              attendeeNameMap.get(step.assignee.toLowerCase()) ?? null;
          }

          await tx.nextStep.create({
            data: {
              description: step.description,
              dueDate: step.dueDate ? new Date(step.dueDate) : null,
              order: index,
              assigneeId,
              meetingId,
            },
          });

          // Create a corresponding Task in the project
          let taskEndDate = step.dueDate
            ? new Date(step.dueDate)
            : new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          // Guardrail: if AI returned a past date, default to 7 days from now
          if (taskEndDate < today) {
            taskEndDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          }

          const task = await tx.task.create({
            data: {
              title: step.description,
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
            assignedTasks.push({ assigneeId, description: step.description, dueDate: step.dueDate });
          }
        }
      }

      return assignedTasks;
    });

    // Notify assigned users (outside transaction)
    if (Array.isArray(assignedTasks) && assignedTasks.length > 0) {
      const userIds = [...new Set(assignedTasks.map((t) => t.assigneeId))];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      for (const task of assignedTasks) {
        if (task.assigneeId === session.user.id) continue;
        const user = userMap.get(task.assigneeId);
        if (user?.email) {
          notifyTaskAssigned(
            user.email,
            user.name || "there",
            task.description,
            project.name,
            id,
            session.user.name || "Someone",
            task.dueDate || undefined
          ).catch(console.error);
        }
      }
    }

    // Fetch the fully updated meeting
    const updatedMeeting = await prisma.meeting.findUnique({
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

    // Notify attendees that transcript is ready (excluding current user)
    if (updatedMeeting) {
      for (const attendee of updatedMeeting.attendees) {
        if (
          attendee.user.id !== session.user.id &&
          attendee.user.email
        ) {
          notifyMeetingTranscriptReady(
            attendee.user.email,
            attendee.user.name || "there",
            updatedMeeting.name,
            project.name,
            id,
            meetingId
          ).catch(console.error);
        }
      }
    }

    return NextResponse.json(updatedMeeting);
  } catch (error) {
    console.error("Error summarizing meeting:", error);
    return NextResponse.json(
      { error: "Failed to summarize meeting" },
      { status: 500 }
    );
  }
}
