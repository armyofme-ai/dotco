"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CheckSquare, Loader2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CreateGlobalTaskDialog } from "@/components/tasks/create-global-task-dialog";
import { cn } from "@/lib/utils";
import { isOverdue } from "@/lib/task-utils";
import type { TaskStatus } from "@/generated/prisma/client";

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  startDate: string;
  endDate: string;
  projectId: string;
  project: { id: string; name: string };
  assignees: {
    id: string;
    userId: string;
    user: { id: string; name: string };
  }[];
}

type FilterType = "all" | "active" | "completed";

export function MyTasksView() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/my-tasks");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        if (data?.user?.id) {
          setCurrentUserId(data.user.id);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchSession();
  }, [fetchTasks, fetchSession]);

  const toggleTaskStatus = async (task: TaskData) => {
    const newStatus = task.status === "DONE" ? "TODO" : "DONE";
    setTogglingIds((prev) => new Set(prev).add(task.id));

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );

    try {
      const res = await fetch(
        `/api/projects/${task.projectId}/tasks/${task.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) throw new Error("Failed to update task");
    } catch (error) {
      console.error("Error toggling task:", error);
      // Revert on failure
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: task.status } : t
        )
      );
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "active") return task.status !== "DONE";
    if (filter === "completed") return task.status === "DONE";
    return true;
  });

  // Sort: active tasks first by endDate ascending, completed tasks at bottom
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const aCompleted = a.status === "DONE" ? 1 : 0;
    const bCompleted = b.status === "DONE" ? 1 : 0;
    if (aCompleted !== bCompleted) return aCompleted - bCompleted;
    return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
  });

  const taskCount = tasks.length;

  const handleTaskCreated = () => {
    setDialogOpen(false);
    fetchTasks();
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Tasks
          </h1>
          {!loading && (
            <Badge variant="secondary" className="text-xs tabular-nums">
              {taskCount}
            </Badge>
          )}
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="size-3.5" />
          New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
              filter === key
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <CheckSquare className="size-10 opacity-40" />
          <p className="text-sm">No tasks assigned to you</p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {sortedTasks.map((task) => {
            const completed = task.status === "DONE";
            const overdue = isOverdue(task);
            const toggling = togglingIds.has(task.id);

            return (
              <div
                key={task.id}
                className={cn(
                  "group flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/40",
                  completed && "opacity-50"
                )}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  disabled={toggling}
                  onClick={() => toggleTaskStatus(task)}
                  className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded border transition-colors",
                    completed
                      ? "border-foreground/30 bg-foreground/80 text-background"
                      : "border-border hover:border-foreground/50"
                  )}
                >
                  {completed && (
                    <svg
                      className="size-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>

                {/* Title + Project */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={cn(
                      "truncate text-sm text-foreground",
                      completed && "line-through"
                    )}
                  >
                    {task.title}
                  </span>
                  <Link
                    href={`/projects/${task.project.id}`}
                    className="w-fit truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {task.project.name}
                  </Link>
                </div>

                {/* End Date */}
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    overdue
                      ? "font-medium text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {format(new Date(task.endDate), "MMM d")}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Dialog */}
      {currentUserId && (
        <CreateGlobalTaskDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={handleTaskCreated}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
