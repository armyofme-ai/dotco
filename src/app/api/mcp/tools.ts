import type { PrismaClient } from "@/generated/prisma/client";

// ─── Types ──────────────────────────────────────────────────────────

type TranscriptSegment = {
  speaker: string;
  text: string;
  startTime?: number;
  endTime?: number;
};

type SpeakerMap = Record<string, string>;

// ─── Helpers ────────────────────────────────────────────────────────

function applySpeakerMap(
  segments: TranscriptSegment[],
  speakerMap: SpeakerMap | null
): TranscriptSegment[] {
  if (!speakerMap) return segments;
  return segments.map((seg) => ({
    ...seg,
    speaker: speakerMap[seg.speaker] ?? seg.speaker,
  }));
}

// ─── Tool Handlers ──────────────────────────────────────────────────

export async function listProjects(
  _params: Record<string, never>,
  prisma: PrismaClient,
  orgId: string
) {
  const projects = await prisma.project.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          members: true,
          tasks: true,
          meetings: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    memberCount: p._count.members,
    taskCount: p._count.tasks,
    meetingCount: p._count.meetings,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

export async function getProject(
  params: { projectId: string },
  prisma: PrismaClient,
  orgId: string
) {
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, organizationId: orgId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      members: {
        select: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          startDate: true,
          endDate: true,
          assignees: {
            select: {
              user: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      meetings: {
        select: {
          id: true,
          name: true,
          date: true,
          startTime: true,
          endTime: true,
          _count: { select: { attendees: true } },
        },
        orderBy: { date: "desc" },
        take: 10,
      },
    },
  });

  if (!project) throw new ToolError("Project not found");

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    members: project.members.map((m) => m.user),
    recentTasks: project.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      assignees: t.assignees.map((a) => a.user),
    })),
    recentMeetings: project.meetings.map((m) => ({
      id: m.id,
      name: m.name,
      date: m.date,
      startTime: m.startTime,
      endTime: m.endTime,
      attendeeCount: m._count.attendees,
    })),
  };
}

