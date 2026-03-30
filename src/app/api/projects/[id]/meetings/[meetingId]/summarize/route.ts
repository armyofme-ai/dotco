import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyMeetingTranscriptReady, notifyTaskAssigned } from "@/lib/email";
import OpenAI from "openai";

export const maxDuration = 300;

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

async function runSummarization(id: string, meetingId: string, sessionUserId: string, sessionUserName: string) {
  try {
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { summary: "__SUMMARIZING__" },
    });

    const project = await prisma.project.findUnique({
      where: { id },
      include: { organization: { select: { name: true } } },
    });
    if (!project) return;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        attendees: {
          include: { user: { select: { id: true, name: true, username: true, email: true } } },
        },
      },
    });
    if (!meeting) return;

    const transcriptSegments = meeting.transcriptSegments as TranscriptSegment[] | null;
    if (!transcriptSegments || transcriptSegments.length === 0) return;

    const speakerMap = (meeting.speakerMap as Record<string, string>) ?? {};
    const formattedTranscript = transcriptSegments
      .map((seg) => `${speakerMap[seg.speaker] ?? seg.speaker}: ${seg.text}`)
      .join("\n\n");

    const attendeeList = meeting.attendees
      .map((a) => `- ${a.user.name} (username: ${a.user.username}, id: ${a.user.id})`)
      .join("\n");

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const meetingDateStr = meeting.date.toISOString().split("T")[0];

    // Gather platform context
    const allProjects = await prisma.project.findMany({
      where: { organizationId: project.organizationId },
      select: { id: true, name: true, description: true, status: true },
    });
    const projectContext = allProjects
      .map((p) => `- ${p.name} (${p.status})${p.description ? `: ${p.description}` : ""}`)
      .join("\n");

    const allUsers = await prisma.user.findMany({
      where: { organizationId: project.organizationId },
      select: {
        id: true, name: true,
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

    const previousMeetings = await prisma.meeting.findMany({
      where: { projectId: id, id: { not: meetingId }, summary: { not: null } },
      select: { name: true, date: true, summary: true },
      orderBy: { date: "desc" },
      take: 3,
    });
    const previousContext = previousMeetings
      .filter((m) => m.summary && !m.summary.startsWith("__"))
      .map((m) => `### ${m.name} (${m.date.toISOString().split("T")[0]})\n${m.summary}`)
      .join("\n\n");

    const activeTasks = await prisma.task.findMany({
      where: { projectId: id, status: { not: "DONE" } },
      select: {
        title: true, status: true, endDate: true,
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
      await prisma.meeting.update({ where: { id: meetingId }, data: { summary: null } });
      return;
    }

    let parsed: SummaryResponse;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      await prisma.meeting.update({ where: { id: meetingId }, data: { summary: null } });
      return;
    }

    const attendeeNameMap = new Map<string, string>();
    for (const attendee of meeting.attendees) {
      attendeeNameMap.set(attendee.user.name.toLowerCase(), attendee.user.id);
      attendeeNameMap.set(attendee.user.username.toLowerCase(), attendee.user.id);
    }

    const assignedTasks = await prisma.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id: meetingId },
        data: {
          summary: parsed.strategicAnalysis
            ? `${parsed.summary}\n\n---\n\n**Strategic Analysis**\n\n${parsed.strategicAnalysis}`
            : parsed.summary,
        },
      });

      await tx.meetingPoint.deleteMany({ where: { meetingId } });
      await tx.nextStep.deleteMany({ where: { meetingId } });
      await tx.task.deleteMany({
        where: { projectId: id, description: `Generated from meeting: ${meeting.name}` },
      });

      if (parsed.meetingPoints && parsed.meetingPoints.length > 0) {
        await tx.meetingPoint.createMany({
          data: parsed.meetingPoints.map((point, index) => ({
            title: point.title, description: point.description, order: index, meetingId,
          })),
        });
      }

      const assigned: { assigneeId: string; description: string; dueDate: string | null }[] = [];
      if (parsed.nextSteps && parsed.nextSteps.length > 0) {
        for (let index = 0; index < parsed.nextSteps.length; index++) {
          const step = parsed.nextSteps[index];
          let assigneeId: string | null = null;
          if (step.assignee) {
            assigneeId = attendeeNameMap.get(step.assignee.toLowerCase()) ?? null;
          }
          await tx.nextStep.create({
            data: { description: step.description, dueDate: step.dueDate ? new Date(step.dueDate) : null, order: index, assigneeId, meetingId },
          });
          let taskEndDate = step.dueDate ? new Date(step.dueDate) : new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          if (taskEndDate < today) taskEndDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          const task = await tx.task.create({
            data: { title: step.description, description: `Generated from meeting: ${meeting.name}`, status: "TODO", startDate: today, endDate: taskEndDate, projectId: id },
          });
          if (assigneeId) {
            await tx.taskAssignee.create({ data: { userId: assigneeId, taskId: task.id } });
            assigned.push({ assigneeId, description: step.description, dueDate: step.dueDate });
          }
        }
      }
      return assigned;
    });

    // Notify assigned users
    if (Array.isArray(assignedTasks) && assignedTasks.length > 0) {
      const userIds = [...new Set(assignedTasks.map((t) => t.assigneeId))];
      const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true } });
      const userMap = new Map(users.map((u) => [u.id, u]));
      for (const task of assignedTasks) {
        if (task.assigneeId === sessionUserId) continue;
        const user = userMap.get(task.assigneeId);
        if (user?.email) {
          notifyTaskAssigned(user.email, user.name || "there", task.description, project.name, id, sessionUserName, task.dueDate || undefined).catch(console.error);
        }
      }
    }

    // Notify attendees
    const updatedMeeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { attendees: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    if (updatedMeeting) {
      for (const attendee of updatedMeeting.attendees) {
        if (attendee.user.id !== sessionUserId && attendee.user.email) {
          notifyMeetingTranscriptReady(attendee.user.email, attendee.user.name || "there", updatedMeeting.name, project.name, id, meetingId).catch(console.error);
        }
      }
    }

    console.log(`Summarization complete for meeting ${meetingId}`);
  } catch (error) {
    console.error(`Summarization failed for meeting ${meetingId}:`, error);
    await prisma.meeting.update({ where: { id: meetingId }, data: { summary: null } }).catch(() => {});
  }
}

// POST /api/projects/[id]/meetings/[meetingId]/summarize - Start summarization (async)
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
    if (!project || project.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { projectId: true, transcriptSegments: true },
    });
    if (!meeting || meeting.projectId !== id) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (!meeting.transcriptSegments) {
      return NextResponse.json({ error: "No transcript available." }, { status: 400 });
    }

    after(() => runSummarization(id, meetingId, session.user.id, session.user.name || "Someone"));

    return NextResponse.json({ status: "summarizing" });
  } catch (error) {
    console.error("Error starting summarization:", error);
    return NextResponse.json({ error: "Failed to start summarization" }, { status: 500 });
  }
}

// GET - Check summarization status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { meetingId } = await params;
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { summary: true },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (meeting.summary === "__SUMMARIZING__") {
      return NextResponse.json({ status: "summarizing" });
    }

    if (meeting.summary) {
      return NextResponse.json({ status: "complete" });
    }

    return NextResponse.json({ status: "none" });
  } catch (error) {
    console.error("Error checking summarization:", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
