"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ProjectOverview } from "@/components/projects/project-overview";
import { ProjectTasks } from "@/components/projects/project-tasks";
import { ProjectMeetings } from "@/components/projects/project-meetings";

// ── Types ──────────────────────────────────────────────────

export interface ProjectMemberUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string | null;
}

export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  createdAt: string;
  user: ProjectMemberUser;
}

export interface TaskAssignee {
  id: string;
  userId: string;
  taskId: string;
  user: ProjectMemberUser;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  startDate: string;
  endDate: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  assignees: TaskAssignee[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  _count: {
    tasks: number;
    meetings: number;
  };
}

// ── Status helpers ─────────────────────────────────────────

const PROJECT_STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Backlog",
  PLANNING: "Planning",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  IN_REVIEW: "In Review",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

function getProjectStatusVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "IN_PROGRESS":
      return "default";
    case "COMPLETED":
      return "default";
    case "ARCHIVED":
    case "ON_HOLD":
      return "secondary";
    default:
      return "outline";
  }
}

// ── Component ──────────────────────────────────────────────

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      const data = await res.json();
      setProject(data);
    } catch {
      setError("Failed to load project");
    }
  }, [projectId]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`);
      if (!res.ok) throw new Error("Failed to load tasks");
      const data = await res.json();
      setTasks(data);
    } catch {
      // silently fail for tasks, they'll show an empty state
    }
  }, [projectId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchProject(), fetchTasks()]);
      setLoading(false);
    }
    load();
  }, [fetchProject, fetchTasks]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
        <p className="text-muted-foreground">
          {error ?? "Project not found."}
        </p>
        <Link href="/projects" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted">
          <ArrowLeftIcon className="size-4" />
          Back to Projects
        </Link>
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === "DONE").length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeftIcon className="size-4" />
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <Badge variant={getProjectStatusVariant(project.status)}>
              {PROJECT_STATUS_LABELS[project.status] ?? project.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks
            {tasks.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({tasks.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="meetings">
            Meetings
            {project._count.meetings > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({project._count.meetings})
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ProjectOverview
            project={project}
            totalTasks={tasks.length}
            completedTasks={completedTasks}
            onProjectUpdated={fetchProject}
            onMembersChanged={fetchProject}
          />
        </TabsContent>

        <TabsContent value="tasks">
          <ProjectTasks
            projectId={projectId}
            tasks={tasks}
            members={project.members}
            onTasksChanged={fetchTasks}
          />
        </TabsContent>

        <TabsContent value="meetings">
          <div className="pt-4">
            <ProjectMeetings projectId={projectId} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
