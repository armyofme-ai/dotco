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
  strategicAnalysis: string;
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

    const project = await prisma.project.findUnique({
      where: { id },
      include: { organization: { select: { name: true } } },
    });
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

    // ── Gather platform context ──────────────────────────────

    // All projects in the org with status
    const allProjects = await prisma.project.findMany({
      where: { organizationId: project.organizationId },
      select: { id: true, name: true, description: true, status: true },
    });
    const projectContext = allProjects
      .map((p) => `- ${p.name} (${p.status})${p.description ? `: ${p.description}` : ""}`)
      .join("\n");

    // All org members with their tasks (to infer roles)
    const allUsers = await prisma.user.findMany({
      where: { organizationId: project.organizationId },
      select: {
        id: true,
        name: true,
        taskAssignments: {
          include: { task: { select: { title: true, status: true, projectId: true } } },
          take: 10,
          orderBy: { task: { createdAt: "desc" } },
        },
      },
    });
    const teamContext = allUsers
      .map((u) => {
        const tasks = u.taskAssignments.map((ta) => {
          const proj = allProjects.find((p) => p.id === ta.task.projectId);
          return `    - [${ta.task.status}] ${ta.task.title}${proj ? ` (${proj.name})` : ""}`;
        });
        return `- ${u.name}:\n${tasks.length > 0 ? tasks.join("\n") : "    - No recent tasks"}`;
      })
      .join("\n");

    // Previous meeting summaries from this project (for continuity)
    const previousMeetings = await prisma.meeting.findMany({
      where: {
        projectId: id,
        id: { not: meetingId },
        summary: { not: null },
      },
      select: { name: true, date: true, summary: true },
      orderBy: { date: "desc" },
      take: 3,
    });
    const previousContext = previousMeetings
      .map((m) => `### ${m.name} (${m.date.toISOString().split("T")[0]})\n${m.summary}`)
      .join("\n\n");

    // Active tasks in this project (to understand current work)
    const activeTasks = await prisma.task.findMany({
      where: { projectId: id, status: { not: "DONE" } },
      select: {
        title: true,
        status: true,
        endDate: true,
        assignees: { include: { user: { select: { name: true } } } },
      },
      orderBy: { endDate: "asc" },
      take: 15,
    });
    const activeTasksContext = activeTasks
      .map((t) => {
        const assignees = t.assignees.map((a) => a.user.name).join(", ") || "Unassigned";
        return `- [${t.status}] ${t.title} — ${assignees} (due ${t.endDate.toISOString().split("T")[0]})`;
      })
      .join("\n");

    // ── Build prompt ─────────────────────────────────────────

    const promptText = `You are a strategic analyst for a venture builder called "${project.organization?.name || "the organization"}". You are analyzing a meeting transcript with deep organizational context.

Today's date is ${todayStr}.
This meeting "${meeting.name}" took place on ${meetingDateStr} for the project "${project.name}"${project.description ? ` (${project.description})` : ""}.

## Meeting Attendees
${attendeeList || "No attendees listed."}

## Organization Context

### All Projects
${projectContext}

### Team Members & Their Recent Work
${teamContext}

### Active Tasks in "${project.name}"
${activeTasksContext || "No active tasks."}

${previousContext ? `### Previous Meeting Summaries (for continuity)\n${previousContext}` : ""}

## Transcript
${formattedTranscript}

---

Analyze this meeting deeply and return a JSON object with the following structure:
{
  "summary": "A comprehensive summary (3-5 paragraphs) covering: what was discussed, what decisions were made vs what was only discussed, what changed in the status of projects/initiatives, and what remains unresolved. Be specific — use names, numbers, and concrete details from the transcript.",
  "strategicAnalysis": "1-2 paragraphs analyzing the strategic implications of this meeting. What does it mean for the organization? What patterns do you see? What risks or opportunities emerged? Connect this meeting to the broader organizational context.",
  "meetingPoints": [
    {"title": "Topic title", "description": "Detailed description including: what was said, by whom, what was decided (if anything), and what remains open. Include direct references to who said what."}
  ],
  "nextSteps": [
    {"description": "Specific, actionable task description", "assignee": "Exact name of person who volunteered or was assigned (listen carefully for who says 'I'll do it' or 'yo me apunto'), or null if unclear", "dueDate": "YYYY-MM-DD or null"}
  ]
}

CRITICAL GUIDELINES:
- SUMMARY: Be thorough and specific. Mention who said what. Distinguish between decisions made and topics merely discussed. Note any disagreements or concerns raised.
- STRATEGIC ANALYSIS: Connect this meeting to the organization's projects and goals. Identify patterns, risks, validated or invalidated assumptions, and strategic shifts.
- MEETING POINTS: Each topic discussed should be its own point. Include the nuance — who advocated for what, what concerns were raised, what was the outcome.
- NEXT STEPS: Be extremely rigorous. Only include items where someone explicitly committed to doing something or was clearly assigned. Listen for phrases like "I'll do it", "yo me apunto", "I'll draft", "let's schedule", etc. The assignee MUST be the person who volunteered or was assigned, not someone who merely discussed the topic. If the transcript is in Spanish or another language, still use the attendee names exactly as listed above.
- All dates MUST be in the future (${todayStr} or later). If a specific date is mentioned (e.g., "Wednesday meeting"), calculate the actual date.
- If a project status change was discussed (e.g., killing a project, putting on hold), include it as a next step: "Move [project] status to [new status]".

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
        data: {
          summary: parsed.strategicAnalysis
            ? `${parsed.summary}\n\n---\n\n**Strategic Analysis**\n\n${parsed.strategicAnalysis}`
            : parsed.summary,
        },
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