export async function listMeetings(
  params: { projectId?: string; limit?: number },
  prisma: PrismaClient,
  orgId: string
) {
  const limit = params.limit ?? 50;

  const meetings = await prisma.meeting.findMany({
    where: {
      project: { organizationId: orgId },
      ...(params.projectId ? { projectId: params.projectId } : {}),
    },
    select: {
      id: true,
      name: true,
      date: true,
      startTime: true,
      endTime: true,
      projectId: true,
      project: { select: { name: true } },
      transcription: true,
      summary: true,
      attendees: {
        select: {
          user: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { date: "desc" },
    take: limit,
  });

  return meetings.map((m) => ({
    id: m.id,
    name: m.name,
    date: m.date,
    startTime: m.startTime,
    endTime: m.endTime,
    projectId: m.projectId,
    projectName: m.project.name,
    attendees: m.attendees.map((a) => a.user.name),
    hasTranscript: !!m.transcription,
    hasSummary: !!m.summary,
  }));
}

export async function getMeeting(
  params: { meetingId: string },
  prisma: PrismaClient,
  orgId: string
) {
  const meeting = await prisma.meeting.findFirst({
    where: {
      id: params.meetingId,
      project: { organizationId: orgId },
    },
    select: {
      id: true,
      name: true,
      date: true,
      startTime: true,
      endTime: true,
      agenda: true,
      transcription: true,
      summary: true,
      transcriptSegments: true,
      speakerMap: true,
      projectId: true,
      project: { select: { name: true } },
      attendees: {
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      meetingPoints: {
        select: { id: true, title: true, description: true, order: true },
        orderBy: { order: "asc" },
      },
      nextSteps: {
        select: {
          id: true,
          description: true,
          dueDate: true,
          completed: true,
          order: true,
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!meeting) throw new ToolError("Meeting not found");

  return {
    id: meeting.id,
    name: meeting.name,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    agenda: meeting.agenda,
    projectId: meeting.projectId,
    projectName: meeting.project.name,
    attendees: meeting.attendees.map((a) => a.user),
    transcript: meeting.transcription,
    summary: meeting.summary,
    meetingPoints: meeting.meetingPoints,
    nextSteps: meeting.nextSteps.map((s) => ({
      id: s.id,
      description: s.description,
      dueDate: s.dueDate,
      completed: s.completed,
      assignee: s.assignee,
    })),
  };
}

export async function searchTranscripts(
  params: { query: string; projectId?: string },
  prisma: PrismaClient,
  orgId: string
) {
  if (!params.query || params.query.trim().length === 0) {
    throw new ToolError("query parameter is required");
  }

  const meetings = await prisma.meeting.findMany({
    where: {
      project: { organizationId: orgId },
      ...(params.projectId ? { projectId: params.projectId } : {}),
      transcription: { not: null },
    },
    select: {
      id: true,
      name: true,
      date: true,
      projectId: true,
      project: { select: { name: true } },
      transcription: true,
    },
    orderBy: { date: "desc" },
  });

  const query = params.query.toLowerCase();
  const results: Array<{
    meetingId: string;
    meetingName: string;
    date: Date;
    projectId: string;
    projectName: string;
    excerpts: string[];
  }> = [];

  for (const m of meetings) {
    if (!m.transcription) continue;

    const text = m.transcription.toLowerCase();
    if (!text.includes(query)) continue;

    // Extract excerpts around matches
    const excerpts: string[] = [];
    let searchFrom = 0;
    const maxExcerpts = 3;

    while (excerpts.length < maxExcerpts) {
      const idx = text.indexOf(query, searchFrom);
      if (idx === -1) break;

      const start = Math.max(0, idx - 100);
      const end = Math.min(m.transcription.length, idx + query.length + 100);
      let excerpt = m.transcription.substring(start, end).trim();
      if (start > 0) excerpt = "..." + excerpt;
      if (end < m.transcription.length) excerpt = excerpt + "...";
      excerpts.push(excerpt);

      searchFrom = idx + query.length;
    }

    results.push({
      meetingId: m.id,
      meetingName: m.name,
      date: m.date,
      projectId: m.projectId,
      projectName: m.project.name,
      excerpts,
    });
  }

  return { query: params.query, matchCount: results.length, results };
}

export async function listTasks(
  params: { projectId?: string; status?: string; assigneeId?: string },
  prisma: PrismaClient,
  orgId: string
) {
  const where: Record<string, unknown> = {
    project: { organizationId: orgId },
  };

  if (params.projectId) where.projectId = params.projectId;
  if (params.status) where.status = params.status;
  if (params.assigneeId) {
    where.assignees = { some: { userId: params.assigneeId } };
  }

  const tasks = await prisma.task.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      startDate: true,
      endDate: true,
      projectId: true,
      project: { select: { name: true } },
      assignees: {
        select: {
          user: { select: { id: true, name: true } },
        },
      },
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    startDate: t.startDate,
    endDate: t.endDate,
    projectId: t.projectId,
    projectName: t.project.name,
    assignees: t.assignees.map((a) => a.user),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
}

export async function getTask(
  params: { taskId: string },
  prisma: PrismaClient,
  orgId: string
) {
  const task = await prisma.task.findFirst({
    where: {
      id: params.taskId,
      project: { organizationId: orgId },
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      startDate: true,
      endDate: true,
      projectId: true,
      project: { select: { name: true } },
      assignees: {
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!task) throw new ToolError("Task not found");

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    startDate: task.startDate,
    endDate: task.endDate,
    projectId: task.projectId,
    projectName: task.project.name,
    assignees: task.assignees.map((a) => a.user),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function listUsers(
  _params: Record<string, never>,
  prisma: PrismaClient,
  orgId: string
) {
  const users = await prisma.user.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return users;
}

export async function getMeetingTranscript(
  params: { meetingId: string },
  prisma: PrismaClient,
  orgId: string
) {
  const meeting = await prisma.meeting.findFirst({
    where: {
      id: params.meetingId,
      project: { organizationId: orgId },
    },
    select: {
      id: true,
      name: true,
      transcriptSegments: true,
      speakerMap: true,
      transcription: true,
    },
  });

  if (!meeting) throw new ToolError("Meeting not found");

  if (meeting.transcriptSegments && Array.isArray(meeting.transcriptSegments)) {
    const segments = applySpeakerMap(
      meeting.transcriptSegments as TranscriptSegment[],
      meeting.speakerMap as SpeakerMap | null
    );

    return {
      meetingId: meeting.id,
      meetingName: meeting.name,
      format: "diarized",
      segments,
    };
  }

  // Fallback to plain transcription
  if (meeting.transcription) {
    return {
      meetingId: meeting.id,
      meetingName: meeting.name,
      format: "plain",
      text: meeting.transcription,
    };
  }

  return {
    meetingId: meeting.id,
    meetingName: meeting.name,
    format: "none",
    text: null,
  };
}

export async function getMeetingActions(
  params: { meetingId: string },
  prisma: PrismaClient,
  orgId: string
) {
  const meeting = await prisma.meeting.findFirst({
    where: {
      id: params.meetingId,
      project: { organizationId: orgId },
    },
    select: {
      id: true,
      name: true,
      meetingPoints: {
        select: { id: true, title: true, description: true, order: true },
        orderBy: { order: "asc" },
      },
      nextSteps: {
        select: {
          id: true,
          description: true,
          dueDate: true,
          completed: true,
          order: true,
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!meeting) throw new ToolError("Meeting not found");

  return {
    meetingId: meeting.id,
    meetingName: meeting.name,
    meetingPoints: meeting.meetingPoints,
    nextSteps: meeting.nextSteps.map((s) => ({
      id: s.id,
      description: s.description,
      dueDate: s.dueDate,
      completed: s.completed,
      assignee: s.assignee,
    })),
  };
}

// ─── Error class for tool-level errors ──────────────────────────────

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

// ─── Tool definitions for MCP tools/list ────────────────────────────

export const toolDefinitions = [
  {
    name: "list_projects",
    description:
      "List all projects in the organization with name, description, status, member count, task count, and meeting count.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_project",
    description:
      "Get detailed information about a specific project including members, recent tasks, and recent meetings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string",
          description: "The ID of the project to retrieve",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "list_meetings",
    description:
      "List meetings, optionally filtered by project. Includes name, date, attendees, and whether transcript/summary exist.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string",
          description: "Optional project ID to filter meetings by",
        },
        limit: {
          type: "number",
          description: "Maximum number of meetings to return (default 50)",
        },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_meeting",
    description:
      "Get full meeting details including attendees, agenda, transcript, summary, meeting points, and next steps.",
    inputSchema: {
      type: "object" as const,
      properties: {
        meetingId: {
          type: "string",
          description: "The ID of the meeting to retrieve",
        },
      },
      required: ["meetingId"],
    },
  },
  {
    name: "search_transcripts",
    description:
      "Search across all meeting transcriptions for a given query. Returns matching meetings with relevant excerpts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query to look for in transcripts",
        },
        projectId: {
          type: "string",
          description: "Optional project ID to limit search scope",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_tasks",
    description:
      "List tasks with title, status, dates, assignees, and project name. Can filter by project, status, or assignee.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string",
          description: "Optional project ID to filter tasks by",
        },
        status: {
          type: "string",
          description:
            "Optional task status filter (TODO, IN_PROGRESS, IN_REVIEW, DONE)",
          enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"],
        },
        assigneeId: {
          type: "string",
          description: "Optional user ID to filter tasks by assignee",
        },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_task",
    description: "Get full details of a specific task including assignees.",
    inputSchema: {
      type: "object" as const,
      properties: {
        taskId: {
          type: "string",
          description: "The ID of the task to retrieve",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "list_users",
    description:
      "List all users in the organization with name, email, and role.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_meeting_transcript",
    description:
      "Get the diarized transcript of a meeting with speaker names applied from the speaker map. Falls back to plain transcription if diarized segments are not available.",
    inputSchema: {
      type: "object" as const,
      properties: {
        meetingId: {
          type: "string",
          description: "The ID of the meeting",
        },
      },
      required: ["meetingId"],
    },
  },
  {
    name: "get_meeting_actions",
    description:
      "Get meeting points and next steps (action items) for a meeting, including assignees and completion status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        meetingId: {
          type: "string",
          description: "The ID of the meeting",
        },
      },
      required: ["meetingId"],
    },
  },
];

// ─── Dispatcher ─────────────────────────────────────────────────────

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  prisma: PrismaClient,
  orgId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  switch (name) {
    case "list_projects":
      return listProjects({} as Record<string, never>, prisma, orgId);
    case "get_project":
      return getProject(args as { projectId: string }, prisma, orgId);
    case "list_meetings":
      return listMeetings(
        args as { projectId?: string; limit?: number },
        prisma,
        orgId
      );
    case "get_meeting":
      return getMeeting(args as { meetingId: string }, prisma, orgId);
    case "search_transcripts":
      return searchTranscripts(
        args as { query: string; projectId?: string },
        prisma,
        orgId
      );
    case "list_tasks":
      return listTasks(
        args as {
          projectId?: string;
          status?: string;
          assigneeId?: string;
        },
        prisma,
        orgId
      );
    case "get_task":
      return getTask(args as { taskId: string }, prisma, orgId);
    case "list_users":
      return listUsers({} as Record<string, never>, prisma, orgId);
    case "get_meeting_transcript":
      return getMeetingTranscript(
        args as { meetingId: string },
        prisma,
        orgId
      );
    case "get_meeting_actions":
      return getMeetingActions(args as { meetingId: string }, prisma, orgId);
    default:
      throw new ToolError(`Unknown tool: ${name}`);
  }
}
